import type { ClientGlobals, SerializedHydrationData } from "../_client.tsx";

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
  getHydrationData: () => {
    return (globalThis as ClientGlobals).__juniperHydrationData;
  },
  setHydrationData: (data: SerializedHydrationData | undefined) => {
    if (data === undefined) {
      delete (globalThis as ClientGlobals).__juniperHydrationData;
    } else {
      (globalThis as ClientGlobals).__juniperHydrationData = data;
    }
  },
};
