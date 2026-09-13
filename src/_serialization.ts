import {
  decodeHydrationPayload,
  defineOwnValue,
  fromTaggedJson,
  Tagged,
  toTaggedJson,
} from "./_tagged-json.ts";
import type { TaggedJson } from "./_tagged-json.ts";
export {
  fromTaggedJson,
  toInlineScriptJson,
  toTaggedJson,
} from "./_tagged-json.ts";
export type { TaggedJson } from "./_tagged-json.ts";
import type { RouterContext, RouterContextProvider } from "react-router";
import { HttpError, isHttpErrorLike } from "@udibo/http-error";

import { isDevelopment } from "./utils/env.ts";

/**
 * Internal interface for custom type serializers.
 * @internal
 */
export interface TypeSerializer<T, S = unknown> {
  name: string;
  is: (value: unknown) => value is T;
  serialize: (value: T) => S;
  deserialize: (data: S) => T;
}

/**
 * Internal interface for error serializers.
 * @internal
 */
export interface ErrorSerializer<E extends Error> {
  name: string;
  is: (error: unknown) => error is E;
  serialize: (error: E) => Record<string, unknown>;
  deserialize: (data: Record<string, unknown>) => E;
}

/**
 * Internal interface for context serializers.
 * @internal
 */
export interface ContextSerializer<T, S = unknown> {
  name: string;
  context: RouterContext<T>;
  serialize: (value: T) => S;
  deserialize: (data: S | undefined) => T;
}

// deno-lint-ignore no-explicit-any
const typeRegistry = new Map<string, TypeSerializer<any, any>>();
// deno-lint-ignore no-explicit-any
const typeSerializers: TypeSerializer<any, any>[] = [];
// deno-lint-ignore no-explicit-any
const errorRegistry = new Map<string, ErrorSerializer<any>>();
// deno-lint-ignore no-explicit-any
const errorSerializers: ErrorSerializer<any>[] = [];
const builtInErrorSerializers = new Set<ErrorSerializer<Error>>();
// deno-lint-ignore no-explicit-any
const contextRegistry = new Map<string, ContextSerializer<any, any>>();

/**
 * Internal function to add a type serializer to the registry.
 * Called by registerType in mod.ts.
 *
 * @internal
 */
export function _addTypeSerializer<T, S = unknown>(
  serializer: TypeSerializer<T, S>,
): void {
  if (typeRegistry.has(serializer.name)) {
    throw new Error(`Type "${serializer.name}" is already registered`);
  }
  typeRegistry.set(serializer.name, serializer);
  typeSerializers.push(serializer);
}

/**
 * Internal function to add an error serializer to the registry.
 * Called by registerError in mod.ts.
 *
 * @internal
 */
export function _addErrorSerializer<E extends Error>(
  serializer: ErrorSerializer<E>,
): void {
  if (errorRegistry.has(serializer.name)) {
    throw new Error(`Error "${serializer.name}" is already registered`);
  }
  errorRegistry.set(serializer.name, serializer);
  errorSerializers.push(serializer);
}

/**
 * Internal function to add a context serializer to the registry.
 * Called by registerContext in mod.ts.
 *
 * @internal
 */
export function _addContextSerializer<T, S = unknown>(
  serializer: ContextSerializer<T, S>,
): void {
  if (contextRegistry.has(serializer.name)) {
    throw new Error(`Context "${serializer.name}" is already registered`);
  }
  contextRegistry.set(serializer.name, serializer);
}

/**
 * Reset all registries. Only for testing purposes.
 *
 * @internal
 */
export function resetRegistries(): void {
  typeRegistry.clear();
  typeSerializers.length = 0;
  errorRegistry.clear();
  errorSerializers.length = 0;
  builtInErrorSerializers.clear();
  contextRegistry.clear();
  initializeBuiltInSerializers();
}

function findTypeSerializer(
  value: unknown,
): TypeSerializer<unknown, unknown> | undefined {
  for (const serializer of typeSerializers) {
    if (serializer.is(value)) {
      return serializer;
    }
  }
  return undefined;
}

function findErrorSerializer(
  error: unknown,
): ErrorSerializer<Error> | undefined {
  for (const serializer of errorSerializers) {
    if (serializer.is(error)) {
      return serializer;
    }
  }
  return undefined;
}

