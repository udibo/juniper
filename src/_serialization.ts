/**
 * Internal serialization module using cbor2.
 *
 * This module provides internal implementation for serializing/deserializing
 * custom types, errors, and context between server and client.
 * Public interfaces and registration functions are exported from mod.ts.
 *
 * @internal
 * @module
 */
import { decode, encode, Tag } from "cbor2";
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

// CBOR tag numbers for custom types
// Using high tag numbers to avoid conflicts with standard CBOR tags
const PROMISE_RESOLVED_TAG = 40000;
const PROMISE_REJECTED_TAG = 40001;
const CUSTOM_TYPE_TAG = 40002;
const ERROR_TAG = 40003;
const PROMISE_PENDING_TAG = 40004; // For streaming: placeholder for unresolved promise

// Internal registries
// deno-lint-ignore no-explicit-any
const typeRegistry = new Map<string, TypeSerializer<any, any>>();
// deno-lint-ignore no-explicit-any
const typeSerializers: TypeSerializer<any, any>[] = [];
// deno-lint-ignore no-explicit-any
const errorRegistry = new Map<string, ErrorSerializer<any>>();
// deno-lint-ignore no-explicit-any
const errorSerializers: ErrorSerializer<any>[] = [];
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
  contextRegistry.clear();
  initializeBuiltInSerializers();
}

// Find the matching type serializer for a value
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

// Find the matching error serializer for an error
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

/**
 * Serialize an error using the registered error serializers.
 *
 * @param error - The error to serialize
 * @returns The serialized error data
 */
export function serializeError(error: unknown): Record<string, unknown> {
  const serializer = findErrorSerializer(error);
  if (serializer) {
    return {
      __errorType: serializer.name,
      ...serializer.serialize(error as Error),
    };
  }

  // Fallback for unregistered errors
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      __errorType: "Error",
      message: error.message,
      name: error.name,
    };
    if (isDevelopment()) {
      serialized.stack = error.stack;
    }
    return serialized;
  }

  // Non-Error thrown values
  return { __errorType: "Unknown", value: error };
}

/**
 * Deserialize an error from serialized data.
 *
 * @param data - The serialized error data
 * @returns The deserialized error
 */
export function deserializeError(data: Record<string, unknown>): unknown {
  const errorType = data.__errorType as string;

  const serializer = errorRegistry.get(errorType);
  if (serializer) {
    return serializer.deserialize(data);
  }

  // Fallback: try to create error from name
  if (errorType === "Unknown") {
    return data.value;
  }

  // Create generic Error
  const error = new Error(data.message as string);
  if (data.name) error.name = data.name as string;
  if (data.stack) error.stack = data.stack as string;
  return error;
}

/**
 * Check if a value is a thenable (has a .then method).
 * This is more robust than instanceof Promise for cross-realm promises.
 */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    "then" in value &&
    typeof (value as { then: unknown }).then === "function"
  );
}

/**
 * Recursively process a value to prepare it for CBOR encoding.
 * - Converts Promises to tagged resolved/rejected values
 * - Converts custom types to tagged values
 * - Converts errors to tagged values
 *
 * @param value - The value to process
 * @returns The processed value ready for CBOR encoding
 */
async function processValue(value: unknown): Promise<unknown> {
  if (value === null || value === undefined) {
    return value;
  }

  // Use thenable check instead of instanceof Promise for cross-realm compatibility
  if (isThenable(value)) {
    try {
      const resolved = await value;
      const processedValue = await processValue(resolved);
      return new Tag(PROMISE_RESOLVED_TAG, processedValue);
    } catch (error) {
      return new Tag(PROMISE_REJECTED_TAG, serializeError(error));
    }
  }

  if (value instanceof Error || isHttpErrorLike(value)) {
    return new Tag(ERROR_TAG, serializeError(value));
  }

  // Check for custom types
  const typeSerializer = findTypeSerializer(value);
  if (typeSerializer) {
    return new Tag(CUSTOM_TYPE_TAG, {
      __type: typeSerializer.name,
      data: typeSerializer.serialize(value),
    });
  }

  if (Array.isArray(value)) {
    const processed = await Promise.all(value.map(processValue));
    return processed;
  }

  // Preserve Date objects - CBOR2 handles them natively
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = await processValue(val);
    }
    return result;
  }

  return value;
}

