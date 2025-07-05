/**
 * Internal environment utilities that can be stubbed for testing.
 *
 * @internal
 */
export const env = {
  isServer: () => "Deno" in globalThis || "process" in globalThis,
};
