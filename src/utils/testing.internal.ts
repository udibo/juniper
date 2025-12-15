import { AsyncLocalStorage } from "node:async_hooks";

import type { HydrationData, SerializedHydrationData } from "../_client.tsx";
import {
  DEFAULT_PUBLIC_ENV_KEYS,
  serializeHydrationData,
} from "../_server.tsx";
import { env } from "./_env.ts";

interface HydrationDataStore {
  hydrationData: SerializedHydrationData;
}

const hydrationDataStorage = new AsyncLocalStorage<HydrationDataStore>();

const originalGetHydrationData = env.getHydrationData;
const originalIsServer = env.isServer;

function patchedGetHydrationData(): SerializedHydrationData | undefined {
  const store = hydrationDataStorage.getStore();
  if (store !== undefined) {
    return store.hydrationData;
  }
  return originalGetHydrationData();
}

function patchedIsServer(): boolean {
  const store = hydrationDataStorage.getStore();
  if (store !== undefined) {
    return false;
  }
  return originalIsServer();
}

export interface SimulateBrowserOptions {
  serializeError?: (error: unknown) => unknown;
  publicEnvKeys?: string[];
}

export function simulateBrowser<T extends void | Promise<void>>(
  callback: () => T,
): () => Promise<void>;
export function simulateBrowser<T extends void | Promise<void>>(
  options: SimulateBrowserOptions,
  callback: () => T,
): () => Promise<void>;
export function simulateBrowser<T extends void | Promise<void>>(
  hydrationData: HydrationData,
  callback: () => T,
): () => Promise<void>;
export function simulateBrowser<T extends void | Promise<void>>(
  hydrationData: HydrationData,
  options: SimulateBrowserOptions,
  callback: () => T,
): () => Promise<void>;
export function simulateBrowser<T extends void | Promise<void>>(
  hydrationDataOrOptionsOrCallback:
    | HydrationData
    | SimulateBrowserOptions
    | (() => T),
  optionsOrCallback?: SimulateBrowserOptions | (() => T),
  maybeCallback?: () => T,
): () => Promise<void> {
  let hydrationData: HydrationData;
  let options: SimulateBrowserOptions;
  let callback: () => T;

  if (typeof hydrationDataOrOptionsOrCallback === "function") {
    hydrationData = { matches: [] };
    options = {};
    callback = hydrationDataOrOptionsOrCallback;
  } else if (typeof optionsOrCallback === "function") {
    if ("matches" in hydrationDataOrOptionsOrCallback) {
      hydrationData = hydrationDataOrOptionsOrCallback;
      options = {};
    } else {
      hydrationData = { matches: [] };
      options = hydrationDataOrOptionsOrCallback;
    }
    callback = optionsOrCallback;
  } else {
    hydrationData = hydrationDataOrOptionsOrCallback as HydrationData;
    options = optionsOrCallback as SimulateBrowserOptions;
    callback = maybeCallback!;
  }

  return async () => {
    const allPublicEnvKeys = [
      ...new Set([
        ...DEFAULT_PUBLIC_ENV_KEYS,
        ...(options.publicEnvKeys ?? []),
      ]),
    ];
    const publicEnv: Record<string, string> = {};
    for (const key of allPublicEnvKeys) {
      const value = env.getEnv(key);
      if (value !== undefined) {
        publicEnv[key] = value;
      }
    }
    const serializedHydrationData = await serializeHydrationData(
      {
        ...hydrationData,
        publicEnv: { ...publicEnv, ...hydrationData.publicEnv },
      },
      { serializeError: options.serializeError },
    );

    const store: HydrationDataStore = {
      hydrationData: serializedHydrationData,
    };

    if (env.getHydrationData !== patchedGetHydrationData) {
      env.getHydrationData = patchedGetHydrationData;
    }
    if (env.isServer !== patchedIsServer) {
      env.isServer = patchedIsServer;
    }

    await hydrationDataStorage.run(store, () => callback());
  };
}