/**
 * Recursively restore values from CBOR decoded data.
 * - Converts tagged promise values back to Promises
 * - Converts tagged custom types back to their original types
 * - Converts tagged errors back to Error objects
 *
 * @param value - The decoded value to restore
 * @returns The restored value
 */
function restoreValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Tag) {
    const tagNum = Number(value.tag);

    if (tagNum === PROMISE_RESOLVED_TAG) {
      const restored = restoreValue(value.contents);
      return Promise.resolve(restored);
    }

    if (tagNum === PROMISE_REJECTED_TAG) {
      const error = deserializeError(value.contents as Record<string, unknown>);
      return Promise.reject(error);
    }

    if (tagNum === CUSTOM_TYPE_TAG) {
      const { __type, data } = value.contents as {
        __type: string;
        data: unknown;
      };
      const serializer = typeRegistry.get(__type);
      if (serializer) {
        return serializer.deserialize(data);
      }
      console.warn(`No deserializer registered for type "${__type}"`);
      return data;
    }

    if (tagNum === ERROR_TAG) {
      return deserializeError(value.contents as Record<string, unknown>);
    }

    // Unknown tag, return contents
    return restoreValue(value.contents);
  }

  if (Array.isArray(value)) {
    return value.map(restoreValue);
  }

  // Preserve Date objects (CBOR2 automatically decodes date tags to Date instances)
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = restoreValue(val);
    }
    return result;
  }

  return value;
}

/**
 * Encode data to CBOR binary format.
 *
 * @param data - The data to encode
 * @returns The CBOR encoded data as Uint8Array
 */
export function cborEncode(data: unknown): Uint8Array {
  return encode(data);
}

/**
 * Decode CBOR binary data.
 *
 * @param data - The CBOR data to decode
 * @returns The decoded data
 */
export function cborDecode<T = unknown>(data: Uint8Array): T {
  return decode(data) as T;
}

/**
 * Serialize loader/action data for client-side data requests.
 * Processes promises, errors, and custom types before CBOR encoding.
 *
 * @param data - The loader/action data to serialize
 * @returns The CBOR encoded data as Uint8Array
 */
export async function serializeLoaderData(data: unknown): Promise<Uint8Array> {
  const processed = await processValue(data);
  return encode(processed);
}

/**
 * Deserialize loader/action data from client-side data requests.
 * Decodes CBOR and restores promises, errors, and custom types from tags.
 *
 * @param data - The CBOR encoded data
 * @returns The deserialized data with promises and custom types restored
 */
export function deserializeLoaderData<T = unknown>(data: Uint8Array): T {
  const decoded = decode(data);
  return restoreValue(decoded) as T;
}

// ============================================================================
// Streaming Serialization (for client-side navigation with deferred data)
// ============================================================================

interface PendingPromise {
  id: string;
  promise: PromiseLike<unknown>;
}

/**
 * Check if a value contains any promises (thenables).
 * Used to determine if streaming should be used.
 */
export function containsPromises(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (isThenable(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsPromises);
  }

  if (typeof value === "object") {
    return Object.values(value).some(containsPromises);
  }

  return false;
}

/**
 * Process a value for streaming, replacing promises with pending tags.
 * Returns the processed structure and a list of pending promises with their IDs.
 */