/** Hides unexpected server error details outside development, preserving explicit error serializers. */
export function sanitizeServerError(error: unknown): unknown {
  if (
    isDevelopment() || !(error instanceof Error) ||
    error instanceof HttpError || isHttpErrorLike(error)
  ) {
    return error;
  }
  const serializer = findErrorSerializer(error);
  if (serializer && !builtInErrorSerializers.has(serializer)) return error;
  return new HttpError(500, {
    message: new HttpError(500).exposedMessage,
    expose: true,
  });
}

/** Applies server error privacy to deferred plain data before SSR consumes it. */
export function sanitizeServerData<T>(data: T): T {
  if (isThenable(data)) {
    return Promise.resolve(data).then(sanitizeServerData, (error) => {
      throw sanitizeServerError(error);
    }) as T;
  }
  if (
    data === null || typeof data !== "object" ||
    data instanceof Error || isHttpErrorLike(data) || findTypeSerializer(data)
  ) {
    return data;
  }
  if (Array.isArray(data)) return data.map(sanitizeServerData) as T;
  const prototype = Object.getPrototypeOf(data);
  if (prototype !== Object.prototype && prototype !== null) return data;
  return Object.fromEntries(
    Object.entries(data).map((
      [key, value],
    ) => [key, sanitizeServerData(value)]),
  ) as T;
}

export interface ErrorEnvelope extends Record<string, unknown> {
  __errorType: string | null;
  data: Record<string, unknown>;
}

export function serializeError(error: unknown): ErrorEnvelope {
  const serializer = findErrorSerializer(error);
  if (serializer) {
    const data = serializer.serialize(error as Error);
    if (serializer.is(data)) {
      throw new Error(
        `Error serializer "${serializer.name}" output matches its own is predicate`,
      );
    }
    return { __errorType: serializer.name, data };
  }
  if (error instanceof Error) {
    return {
      __errorType: "Error",
      data: {
        message: error.message,
        name: error.name,
        ...(isDevelopment() ? { stack: error.stack } : {}),
      },
    };
  }
  return { __errorType: null, data: { value: error } };
}

export function deserializeError(envelope: Record<string, unknown>): unknown {
  const name = envelope.__errorType;
  const data = envelope.data as Record<string, unknown>;
  if (name === null) return data.value;
  const serializer = errorRegistry.get(name as string);
  if (!serializer) {
    throw new Error(`No deserializer registered for error "${String(name)}"`);
  }
  return serializer.deserialize(data);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null && typeof value === "object" && "then" in value &&
    typeof (value as { then: unknown }).then === "function";
}

function serializeType(
  value: unknown,
  serializer: TypeSerializer<unknown>,
): unknown {
  const data = serializer.serialize(value);
  if (serializer.is(data)) {
    throw new Error(
      `Type serializer "${serializer.name}" output matches its own is predicate`,
    );
  }
  return data;
}

async function processValue(value: unknown): Promise<unknown> {
  if (value === null || value === undefined) return value;
  if (isThenable(value)) {
    try {
      return new Tagged("promise", await processValue(await value));
    } catch (error) {
      return new Tagged(
        "rejected",
        await processValue(serializeError(sanitizeServerError(error))),
      );
    }
  }
  if (value instanceof Error || isHttpErrorLike(value)) {
    return new Tagged("error", await processValue(serializeError(value)));
  }
  const serializer = findTypeSerializer(value);
  if (serializer) {
    return new Tagged("type", {
      __type: serializer.name,
      data: await processValue(serializeType(value, serializer)),
    });
  }
  if (Array.isArray(value)) return await Promise.all(value.map(processValue));
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      defineOwnValue(result, key, await processValue(val));
    }
    return result;
  }
  return value;
}

type PromiseResolvers = Map<string, {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}>;

