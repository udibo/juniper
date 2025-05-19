import { z } from "zod";
import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";
import { isTest } from "@udibo/juniper/utils/env";
import { HttpError } from "@udibo/http-error";

import { startActiveSpan } from "/utils/otel.ts";

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
}

export class Service<T extends Entity> implements Disposable {
  private _kv: Deno.Kv | undefined;
  public readonly name: string;
  public readonly schema: z.ZodSchema<T>;
  public readonly uniqueIndexes: Exclude<keyof T, "id">[];
  public readonly indexes: Exclude<keyof T, "id">[];

  constructor(options: ServiceOptions<T>) {
    this.name = options.name;
    this.schema = options.schema;
    this.uniqueIndexes = options.uniqueIndexes || [];
    this.indexes = options.indexes || [];
  }

  private async getKv(): Promise<Deno.Kv> {
    if (!this._kv) {
      this._kv = await (isTest() ? Deno.openKv(":memory:") : Deno.openKv());
    }

    return this._kv;
  }

  close(): void {
    this._kv?.close();
    delete this._kv;
  }
  [Symbol.dispose](): void {
    this.close();
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
          throw new HttpError(
            400,
            `Invalid ${this.name} data: ${messages.join(", ")}`,
          );
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
        !this.uniqueIndexes.includes(index as Exclude<keyof T, "id">)
      ) {
        throw new HttpError(
          400,
          `Index "${
            String(index)
          }" is not a valid unique index for ${this.name}. Valid unique indexes are: ${
            this.uniqueIndexes.join(", ")
          }.`,
        );
      }
      const kv = await this.getKv();
      const entry = await kv.get<T>([this.name, index, value]);
      if (!entry.value) {
        throw new HttpError(
          404,
          `Failed to find ${this.name} by ${String(index)}`,
        );
      }
      return entry.value;
    });
  }

  get(id: string): Promise<T> {
    return startActiveSpan("get", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", id);
      const kv = await this.getKv();
      const entry = await kv.get<T>([this.name, "id", id]);
      if (!entry.value) {
        throw new HttpError(404, `Failed to find ${this.name}`);
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
      const kv = await this.getKv();

      if (
        index &&
        index !== "id" &&
        !this.uniqueIndexes.includes(index as Exclude<keyof T, "id">) &&
        !this.indexes.includes(index as Exclude<keyof T, "id">)
      ) {
        const validIndexes = ["id", ...this.uniqueIndexes, ...this.indexes];
        throw new HttpError(
          400,
          `Index "${
            String(index)
          }" is not a valid index for ${this.name}. Valid indexes are: ${
            validIndexes.join(", ")
          }.`,
        );
      }

      const entries = kv.list<T>(
        { prefix: [this.name, index ?? "id"] },
        listOptions,
      );
      const values: T[] = [];
      for await (const entry of entries) {
        values.push(entry.value);
      }
      return { entries: values, cursor: entries.cursor };
    });
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
      for (const index of this.uniqueIndexes) {
        const key = created[index] as Deno.KvKeyPart;
        transaction.check({ key: [this.name, index, key], versionstamp: null });
      }
      transaction.set([this.name, "id", id], created);
      for (const index of this.uniqueIndexes) {
        const key = created[index] as Deno.KvKeyPart;
        transaction.set([this.name, index, key], created);
      }
      for (const index of this.indexes) {
        const key = created[index] as Deno.KvKeyPart;
        transaction.set([this.name, index, key, id], created);
      }
      const result = await transaction.commit();
      if (!result.ok) {
        throw new HttpError(500, `Failed to create ${this.name}`);
      }
      return created;
    });
  }

  update(value: Omit<T, "createdAt" | "updatedAt">): Promise<T> {
    return startActiveSpan("update", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", value.id);
      const kv = await this.getKv();

      const existing = await kv.get<T>([this.name, "id", value.id]);
      if (!existing.value) {
        throw new HttpError(404, `Failed to find ${this.name} to update`);
      }

      const updatedValue = this.parse({
        ...value,
        createdAt: existing.value.createdAt,
        updatedAt: new Date(),
      });

      const transaction = kv.atomic();
      transaction.check(existing);
      for (const index of this.uniqueIndexes) {
        const currentKey = existing.value?.[index] as Deno.KvKeyPart;
        const nextKey = updatedValue[index] as Deno.KvKeyPart;
        if (nextKey !== currentKey) {
          transaction.check({
            key: [this.name, index, nextKey],
            versionstamp: null,
          });
        }
      }

      transaction.set(
        [this.name, "id", updatedValue.id],
        updatedValue,
      );
      for (const index of this.uniqueIndexes) {
        const currentKey = existing.value?.[index] as Deno.KvKeyPart;
        const nextKey = updatedValue[index] as Deno.KvKeyPart;
        if (nextKey !== currentKey) {
          transaction.delete([this.name, index, currentKey]);
        }
        transaction.set([this.name, index, nextKey], updatedValue);
      }
      for (const index of this.indexes) {
        const currentKey = existing.value?.[index] as Deno.KvKeyPart;
        const nextKey = updatedValue[index] as Deno.KvKeyPart;
        if (existing.value && currentKey !== nextKey) {
          transaction.delete([
            this.name,
            index,
            currentKey,
            existing.value.id,
          ]);
        }
        transaction.set(
          [this.name, index, nextKey, updatedValue.id],
          updatedValue,
        );
      }

      const result = await transaction.commit();
      if (!result.ok) {
        throw new HttpError(500, `Failed to update ${this.name}`);
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

      const existing = await kv.get<T>([this.name, "id", partialValue.id]);
      if (!existing.value) {
        throw new HttpError(404, `Failed to find ${this.name} to patch`);
      }

      const newValue = this.parse({
        ...existing.value,
        ...partialValue,
        updatedAt: new Date(),
      });

      const transaction = kv.atomic();
      transaction.check(existing);
      for (const index of this.uniqueIndexes) {
        const currentKey = existing.value?.[index] as Deno.KvKeyPart;
        const nextKey = newValue[index] as Deno.KvKeyPart;
        if (nextKey !== currentKey) {
          transaction.check({
            key: [this.name, index, nextKey],
            versionstamp: null,
          });
        }
      }

      transaction.set([this.name, "id", newValue.id], newValue);
      for (const index of this.uniqueIndexes) {
        const currentKey = existing.value?.[index] as Deno.KvKeyPart;
        const nextKey = newValue[index] as Deno.KvKeyPart;
        if (nextKey !== currentKey) {
          transaction.delete([this.name, index, currentKey]);
        }
        transaction.set([this.name, index, nextKey], newValue);
      }
      for (const index of this.indexes) {
        const currentKey = existing.value?.[index] as Deno.KvKeyPart;
        const nextKey = newValue[index] as Deno.KvKeyPart;
        if (existing.value && currentKey !== nextKey) {
          transaction.delete([
            this.name,
            index,
            currentKey,
            existing.value.id,
          ]);
        }
        transaction.set([this.name, index, nextKey, newValue.id], newValue);
      }

      const result = await transaction.commit();
      if (!result.ok) {
        throw new HttpError(500, `Failed to patch ${this.name}`);
      }

      return newValue;
    });
  }

  delete(id: string): Promise<void> {
    return startActiveSpan("delete", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", id);
      const kv = await this.getKv();

      const existingEntry = await kv.get<T>([this.name, "id", id]);
      if (!existingEntry.value) {
        throw new HttpError(404, `Failed to find ${this.name} to delete`);
      }

      const existingValue = existingEntry.value;
      const transaction = kv.atomic();
      transaction.check(existingEntry);

      transaction.delete([this.name, "id", id]);
      for (const index of this.uniqueIndexes) {
        const key = existingValue[index] as Deno.KvKeyPart;
        transaction.delete([this.name, index, key]);
      }
      for (const index of this.indexes) {
        const key = existingValue[index] as Deno.KvKeyPart;
        transaction.delete([this.name, index, key, id]);
      }

      const result = await transaction.commit();
      if (!result.ok) {
        throw new HttpError(500, `Failed to delete ${this.name}`);
      }
    });
  }
}
