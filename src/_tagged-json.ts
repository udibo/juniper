/** The tagged JSON codec shared by document hydration and data responses. @module */
export type TaggedJson =
  | null
  | boolean
  | number
  | string
  | TaggedJson[]
  | { [key: string]: TaggedJson };

type ValueTag = "pending" | "promise" | "rejected" | "type" | "error";

export class Tagged {
  constructor(public tag: ValueTag, public contents: unknown) {}
}

export function defineOwnValue(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function tagged(tag: string, value?: TaggedJson): TaggedJson {
  return value === undefined ? { $t: tag } : { $t: tag, v: value };
}

function numberToTaggedJson(value: number): TaggedJson {
  if (Number.isNaN(value)) return tagged("number", "NaN");
  if (value === Infinity) return tagged("number", "Infinity");
  if (value === -Infinity) return tagged("number", "-Infinity");
  if (Object.is(value, -0)) return tagged("number", "-0");
  return value;
}

export function toTaggedJson(value: unknown): TaggedJson {
  if (value === undefined) return tagged("undefined");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.toWellFormed();
  if (typeof value === "number") return numberToTaggedJson(value);
  if (typeof value === "bigint") return tagged("bigint", value.toString());
  if (typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Cannot serialize a ${typeof value} value`);
  }
  if (value instanceof Tagged) {
    return tagged(value.tag, toTaggedJson(value.contents));
  }
  if (value instanceof Date) {
    return tagged("Date", numberToTaggedJson(value.getTime()));
  }
  if (Array.isArray(value)) return Array.from(value, toTaggedJson);
  const entries = Object.entries(value as Record<string, unknown>).map((
    [key, entry],
  ): [string, TaggedJson] => [key.toWellFormed(), toTaggedJson(entry)]);
  if (entries.some(([key]) => key === "$t" || key === "__proto__")) {
    return tagged("object", entries);
  }
  return Object.fromEntries(entries);
}

function objectFromEntries(entries: unknown): Record<string, unknown> {
  if (!Array.isArray(entries)) throw new Error("Invalid object tag entries");
  const result: Record<string, unknown> = {};
  for (const entry of entries) {
    if (
      !Array.isArray(entry) || entry.length !== 2 ||
      typeof entry[0] !== "string"
    ) {
      throw new Error("Invalid object tag entry");
    }
    defineOwnValue(result, entry[0], fromTaggedJson(entry[1]));
  }
  return result;
}

function fromTag(tag: unknown, value: unknown): unknown {
  switch (tag) {
    case "undefined":
      return undefined;
    case "number":
      if (!["NaN", "Infinity", "-Infinity", "-0"].includes(value as string)) {
        throw new Error("Invalid number tag");
      }
      return Number(value);
    case "bigint":
      if (typeof value !== "string" || !/^-?\d+$/.test(value)) {
        throw new Error("Invalid bigint tag");
      }
      return BigInt(value);
    case "Date": {
      const time = fromTaggedJson(value);
      if (typeof time !== "number") throw new Error("Invalid Date tag");
      return new Date(time);
    }
    case "object":
      return objectFromEntries(value);
    case "pending":
    case "promise":
    case "rejected":
    case "type":
    case "error":
      return new Tagged(tag, fromTaggedJson(value));
  }
  throw new Error(`Unknown tagged JSON tag: ${String(tag)}`);
}

export function fromTaggedJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(fromTaggedJson);
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, "$t")) return fromTag(record.$t, record.v);
  return objectFromEntries(Object.entries(record));
}

export function toInlineScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

const hydrationPayloads = new WeakMap<object, Record<string, unknown>>();

/**
 * Hydration payload versions this client decodes: 3 carries only settled
 * values, and 4 may carry pending placeholders resolved by later scripts.
 */
export function isSupportedHydrationVersion(version: unknown): boolean {
  return version === 3 || version === 4;
}

export function decodeHydrationPayload(
  serialized: { version: number; data: unknown },
): Record<string, unknown> {
  if (!isSupportedHydrationVersion(serialized.version)) {
    throw new Error(
      `Unsupported hydration data version: ${String(serialized.version)}`,
    );
  }
  const cached = hydrationPayloads.get(serialized);
  if (cached) return cached;
  const decoded = fromTaggedJson(serialized.data);
  if (
    !decoded || typeof decoded !== "object" || Array.isArray(decoded) ||
    decoded instanceof Tagged
  ) {
    throw new Error("Invalid hydration data");
  }
  hydrationPayloads.set(serialized, decoded as Record<string, unknown>);
  return decoded as Record<string, unknown>;
}
