/**
 * Checks install-script decisions against the lockfile and installed packages.
 *
 * Run `deno install --frozen` first, then `deno task allow-scripts` to detect
 * stale policy entries and installed lifecycle scripts without a decision.
 * The gate is also part of `deno task check`.
 *
 * @module
 */
import { dirname, fromFileUrl, join } from "@std/path";

const LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall"] as const;

const STORE_DIR = ".deno";

const STORE_HOIST_DIR = "node_modules";

const REPO_ROOT = dirname(dirname(fromFileUrl(import.meta.url)));

/** `deno.json`'s `allowScripts`, as its two lists of `npm:name@version`. */
export interface AllowScriptsPolicy {
  allow: readonly string[];
  deny: readonly string[];
}

/** What kind of disagreement a {@linkcode Finding} records. */
export type FindingKind = "malformed" | "stale" | "uncovered";

/** One disagreement between `allowScripts` and what the lock resolves. */
export interface Finding {
  kind: FindingKind;
  specifier: string;
  detail: string;
}

/**
 * Reads `allowScripts` out of a parsed `deno.json`, tolerating its absence.
 *
 * Non-string list members are dropped rather than trusted: they cannot name a
 * package, so {@linkcode findDrift} never sees them.
 */
export function parsePolicy(config: unknown): AllowScriptsPolicy {
  const raw = (config as { allowScripts?: { allow?: unknown; deny?: unknown } })
    ?.allowScripts;
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((e) => typeof e === "string") : [];
  return { allow: strings(raw?.allow), deny: strings(raw?.deny) };
}

function withoutPeerSuffix(key: string): string {
  const version = key.indexOf("@", 1);
  if (version === -1) return key;
  const peers = key.indexOf("_", version);
  return peers === -1 ? key : key.slice(0, peers);
}

/**
 * Every `name@version` the lock's `npm` section resolves, with deno's peer
 * suffixes (`pkg@1.0.0_peer@2.0.0`) stripped so a package resolved under
 * several peer sets collapses to the one specifier a policy entry can name.
 */
export function lockedNpmPackages(lock: unknown): Set<string> {
  const npm = (lock as { npm?: Record<string, unknown> })?.npm ?? {};
  return new Set(Object.keys(npm).map(withoutPeerSuffix));
}

function packageNameFromStoreDir(entry: string): string | undefined {
  const base = withoutPeerSuffix(entry);
  const version = base.indexOf("@", 1);
  if (version === -1) return undefined;
  const name = base.slice(0, version);
  return name.startsWith("@") ? name.replace("+", "/") : name;
}

/**
 * The installed packages declaring a preinstall, install, or postinstall
 * script, mapped to the script names each declares.
 *
 * Reads lifecycle script names from installed manifests in deno's
 * `node_modules/.deno` store. Platform-specific packages are checked on the
 * platforms where they are installed.
 *
 * @throws {Error} When the store cannot be read (nothing installed) or a store
 * entry has no readable manifest, which would mean deno's layout changed. Both
 * fail the gate rather than letting it pass on a short scan.
 */
export async function scriptBearingPackages(
  nodeModulesDir: string,
): Promise<Map<string, string[]>> {
  const store = join(nodeModulesDir, STORE_DIR);
  let entries: Deno.DirEntry[];
  try {
    entries = await Array.fromAsync(Deno.readDir(store));
  } catch {
    throw new Error(
      `Cannot read ${store}. Run \`deno install\` (CI runs \`deno ci\`) before ` +
        "this gate — it reads install scripts off the installed tree.",
    );
  }
  const found = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.isDirectory || entry.name === STORE_HOIST_DIR) continue;
    const name = packageNameFromStoreDir(entry.name);
    let manifest: { name?: string; version?: string; scripts?: unknown };
    try {
      manifest = JSON.parse(
        await Deno.readTextFile(
          join(
            store,
            entry.name,
            STORE_HOIST_DIR,
            ...name!.split("/"),
            "package.json",
          ),
        ),
      );
    } catch {
      throw new Error(
        `No readable manifest for ${join(store, entry.name)}. deno's ` +
          "node_modules layout likely changed; update scripts/allow-scripts.ts " +
          "rather than skipping the entry.",
      );
    }
    const scripts = (manifest.scripts ?? {}) as Record<string, unknown>;
    const declared = LIFECYCLE_SCRIPTS.filter((script) => script in scripts);
    if (declared.length === 0) continue;
    found.set(`${manifest.name}@${manifest.version}`, declared);
  }
  return found;
}