function restoreValue(value: unknown, pending?: PromiseResolvers): unknown {
  if (value instanceof Tagged) {
    if (value.tag === "pending") {
      if (!pending || typeof value.contents !== "string") {
        throw new Error("Unexpected pending promise tag");
      }
      const existing = pending.get(value.contents);
      if (existing) return existing.promise;
      const resolver = Promise.withResolvers<unknown>();
      resolver.promise.catch(() => {});
      pending.set(value.contents, resolver);
      return resolver.promise;
    }
    if (value.tag === "promise") {
      return Promise.resolve(restoreValue(value.contents, pending));
    }
    if (value.tag === "rejected") {
      const promise = Promise.reject(
        deserializeError(
          restoreValue(value.contents, pending) as Record<string, unknown>,
        ),
      );
      promise.catch(() => {});
      return promise;
    }
    if (value.tag === "type") {
      const { __type, data } = value.contents as {
        __type: string;
        data: unknown;
      };
      const serializer = typeRegistry.get(__type);
      if (!serializer) {
        throw new Error(`No deserializer registered for type "${__type}"`);
      }
      return serializer.deserialize(restoreValue(data, pending));
    }
    if (value.tag === "error") {
      return deserializeError(
        restoreValue(value.contents, pending) as Record<string, unknown>,
      );
    }
    throw new Error(`Unknown tagged JSON tag: ${String(value.tag)}`);
  }
  if (Array.isArray(value)) return value.map((v) => restoreValue(v, pending));
  if (value instanceof Date || value === null) return value;
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      defineOwnValue(result, key, restoreValue(val, pending));
    }
    return result;
  }
  return value;
}

export async function serializeLoaderData(data: unknown): Promise<string> {
  return JSON.stringify(toTaggedJson(await processValue(data)));
}

export function deserializeLoaderData<T = unknown>(data: string): T {
  return restoreValue(fromTaggedJson(JSON.parse(data))) as T;
}

interface PendingPromises {
  nextId: number;
  entries: { id: string; promise: PromiseLike<unknown> }[];
}

function discardPending(pending: PendingPromises): void {
  for (const entry of pending.entries.splice(0)) {
    Promise.resolve(entry.promise).catch(() => {});
  }
}

export function containsPromises(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (isThenable(value)) return true;
  if (typeof value === "object") {
    return Object.values(value).some(containsPromises);
  }
  return false;
}

function processValueForStreaming(
  value: unknown,
  pending: PendingPromises,
): unknown {
  if (value === null || value === undefined) return value;
  if (isThenable(value)) {
    const id = `p${pending.nextId++}`;
    pending.entries.push({ id, promise: value });
    return new Tagged("pending", id);
  }
  if (value instanceof Error || isHttpErrorLike(value)) {
    return new Tagged(
      "error",
      processValueForStreaming(serializeError(value), pending),
    );
  }
  const serializer = findTypeSerializer(value);
  if (serializer) {
    return new Tagged("type", {
      __type: serializer.name,
      data: processValueForStreaming(serializeType(value, serializer), pending),
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => processValueForStreaming(v, pending));
  }
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      defineOwnValue(result, key, processValueForStreaming(val, pending));
    }
    return result;
  }
  return value;
}

interface PromiseResolution {
  id: string;
  status: "resolved" | "rejected";
  value?: unknown;
  error?: unknown;
}

function prepareData(
  data: unknown,
): { processed: unknown; pending: PendingPromises } {
  const pending: PendingPromises = { nextId: 0, entries: [] };
  try {
    return { processed: processValueForStreaming(data, pending), pending };
  } catch (error) {
    discardPending(pending);
    throw error;
  }
}

