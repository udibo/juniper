import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";
import { HttpError } from "@udibo/http-error";
import { z } from "zod";

import { isTest } from "@udibo/juniper/utils/env";

import { startActiveSpan } from "@/utils/otel.ts";

export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceListOptions<T extends Entity>
  extends Deno.KvListOptions {
  index?: Exclude<keyof T, "id"> & Deno.KvKeyPart;
}

export interface ServiceOptions<T extends Entity> {
  name: string;
  schema: z.ZodSchema<T>;
  uniqueIndexes?: Exclude<keyof T, "id">[];
  indexes?: Exclude<keyof T, "id">[];
  keyspace?: string;
}

const ListQuerySchema = z.object({
  limit: z.string().optional().transform((val) => {
    if (val === undefined) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? undefined : num;
  }),
  cursor: z.string().optional(),
  reverse: z.string().optional().transform((val) => val === "true"),
  consistency: z.enum(["strong", "eventual"]).optional(),
  batchSize: z.string().optional().transform((val) => {
    if (val === undefined) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? undefined : num;
  }),
  index: z.string().optional(),
});

let defaultKv: Deno.Kv | undefined;

async function getDefaultKv(): Promise<Deno.Kv> {
  if (!defaultKv) {
    defaultKv = await (isTest() ? Deno.openKv(":memory:") : Deno.openKv());
  }
  return defaultKv;
}

function closeDefaultKv(): void {
  defaultKv?.close();
  defaultKv = undefined;
}

function notFound(name: string, context?: string): HttpError {
  const message = context
    ? `Failed to find ${name} ${context}`
    : `Failed to find ${name}`;
  return new HttpError(404, message);
}

function invalidIndex(
  name: string,
  index: string,
  validIndexes: string[],
): HttpError {
  return new HttpError(
    400,
    `Index "${index}" is not a valid unique index for ${name}. Valid unique indexes are: ${
      validIndexes.join(", ")
    }.`,
  );
}

function operationFailed(name: string, operation: string): HttpError {
  return new HttpError(400, `Failed to ${operation} ${name}`);
}

function validationFailed(name: string, messages: string[]): HttpError {
  return new HttpError(400, `Invalid ${name}: ${messages.join(", ")}`);
}

export class Service<T extends Entity> implements Disposable {
  public readonly name: string;
  public readonly schema: z.ZodSchema<T>;
  readonly #uniqueIndexes: Exclude<keyof T, "id">[];
  readonly #indexes: Exclude<keyof T, "id">[];
  readonly #keyspace: string | undefined;

  constructor(options: ServiceOptions<T>) {
    this.name = options.name;
    this.schema = options.schema;
    this.#uniqueIndexes = options.uniqueIndexes ?? [];
    this.#indexes = options.indexes ?? [];
    this.#keyspace = options.keyspace;
  }

  get uniqueIndexes(): Exclude<keyof T, "id">[] {
    return [...this.#uniqueIndexes];
  }

  get indexes(): Exclude<keyof T, "id">[] {
    return [...this.#indexes];
  }

  get allIndexes(): string[] {
    return [
      "id",
      ...this.#uniqueIndexes as string[],
      ...this.#indexes as string[],
    ];
  }

  protected key(...parts: Deno.KvKeyPart[]): Deno.KvKey {
    if (this.#keyspace) {
      return [this.#keyspace, this.name, ...parts];
    }
    return [this.name, ...parts];
  }

  protected idKey(id: string): Deno.KvKey {
    return this.key("id", id);
  }

  protected indexKey(
    index: Exclude<keyof T, "id">,
    value: Deno.KvKeyPart,
    id?: string,
  ): Deno.KvKey {
    return id ? this.key(index, value, id) : this.key(index, value);
  }

  protected getKv(): Promise<Deno.Kv> {
    return getDefaultKv();
  }

  async open(): Promise<void> {
    await getDefaultKv();
  }

  close(): void {
    closeDefaultKv();
  }

  [Symbol.dispose](): void {
    this.close();
  }

  parseListQueryParams(
    queryParams: Record<string, string>,
  ): ServiceListOptions<T> {
    return startActiveSpan("parseListQueryParams", (span) => {
      span.setAttribute("service", this.name);

      try {
        const parsed = ListQuerySchema.parse(queryParams);
        const options: ServiceListOptions<T> = {
          limit: parsed.limit,
          cursor: parsed.cursor,
          reverse: parsed.reverse,
          consistency: parsed.consistency,
          batchSize: parsed.batchSize,
        };

        if (parsed.index) {
          span.setAttribute("query.index", parsed.index);
          const explicitIndexes = [
            ...this.#uniqueIndexes,
            ...this.#indexes,
          ] as string[];
          if (explicitIndexes.includes(parsed.index)) {
            options.index = parsed.index as
              & Exclude<keyof T, "id">
              & Deno.KvKeyPart;
          } else {
            throw new HttpError(
              400,
              `Invalid index "${parsed.index}" for ${this.name}. Valid indexes are: ${
                this.allIndexes.join(", ")
              }.`,
            );
          }
        }
        return options;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const messages = error.errors.map((e) => e.message);
          throw new HttpError(
            400,
            `Invalid list options: ${messages.join(", ")}`,
          );
        }
        throw HttpError.from(error);
      }
    });
  }

  parse(data: unknown): T {
    return startActiveSpan("parse", (span) => {
      span.setAttribute("service", this.name);
      try {
        return this.schema.parse(data) as T;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const messages = error.errors.map((e) => {
            if (e.message === "Required" && e.path && e.path.length > 0) {
              return `Field '${e.path.join(".")}' is required.`;
            }
            return e.message;
          });
          throw validationFailed(this.name, messages);
        }
        throw HttpError.from(error);
      }
    });
  }

  getBy(
    index: keyof T,
    value: T[keyof T] & Deno.KvKeyPart,
  ): Promise<T> {
    return startActiveSpan("getBy", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("index", String(index));
      span.setAttribute("value", String(value));
      if (
        index !== "id" &&
        !this.#uniqueIndexes.includes(index as Exclude<keyof T, "id">)
      ) {
        throw invalidIndex(
          this.name,
          String(index),
          this.#uniqueIndexes as string[],
        );
      }
      const kv = await this.getKv();
      const entry = await kv.get<T>(this.key(index as Deno.KvKeyPart, value));
      if (!entry.value) {
        throw notFound(this.name, `by ${String(index)}`);
      }
      return entry.value;
    });
  }

