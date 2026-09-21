import type { ClientGlobals } from "../_client.tsx";
import {
  decodeHydrationPayload,
  isSupportedHydrationVersion,
} from "../_tagged-json.ts";

/** The parts of `document` that `whenParsed` reads. */
export type ParsingDocument = Pick<Document, "readyState" | "addEventListener">;

/**
 * The deferred hydration queue on `scope`, replacing any non-array value —
 * such as an element named by DOM clobbering — with a fresh array.
 */
export function deferredHydrationQueue(scope: ClientGlobals): unknown[] {
  const queue = scope.__juniperDeferredHydration;
  if (Array.isArray(queue)) return queue;
  return scope.__juniperDeferredHydration = [];
}

/** Calls `callback` once `document` has finished parsing; never without a document. */
export function whenParsed(
  document: ParsingDocument | undefined,
  callback: () => void,
): void {
  if (!document) return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

/**
 * Internal environment utilities that can be stubbed for testing.
 *
 * @internal
 */
export const env = {
  isServer: () => {
    const hasDeno = "Deno" in globalThis;
    const hasProcess = "process" in globalThis;
    return hasDeno || hasProcess;
  },
  getEnv: (key: string) => {
    if (env.isServer()) {
      return Deno.env.get(key);
    }
    const payload = env.getHydrationData();
    if (!payload || !isSupportedHydrationVersion(payload.version)) {
      return undefined;
    }
    const publicEnv = decodeHydrationPayload(payload).publicEnv as
      | Record<string, string>
      | undefined;
    return publicEnv && Object.hasOwn(publicEnv, key)
      ? publicEnv[key]
      : undefined;
  },
  getHydrationData: () => {
    return (globalThis as ClientGlobals).__juniperHydrationData;
  },
  getDeferredHydration: (): unknown[] => {
    return deferredHydrationQueue(globalThis as ClientGlobals);
  },
  whenDocumentParsed: (callback: () => void): void => {
    whenParsed(
      typeof document === "undefined" ? undefined : document,
      callback,
    );
  },
};