function createDataStream(
  processed: unknown,
  pending: PendingPromises,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let ready: PromiseResolution[] = [];
  let readIndex = 0;
  let waiting: (() => void) | undefined;
  let outstanding = 0;
  let initial = true;
  let stopped = false;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  function stop(): void {
    stopped = true;
    processed = undefined;
    ready = [];
    signal?.removeEventListener("abort", abort);
    waiting?.();
    waiting = undefined;
  }
  function abort(): void {
    if (stopped) return;
    controller.error(signal!.reason);
    stop();
  }
  function settle(resolution: PromiseResolution): void {
    outstanding--;
    if (stopped) return;
    ready.push(resolution);
    waiting?.();
    waiting = undefined;
  }
  function observePending(): void {
    for (const { id, promise } of pending.entries.splice(0)) {
      outstanding++;
      Promise.resolve(promise).then(
        (value) => settle({ id, status: "resolved", value }),
        (error) => settle({ id, status: "rejected", error }),
      );
    }
  }
  return new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      observePending();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    },
    async pull(c) {
      if (stopped) return;
      try {
        if (initial) {
          initial = false;
          c.enqueue(
            encoder.encode(JSON.stringify(toTaggedJson(processed)) + "\n"),
          );
          processed = undefined;
        } else {
          while (!stopped && readIndex === ready.length && outstanding > 0) {
            const wake = Promise.withResolvers<void>();
            waiting = wake.resolve;
            await wake.promise;
          }
          if (stopped) return;
          const resolution = ready[readIndex++];
          if (resolution) {
            let line: PromiseResolution;
            try {
              line = resolution.status === "resolved"
                ? {
                  id: resolution.id,
                  status: "resolved",
                  value: toTaggedJson(
                    processValueForStreaming(resolution.value, pending),
                  ),
                }
                : {
                  id: resolution.id,
                  status: "rejected",
                  error: toTaggedJson(
                    processValueForStreaming(
                      serializeError(sanitizeServerError(resolution.error)),
                      pending,
                    ),
                  ),
                };
            } catch (error) {
              discardPending(pending);
              try {
                line = {
                  id: resolution.id,
                  status: "rejected",
                  error: toTaggedJson(
                    processValueForStreaming(
                      serializeError(sanitizeServerError(error)),
                      pending,
                    ),
                  ),
                };
              } catch (fallbackError) {
                discardPending(pending);
                throw fallbackError;
              }
            }
            observePending();
            c.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
          }
          if (readIndex >= ready.length) {
            ready = [];
            readIndex = 0;
          }
        }
        if (outstanding === 0 && ready.length === 0) {
          c.close();
          stop();
        }
      } catch (error) {
        c.error(error);
        stop();
      }
    },
    cancel() {
      stop();
    },
  }, { highWaterMark: 0 });
}

export function createStreamingLoaderData(
  data: unknown,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const { processed, pending } = prepareData(data);
  return createDataStream(processed, pending, signal);
}

export function createLoaderDataResponse(
  data: unknown,
  signal?: AbortSignal,
): Response {
  const { processed, pending } = prepareData(data);
  if (pending.entries.length) {
    return new Response(createDataStream(processed, pending, signal), {
      headers: {
        "Content-Type": "application/x-ndjson",
        "X-Juniper": "data",
        "Cache-Control": "no-transform",
      },
    });
  }
  const bytes = new TextEncoder().encode(
    JSON.stringify(toTaggedJson(processed)),
  );
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(bytes.length),
      "X-Juniper": "data",
    },
  });
}

function createLineReader(
  reader: ReadableStreamDefaultReader<string>,
): () => Promise<string | null> {
  let fragments: string[] = [];
  let buffer = "";
  let offset = 0;
  return async () => {
    while (true) {
      const end = buffer.indexOf("\n", offset);
      if (end !== -1) {
        fragments.push(buffer.slice(offset, end));
        const line = fragments.join("");
        fragments = [];
        offset = end + 1;
        return line;
      }
      if (offset < buffer.length) fragments.push(buffer.slice(offset));
      const next = await reader.read();
      if (next.done) {
        const line = fragments.length ? fragments.join("") : null;
        fragments = [];
        buffer = "";
        offset = 0;
        return line;
      }
      buffer = next.value;
      offset = 0;
    }
  };
}

export async function deserializeStreamingLoaderData<T = unknown>(
  response: Response,
): Promise<T> {
  if (!response.body) throw new Error("Empty data response");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const pending: PromiseResolvers = new Map();
  const readLine = createLineReader(reader);
  function rejectPending(error: unknown): void {
    for (const resolver of pending.values()) resolver.reject(error);
    pending.clear();
  }
  let data: unknown;
  try {
    const line = await readLine();
    if (line === null) throw new Error("Empty data response");
    data = restoreValue(fromTaggedJson(JSON.parse(line)), pending);
  } catch (error) {
    rejectPending(error);
    await reader.cancel(error).catch(() => {});
    reader.releaseLock();
    throw error;
  }
  if (!pending.size) {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  } else {
    (async () => {
      try {
        let line: string | null;
        while ((line = await readLine()) !== null) {
          const resolution = JSON.parse(line) as PromiseResolution;
          const resolver = pending.get(resolution.id);
          if (!resolver) continue;
          pending.delete(resolution.id);
          try {
            if (resolution.status === "resolved") {
              resolver.resolve(
                restoreValue(fromTaggedJson(resolution.value), pending),
              );
            } else if (resolution.status === "rejected") {
              resolver.reject(
                deserializeError(
                  restoreValue(
                    fromTaggedJson(resolution.error),
                    pending,
                  ) as Record<string, unknown>,
                ),
              );
            } else {
              throw new Error("Invalid promise resolution status");
            }
          } catch (error) {
            resolver.reject(error);
          }
        }
        if (pending.size) {
          throw new Error(
            "Unexpected end of stream before all promises resolved",
          );
        }
      } catch (error) {
        rejectPending(error);
        await reader.cancel(error).catch(() => {});
      } finally {
        reader.releaseLock();
      }
    })();
  }
  return data as T;
}