  get(id: string): Promise<T> {
    return startActiveSpan("get", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", id);
      const kv = await this.getKv();
      const entry = await kv.get<T>(this.idKey(id));
      if (!entry.value) {
        throw notFound(this.name);
      }
      return entry.value;
    });
  }

  list(
    options?: ServiceListOptions<T>,
  ): Promise<{ entries: T[]; cursor?: string }> {
    return startActiveSpan("list", async (span) => {
      span.setAttribute("service", this.name);
      const { index, ...listOptions } = options || {};
      span.setAttribute("index", String(index));
      if (listOptions.cursor) {
        span.setAttribute("cursor", listOptions.cursor);
      }
      if (listOptions.limit) {
        span.setAttribute("limit", String(listOptions.limit));
      }
      if (listOptions.reverse) {
        span.setAttribute("reverse", "true");
      }
      if (listOptions.batchSize) {
        span.setAttribute("batchSize", String(listOptions.batchSize));
      }
      if (listOptions.consistency) {
        span.setAttribute("consistency", listOptions.consistency);
      }

      if (
        index &&
        index !== "id" &&
        !this.#uniqueIndexes.includes(index as Exclude<keyof T, "id">) &&
        !this.#indexes.includes(index as Exclude<keyof T, "id">)
      ) {
        throw new HttpError(
          400,
          `Index "${
            String(index)
          }" is not a valid index for ${this.name}. Valid indexes are: ${
            this.allIndexes.join(", ")
          }.`,
        );
      }

      const kv = await this.getKv();

      const entries = kv.list<T>(
        { prefix: this.key(index ?? "id") },
        listOptions,
      );
      const values: T[] = [];
      for await (const entry of entries) {
        values.push(entry.value);
      }
      return { entries: values, cursor: entries.cursor };
    });
  }

  protected getKvKeyPart(value: T[keyof T] | Date): Deno.KvKeyPart {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value as Deno.KvKeyPart;
  }

  create(value: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T> {
    return startActiveSpan("create", async (span) => {
      span.setAttribute("service", this.name);
      const id: string = generateUUIDv7();
      span.setAttribute("id", id);
      const kv = await this.getKv();
      const now = new Date();
      const created = this.parse({
        ...value,
        id,
        createdAt: now,
        updatedAt: now,
      });
      const transaction = kv.atomic();
      for (const index of this.#uniqueIndexes) {
        const keyPart = this.getKvKeyPart(created[index]);
        transaction.check({
          key: this.indexKey(index, keyPart),
          versionstamp: null,
        });
      }
      transaction.set(this.idKey(id), created);
      for (const index of this.#uniqueIndexes) {
        const keyPart = this.getKvKeyPart(created[index]);
        transaction.set(this.indexKey(index, keyPart), created);
      }
      for (const index of this.#indexes) {
        const keyPart = this.getKvKeyPart(created[index]);
        transaction.set(this.indexKey(index, keyPart, id), created);
      }
      const result = await transaction.commit();
      if (!result.ok) {
        throw operationFailed(this.name, "create");
      }
      return created;
    });
  }

  update(value: Omit<T, "createdAt" | "updatedAt">): Promise<T> {
    return startActiveSpan("update", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", value.id);
      const kv = await this.getKv();

      const existing = await kv.get<T>(this.idKey(value.id));
      if (!existing.value) {
        throw notFound(this.name, "to update");
      }

      const updatedValue = this.parse({
        ...value,
        createdAt: existing.value.createdAt,
        updatedAt: new Date(),
      });

      const transaction = kv.atomic();
      transaction.check(existing);
      for (const index of this.#uniqueIndexes) {
        const currentKey = this.getKvKeyPart(existing.value![index]);
        const nextKey = this.getKvKeyPart(updatedValue[index]);
        if (nextKey !== currentKey) {
          transaction.check({
            key: this.indexKey(index, nextKey),
            versionstamp: null,
          });
        }
      }

      transaction.set(this.idKey(updatedValue.id), updatedValue);
      for (const index of this.#uniqueIndexes) {
        const currentKey = this.getKvKeyPart(existing.value![index]);
        const nextKey = this.getKvKeyPart(updatedValue[index]);
        if (nextKey !== currentKey) {
          transaction.delete(this.indexKey(index, currentKey));
        }
        transaction.set(this.indexKey(index, nextKey), updatedValue);
      }
      for (const index of this.#indexes) {
        const currentKey = this.getKvKeyPart(existing.value![index]);
        const nextKey = this.getKvKeyPart(updatedValue[index]);
        if (existing.value && currentKey !== nextKey) {
          transaction.delete(
            this.indexKey(index, currentKey, existing.value.id),
          );
        }
        transaction.set(
          this.indexKey(index, nextKey, updatedValue.id),
          updatedValue,
        );
      }

      const result = await transaction.commit();
      if (!result.ok) {
        throw operationFailed(this.name, "update");
      }

      return updatedValue;
    });
  }

  patch(
    partialValue: Omit<Partial<T>, "createdAt" | "updatedAt"> & { id: string },
  ): Promise<T> {
    return startActiveSpan("patch", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", partialValue.id);
      const kv = await this.getKv();

      const existing = await kv.get<T>(this.idKey(partialValue.id));
      if (!existing.value) {
        throw notFound(this.name, "to patch");
      }

      const newValue = this.parse({
        ...existing.value,
        ...partialValue,
        updatedAt: new Date(),
      });

      const transaction = kv.atomic();
      transaction.check(existing);
      for (const index of this.#uniqueIndexes) {
        const currentKey = this.getKvKeyPart(existing.value![index]);
        const nextKey = this.getKvKeyPart(newValue[index]);
        if (nextKey !== currentKey) {
          transaction.check({
            key: this.indexKey(index, nextKey),
            versionstamp: null,
          });
        }
      }

      transaction.set(this.idKey(newValue.id), newValue);
      for (const index of this.#uniqueIndexes) {
        const currentKey = this.getKvKeyPart(existing.value![index]);
        const nextKey = this.getKvKeyPart(newValue[index]);
        if (nextKey !== currentKey) {
          transaction.delete(this.indexKey(index, currentKey));
        }
        transaction.set(this.indexKey(index, nextKey), newValue);
      }
      for (const index of this.#indexes) {
        const currentKey = this.getKvKeyPart(existing.value![index]);
        const nextKey = this.getKvKeyPart(newValue[index]);
        if (existing.value && currentKey !== nextKey) {
          transaction.delete(
            this.indexKey(index, currentKey, existing.value.id),
          );
        }
        transaction.set(this.indexKey(index, nextKey, newValue.id), newValue);
      }

      const result = await transaction.commit();
      if (!result.ok) {
        throw operationFailed(this.name, "patch");
      }

      return newValue;
    });
  }

  delete(id: string): Promise<void> {
    return startActiveSpan("delete", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", id);
      const kv = await this.getKv();

      const existingEntry = await kv.get<T>(this.idKey(id));
      if (!existingEntry.value) {
        throw notFound(this.name, "to delete");
      }

      const existingValue = existingEntry.value;
      const transaction = kv.atomic();
      transaction.check(existingEntry);

      transaction.delete(this.idKey(id));
      for (const index of this.#uniqueIndexes) {
        const keyPart = this.getKvKeyPart(existingValue[index]);
        transaction.delete(this.indexKey(index, keyPart));
      }
      for (const index of this.#indexes) {
        const keyPart = this.getKvKeyPart(existingValue[index]);
        transaction.delete(this.indexKey(index, keyPart, id));
      }

      const result = await transaction.commit();
      if (!result.ok) {
        throw operationFailed(this.name, "delete");
      }
    });
  }
}
