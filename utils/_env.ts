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
};