/**
 * Serialize all registered context from RouterContextProvider.
 *
 * @param routerContext - The router context provider
 * @returns An object with serialized context values keyed by name
 */
export function serializeAllContext(
  routerContext: RouterContextProvider,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [name, serializer] of contextRegistry) {
    try {
      // deno-lint-ignore no-explicit-any
      const value = routerContext.get(serializer.context as any);
      const data = serializer.serialize(value);
      if (data !== undefined) {
        defineOwnValue(result, name, data);
      }
    } catch {
      continue;
    }
  }

  return result;
}

/**
 * Deserialize all registered context into RouterContextProvider.
 *
 * @param serializedContext - The serialized context object
 * @param routerContext - The router context provider to populate
 */
export function deserializeAllContext(
  serializedContext: Record<string, unknown> | undefined,
  routerContext: RouterContextProvider,
): void {
  for (const [name, serializer] of contextRegistry) {
    const data = serializedContext?.[name];
    const value = serializer.deserialize(data);
    // deno-lint-ignore no-explicit-any
    routerContext.set(serializer.context as any, value);
  }
}

export interface SerializedHydrationData {
  version: 3;
  data: TaggedJson;
}
/**
 * Hydration data structure.
 */
export interface HydrationData {
  /** Public environment variables shared with the client */
  publicEnv?: Record<string, string>;
  /** Serialized context from the server */
  serializedContext?: unknown;
  /** Array of route matches with their IDs */
  matches: { id: string }[];
  /** Route-level errors keyed by route ID */
  errors?: Record<string, unknown>;
  /** Loader data for each route */
  loaderData?: Record<string, unknown>;
  /** Action data for each route */
  actionData?: Record<string, unknown>;
  /**
   * Identifier of the build that produced the document, compared against the
   * `X-Juniper-Build` header on data responses to detect a new deployment.
   * Absent when the server has no build output to identify.
   */
  buildId?: string;
}

function registeredNames(): string[] {
  return [
    ...Array.from(typeRegistry.keys(), (name) => `type:${name}`),
    ...Array.from(errorRegistry.keys(), (name) => `error:${name}`),
    ...Array.from(contextRegistry.keys(), (name) => `context:${name}`),
  ].sort();
}

export async function serializeHydrationData(
  hydrationData: HydrationData,
): Promise<SerializedHydrationData> {
  const { errors, publicEnv, ...rest } = hydrationData;
  const data = {
    ...rest,
    errors: errors && Object.fromEntries(
      Object.entries(errors).map((
        [id, error],
      ) => [id, sanitizeServerError(error)]),
    ),
  };
  const processed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    defineOwnValue(processed, key, await processValue(value));
  }
  defineOwnValue(processed, "publicEnv", publicEnv);
  if (isDevelopment()) {
    defineOwnValue(processed, "registeredNames", registeredNames());
  }
  return { version: 3, data: toTaggedJson(processed) };
}

export function deserializeHydrationData(
  serialized: SerializedHydrationData,
): HydrationData {
  const decoded = decodeHydrationPayload(serialized);
  if (Array.isArray(decoded.registeredNames)) {
    const available = new Set(registeredNames());
    const missing = decoded.registeredNames.filter((name) =>
      !available.has(name)
    );
    if (missing.length) {
      console.error(`Missing Juniper registrations: ${missing.join(", ")}`);
    }
  }
  const restored = restoreValue(decoded) as HydrationData;
  return {
    publicEnv: restored.publicEnv,
    serializedContext: restored.serializedContext,
    buildId: restored.buildId,
    matches: restored.matches,
    errors: restored.errors ?? undefined,
    loaderData: restored.loaderData ?? undefined,
    actionData: restored.actionData ?? undefined,
  };
}