function processValueForStreaming(
  value: unknown,
  pendingPromises: PendingPromise[],
  idPrefix = "p",
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (isThenable(value)) {
    const id = `${idPrefix}${pendingPromises.length}`;
    pendingPromises.push({ id, promise: value });
    return new Tag(PROMISE_PENDING_TAG, id);
  }

  if (value instanceof Error || isHttpErrorLike(value)) {
    return new Tag(ERROR_TAG, serializeError(value));
  }

  const typeSerializer = findTypeSerializer(value);
  if (typeSerializer) {
    return new Tag(CUSTOM_TYPE_TAG, {
      __type: typeSerializer.name,
      data: typeSerializer.serialize(value),
    });
  }

  if (Array.isArray(value)) {
    return value.map((v, i) =>
      processValueForStreaming(v, pendingPromises, `${idPrefix}${i}_`)
    );
  }

  // Preserve Date objects - CBOR2 handles them natively
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = processValueForStreaming(
        val,
        pendingPromises,
        `${idPrefix}${key}_`,
      );
    }
    return result;
  }

  return value;
}

/**
 * Encode a length-prefixed CBOR chunk.
 * Format: 4-byte big-endian length + CBOR data
 */
function encodeLengthPrefixedChunk(data: unknown): Uint8Array {
  const cborData = encode(data);
  const chunk = new Uint8Array(4 + cborData.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, cborData.length, false); // big-endian
  chunk.set(cborData, 4);
  return chunk;
}

/**
 * Resolution message sent for each resolved/rejected promise.
 */
interface PromiseResolution {
  id: string;
  status: "resolved" | "rejected";
  value?: unknown;
  error?: Record<string, unknown>;
}

/**
 * Create a streaming response for loader data with deferred promises.
 * Returns a ReadableStream that emits length-prefixed CBOR chunks:
 * 1. Initial chunk: data structure with pending promise placeholders
 * 2. Subsequent chunks: promise resolutions as they complete
 *
 * @param data - The loader data (may contain promises)
 * @returns A ReadableStream of CBOR chunks
 */
export function createStreamingLoaderData(
  data: unknown,
): ReadableStream<Uint8Array> {
  const pendingPromises: PendingPromise[] = [];
  const processedData = processValueForStreaming(data, pendingPromises);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // Send initial chunk with structure and pending promise placeholders
      const initialChunk = encodeLengthPrefixedChunk(processedData);
      controller.enqueue(initialChunk);

      if (pendingPromises.length === 0) {
        controller.close();
        return;
      }

      // Process all promises and send resolutions as they complete
      const resolutionPromises = pendingPromises.map(
        async ({ id, promise }) => {
          try {
            const resolved = await promise;
            // Process the resolved value (handle nested custom types, errors, etc.)
            const processedValue = await processValue(resolved);
            const resolution: PromiseResolution = {
              id,
              status: "resolved",
              value: processedValue,
            };
            return encodeLengthPrefixedChunk(resolution);
          } catch (error) {
            const resolution: PromiseResolution = {
              id,
              status: "rejected",
              error: serializeError(error),
            };
            return encodeLengthPrefixedChunk(resolution);
          }
        },
      );

      // Send resolutions as they complete (in completion order for lower latency)
      const remaining = [...resolutionPromises];
      while (remaining.length > 0) {
        const { chunk, index } = await Promise.race(
          remaining.map((p, i) => p.then((chunk) => ({ chunk, index: i }))),
        );
        controller.enqueue(chunk);
        remaining.splice(index, 1);
      }

      controller.close();
    },
  });
}

/**
 * Restore a value from streaming format, wiring up pending promises.
 * Pending promise tags are converted to actual Promises that will be
 * resolved when the corresponding resolution message is received.
 */