/**
 * Every disagreement between the policy and what the lock resolves, in report
 * order: malformed entries, then stale ones, then uncovered packages.
 *
 * @param policy `allowScripts` as {@linkcode parsePolicy} read it.
 * @param locked `name@version` the lock resolves, from
 * {@linkcode lockedNpmPackages}.
 * @param scriptBearing Installed packages declaring install scripts, from
 * {@linkcode scriptBearingPackages}.
 */
export function findDrift(
  policy: AllowScriptsPolicy,
  locked: ReadonlySet<string>,
  scriptBearing: ReadonlyMap<string, string[]>,
): Finding[] {
  const findings: Finding[] = [];
  const covered = new Set<string>();
  const lists = [
    ["allow", policy.allow],
    ["deny", policy.deny],
  ] as const;
  for (const [list, entries] of lists) {
    for (const specifier of entries) {
      const pkg = specifier.startsWith("npm:")
        ? specifier.slice("npm:".length)
        : undefined;
      if (pkg === undefined || pkg.indexOf("@", 1) === -1) {
        findings.push({
          kind: "malformed",
          specifier,
          detail: `${list} entry is not an \`npm:name@version\` specifier`,
        });
        continue;
      }
      covered.add(pkg);
      if (!locked.has(pkg)) {
        findings.push({
          kind: "stale",
          specifier,
          detail: `${list} names a version the lock does not resolve`,
        });
      }
    }
  }
  for (const [pkg, scripts] of scriptBearing) {
    if (covered.has(pkg) || !locked.has(pkg)) continue;
    findings.push({
      kind: "uncovered",
      specifier: `npm:${pkg}`,
      detail: `declares ${scripts.join(", ")} and is in neither list`,
    });
  }
  return findings;
}

/** The gate's output lines and its verdict. */
export interface Report {
  lines: string[];
  ok: boolean;
}

/**
 * Turns findings into the lines the gate prints and the pass/fail it returns.
 *
 * A clean run still prints what it checked, so a green gate says what it looked
 * at rather than only that it looked.
 */
export function report(
  findings: readonly Finding[],
  scriptBearingCount: number,
): Report {
  if (findings.length === 0) {
    return {
      lines: [
        `allowScripts matches deno.lock: ${scriptBearingCount} resolved ` +
        "package(s) declare install scripts, each named in allow or deny.",
      ],
      ok: true,
    };
  }
  return {
    lines: [
      "allowScripts in deno.json has drifted from deno.lock:",
      ...findings.map((f) => `  [${f.kind}] ${f.specifier} — ${f.detail}`),
      "Drop entries the lock no longer resolves, and decide allow or deny for " +
      "each uncovered package. Denying an install script is the default; " +
      "allowing one is a security decision, not upkeep.",
    ],
    ok: false,
  };
}

/**
 * Runs the gate against a checkout.
 *
 * @param root Repository root holding `deno.json`, `deno.lock`, and
 * `node_modules`. Defaults to this script's own repository.
 * @returns The process exit code — 0 when the policy matches the lock, 1
 * otherwise.
 */
export async function main(root: string = REPO_ROOT): Promise<number> {
  let findings: Finding[];
  let scriptBearingCount: number;
  try {
    const config = JSON.parse(await Deno.readTextFile(join(root, "deno.json")));
    const lock = JSON.parse(await Deno.readTextFile(join(root, "deno.lock")));
    const scriptBearing = await scriptBearingPackages(
      join(root, "node_modules"),
    );
    scriptBearingCount = scriptBearing.size;
    findings = findDrift(
      parsePolicy(config),
      lockedNpmPackages(lock),
      scriptBearing,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const { lines, ok } = report(findings, scriptBearingCount);
  for (const line of lines) console.log(line);
  return ok ? 0 : 1;
}

if (import.meta.main) Deno.exit(await main());
