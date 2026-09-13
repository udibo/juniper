import type { ClientGlobals } from "../_client.tsx";
import { decodeHydrationPayload } from "../_tagged-json.ts";

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
    if (!payload || payload.version !== 3) return undefined;
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
};