function restoreValueWithPendingPromises(
  value: unknown,
  promiseResolvers: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }>,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Tag) {
    const tagNum = Number(value.tag);

    if (tagNum === PROMISE_PENDING_TAG) {
      const id = value.contents as string;
      // Create a promise that will be resolved when we receive the resolution
      const { promise, resolve, reject } = Promise.withResolvers<unknown>();
      promiseResolvers.set(id, { resolve, reject });
      return promise;
    }

    if (tagNum === PROMISE_RESOLVED_TAG) {
      const restored = restoreValueWithPendingPromises(
        value.contents,
        promiseResolvers,
      );
      return Promise.resolve(restored);
    }

    if (tagNum === PROMISE_REJECTED_TAG) {
      const error = deserializeError(value.contents as Record<string, unknown>);
      return Promise.reject(error);
    }

    if (tagNum === CUSTOM_TYPE_TAG) {
      const { __type, data } = value.contents as {
        __type: string;
        data: unknown;
      };
      const serializer = typeRegistry.get(__type);
      if (serializer) {
        return serializer.deserialize(data);
      }
      console.warn(`No deserializer registered for type "${__type}"`);
      return data;
    }

    if (tagNum === ERROR_TAG) {
      return deserializeError(value.contents as Record<string, unknown>);
    }

    return restoreValueWithPendingPromises(value.contents, promiseResolvers);
  }

  if (Array.isArray(value)) {
    return value.map((v) =>
      restoreValueWithPendingPromises(v, promiseResolvers)
    );
  }

  // Preserve Date objects (CBOR2 automatically decodes date tags to Date instances)
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = restoreValueWithPendingPromises(val, promiseResolvers);
    }
    return result;
  }

  return value;
}

/**
 * Read a length-prefixed chunk from a reader.
 * Returns null if end of stream.
 */
async function readLengthPrefixedChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array | null> {
  let buffer = new Uint8Array(0);

  // Read until we have at least 4 bytes for the length
  while (buffer.length < 4) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.length === 0) return null;
      throw new Error("Unexpected end of stream while reading chunk length");
    }
    const newBuffer = new Uint8Array(buffer.length + value.length);
    newBuffer.set(buffer);
    newBuffer.set(value, buffer.length);
    buffer = newBuffer;
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset);
  const length = view.getUint32(0, false); // big-endian

  // Read until we have the full chunk
  while (buffer.length < 4 + length) {
    const { done, value } = await reader.read();
    if (done) {
      throw new Error("Unexpected end of stream while reading chunk data");
    }
    const newBuffer = new Uint8Array(buffer.length + value.length);
    newBuffer.set(buffer);
    newBuffer.set(value, buffer.length);
    buffer = newBuffer;
  }

  const chunkData = buffer.slice(4, 4 + length);

  // If there's leftover data, we need to handle it
  // For simplicity, we assume chunks align with reads (which they should for our use case)
  if (buffer.length > 4 + length) {
    // This shouldn't happen with proper chunking, but let's handle it
    console.warn("Extra data after chunk, this may indicate a protocol issue");
  }

  return chunkData;
}

/**
 * Deserialize streaming loader data from a Response.
 * Reads the stream and returns the data structure with promises that
 * will be resolved as resolution messages arrive.
 *
 * @param response - The streaming Response from the server
 * @returns The deserialized data with live promises
 */
export async function deserializeStreamingLoaderData<T = unknown>(
  response: Response,
): Promise<T> {
  const reader = response.body!.getReader();
  const promiseResolvers = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();

  // Read initial chunk
  const initialChunk = await readLengthPrefixedChunk(reader);
  if (!initialChunk) {
    throw new Error("Empty streaming response");
  }

  const decodedInitial = decode(initialChunk);
  const data = restoreValueWithPendingPromises(
    decodedInitial,
    promiseResolvers,
  );

  // If there are pending promises, start reading resolutions in background
  if (promiseResolvers.size > 0) {
    (async () => {
      try {
        let chunk: Uint8Array | null;
        while ((chunk = await readLengthPrefixedChunk(reader)) !== null) {
          const resolution = decode(chunk) as PromiseResolution;
          const resolver = promiseResolvers.get(resolution.id);
          if (resolver) {
            if (resolution.status === "resolved") {
              // Restore the value (handles nested tags)
              const restoredValue = restoreValue(resolution.value);
              resolver.resolve(restoredValue);
            } else {
              const error = deserializeError(resolution.error!);
              resolver.reject(error);
            }
            promiseResolvers.delete(resolution.id);
          }
        }
      } catch (error) {
        // If stream fails, reject all remaining promises
        for (const resolver of promiseResolvers.values()) {
          resolver.reject(error);
        }
      } finally {
        reader.releaseLock();
      }
    })();
  } else {
    reader.releaseLock();
  }

  return data as T;
}