function initializeBuiltInSerializers(): void {
  _addErrorSerializer<HttpError>({
    name: "HttpError",
    is: (e): e is HttpError => e instanceof HttpError || isHttpErrorLike(e),
    serialize: (error) => {
      const serialized: Record<string, unknown> = {
        message: error.exposedMessage,
        status: error.status,
        expose: true,
      };
      if (error.instance !== undefined) serialized.instance = error.instance;
      if (isDevelopment() && error.stack) {
        serialized.stack = error.stack;
      }
      return serialized;
    },
    deserialize: (data) => {
      const error = new HttpError(
        data.status as number,
        {
          message: data.message as string,
          expose: data.expose as boolean | undefined,
        },
      );
      if (data.instance !== undefined) error.instance = data.instance as string;
      if (data.stack) error.stack = data.stack as string;
      return error;
    },
  });

  _addErrorSerializer<TypeError>({
    name: "TypeError",
    is: (e): e is TypeError => e instanceof TypeError,
    serialize: (error) => {
      const serialized: Record<string, unknown> = {
        message: error.message,
      };
      if (isDevelopment()) {
        serialized.stack = error.stack;
      }
      return serialized;
    },
    deserialize: (data) => {
      const error = new TypeError(data.message as string);
      if (data.stack) error.stack = data.stack as string;
      return error;
    },
  });

  _addErrorSerializer<RangeError>({
    name: "RangeError",
    is: (e): e is RangeError => e instanceof RangeError,
    serialize: (error) => {
      const serialized: Record<string, unknown> = {
        message: error.message,
      };
      if (isDevelopment()) {
        serialized.stack = error.stack;
      }
      return serialized;
    },
    deserialize: (data) => {
      const error = new RangeError(data.message as string);
      if (data.stack) error.stack = data.stack as string;
      return error;
    },
  });

  _addErrorSerializer<ReferenceError>({
    name: "ReferenceError",
    is: (e): e is ReferenceError => e instanceof ReferenceError,
    serialize: (error) => {
      const serialized: Record<string, unknown> = {
        message: error.message,
      };
      if (isDevelopment()) {
        serialized.stack = error.stack;
      }
      return serialized;
    },
    deserialize: (data) => {
      const error = new ReferenceError(data.message as string);
      if (data.stack) error.stack = data.stack as string;
      return error;
    },
  });

  _addErrorSerializer<SyntaxError>({
    name: "SyntaxError",
    is: (e): e is SyntaxError => e instanceof SyntaxError,
    serialize: (error) => {
      const serialized: Record<string, unknown> = {
        message: error.message,
      };
      if (isDevelopment()) {
        serialized.stack = error.stack;
      }
      return serialized;
    },
    deserialize: (data) => {
      const error = new SyntaxError(data.message as string);
      if (data.stack) error.stack = data.stack as string;
      return error;
    },
  });

  _addErrorSerializer<URIError>({
    name: "URIError",
    is: (e): e is URIError => e instanceof URIError,
    serialize: (error) => {
      const serialized: Record<string, unknown> = {
        message: error.message,
      };
      if (isDevelopment()) {
        serialized.stack = error.stack;
      }
      return serialized;
    },
    deserialize: (data) => {
      const error = new URIError(data.message as string);
      if (data.stack) error.stack = data.stack as string;
      return error;
    },
  });

  _addErrorSerializer<Error>({
    name: "Error",
    is: (e): e is Error => e instanceof Error && e.constructor === Error,
    serialize: (error) => {
      const serialized: Record<string, unknown> = {
        message: error.message,
      };
      if (isDevelopment()) {
        serialized.stack = error.stack;
      }
      return serialized;
    },
    deserialize: (data) => {
      const error = new Error(data.message as string);
      if (data.stack) error.stack = data.stack as string;
      return error;
    },
  });
  for (const serializer of errorSerializers) {
    builtInErrorSerializers.add(serializer);
  }
}

initializeBuiltInSerializers();