/**
 * Encode data to a base64 string (for embedding in HTML).
 *
 * @param data - The data to encode
 * @returns The base64 encoded string
 */
export function encodeToBase64(data: unknown): string {
  const bytes = cborEncode(data);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Decode data from a base64 string.
 *
 * @param base64 - The base64 string to decode
 * @returns The decoded data
 */
export function decodeFromBase64<T = unknown>(base64: string): T {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return cborDecode<T>(bytes);
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
        result[name] = data;
      }
    } catch {
      // Context not set, skip
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

/**
 * Serialized hydration data structure using CBOR.
 */
export interface SerializedHydrationData {
  /** Version identifier for compatibility checking */
  version: 2;
  /** Base64 encoded CBOR data */
  data: string;
  /** Public environment variables */
  publicEnv?: Record<string, string>;
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
}

/**
 * Serialize hydration data for embedding in HTML.
 *
 * @param hydrationData - The hydration data to serialize
 * @returns The serialized hydration data
 */
export async function serializeHydrationData(
  hydrationData: HydrationData,
): Promise<SerializedHydrationData> {
  const { publicEnv, ...rest } = hydrationData;

  // Process all values (resolve promises, convert custom types to tags)
  const processedData = await processValue(rest);

  return {
    version: 2,
    data: encodeToBase64(processedData),
    publicEnv,
  };
}

/**
 * Deserialize hydration data from the serialized format.
 *
 * @param serialized - The serialized hydration data
 * @returns The deserialized hydration data
 */
export function deserializeHydrationData(
  serialized: SerializedHydrationData,
): HydrationData {
  // Decode from base64 and CBOR
  const decoded = decodeFromBase64<Record<string, unknown>>(serialized.data);

  // Restore values (convert tags back to original types)
  const restored = restoreValue(decoded) as {
    serializedContext?: unknown;
    matches: { id: string }[];
    errors?: Record<string, unknown> | null;
    loaderData?: Record<string, unknown> | null;
    actionData?: Record<string, unknown> | null;
  };

  return {
    publicEnv: serialized.publicEnv,
    serializedContext: restored.serializedContext,
    matches: restored.matches,
    // Convert null to undefined for React Router compatibility
    errors: restored.errors ?? undefined,
    loaderData: restored.loaderData ?? undefined,
    actionData: restored.actionData ?? undefined,
  };
}

// Initialize built-in error serializers
function initializeBuiltInSerializers(): void {
  // HttpError (must be registered before generic Error)
  _addErrorSerializer<HttpError>({
    name: "HttpError",
    is: (e): e is HttpError => e instanceof HttpError || isHttpErrorLike(e),
    serialize: (error) => {
      const serialized: Record<string, unknown> = {
        message: error.message,
        status: error.status,
      };
      if (error.expose !== undefined) serialized.expose = error.expose;
      if (error.instance !== undefined) serialized.instance = error.instance;
      if (isDevelopment() && error.stack) {
        serialized.stack = error.stack;
      }
      return serialized;
    },
    deserialize: (data) => {
      const error = new HttpError(
        data.status as number,
        data.message as string,
      );
      if (data.expose !== undefined) error.expose = data.expose as boolean;
      if (data.instance !== undefined) error.instance = data.instance as string;
      if (data.stack) error.stack = data.stack as string;
      return error;
    },
  });

  // TypeError
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

  // RangeError
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

  // ReferenceError
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

  // SyntaxError
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

  // URIError
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

  // Generic Error (must be registered last as fallback)
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
}

// Initialize built-in serializers on module load
initializeBuiltInSerializers();
