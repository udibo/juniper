import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { fromFileUrl } from "@std/path";

import {
  type AllowScriptsPolicy,
  findDrift,
  type Finding,
  lockedNpmPackages,
  parsePolicy,
  report,
} from "./allow-scripts.ts";

interface FixturePackage {
  name: string;
  version: string;
  scripts?: Record<string, string>;
  inLock?: boolean;
  manifest?: boolean;
}

const CONFIG = fromFileUrl(new URL("../deno.json", import.meta.url));

const GATE = new URL("./allow-scripts.ts", import.meta.url).href;

async function runGate(
  policy: AllowScriptsPolicy,
  packages: readonly FixturePackage[],
): Promise<{ code: number; output: string }> {
  const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: [
      "eval",
      "--allow-read",
      "--allow-write",
      "--config",
      CONFIG,
      `
import { join } from "node:path";
import { main } from ${JSON.stringify(GATE)};

const policy = ${JSON.stringify(policy)};
const packages = ${JSON.stringify(packages)};
const root = await Deno.makeTempDir({ prefix: "juniper-allow-scripts-" });
await Deno.writeTextFile(
  join(root, "deno.json"),
  JSON.stringify({ allowScripts: policy }),
);
const npm = {};
for (const pkg of packages) {
  if (pkg.inLock === false) continue;
  npm[pkg.name + "@" + pkg.version] = { integrity: "sha512-fixture" };
}
await Deno.writeTextFile(
  join(root, "deno.lock"),
  JSON.stringify({ version: "5", npm }),
);
await Deno.mkdir(join(root, "node_modules", ".deno"), { recursive: true });
for (const pkg of packages) {
  const store = pkg.name.replace("/", "+") + "@" + pkg.version;
  const dir = join(
    root,
    "node_modules",
    ".deno",
    store,
    "node_modules",
    ...pkg.name.split("/"),
  );
  await Deno.mkdir(dir, { recursive: true });
  if (pkg.manifest === false) continue;
  await Deno.writeTextFile(
    join(dir, "package.json"),
    JSON.stringify({
      name: pkg.name,
      version: pkg.version,
      scripts: pkg.scripts ?? {},
    }),
  );
}
if (packages.length === 0) {
  await Deno.remove(join(root, "node_modules"), { recursive: true });
}
let status = 1;
try {
  status = await main(root);
} finally {
  await Deno.remove(root, { recursive: true });
}
Deno.exit(status);
`,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder();
  return { code, output: decoder.decode(stdout) + decoder.decode(stderr) };
}

const DRIFTED: AllowScriptsPolicy = {
  allow: ["npm:esbuild@0.27.2"],
  deny: ["npm:esbuild@0.25.12"],
};

const INSTALLED: readonly FixturePackage[] = [
  {
    name: "esbuild",
    version: "0.25.12",
    scripts: { postinstall: "node install.js" },
  },
  {
    name: "esbuild",
    version: "0.28.1",
    scripts: { postinstall: "node install.js" },
  },
  { name: "hono", version: "4.13.1" },
];

describe("parsePolicy", () => {
  it("reads both lists", () => {
    assertEquals(
      parsePolicy({
        allowScripts: { allow: ["npm:a@1.0.0"], deny: ["npm:b@2.0.0"] },
      }),
      { allow: ["npm:a@1.0.0"], deny: ["npm:b@2.0.0"] },
    );
  });

  it("treats a config with no allowScripts as two empty lists", () => {
    assertEquals(parsePolicy({}), { allow: [], deny: [] });
  });
});

describe("lockedNpmPackages", () => {
  it("collapses peer-resolved copies onto the specifier a policy entry names", () => {
    const locked = lockedNpmPackages({
      npm: {
        "@babel/helper-module-transforms@7.29.7_@babel+core@7.29.7": {},
        "esbuild@0.28.1": {},
      },
    });
    assertEquals(
      [...locked].sort(),
      ["@babel/helper-module-transforms@7.29.7", "esbuild@0.28.1"],
    );
  });
});

describe("findDrift", () => {
  const locked = new Set(["esbuild@0.25.12", "esbuild@0.28.1", "hono@4.13.1"]);
  const scriptBearing = new Map([
    ["esbuild@0.25.12", ["postinstall"]],
    ["esbuild@0.28.1", ["postinstall"]],
  ]);

  it("names the stale entry and the uncovered package", () => {
    assertEquals(
      findDrift(DRIFTED, locked, scriptBearing),
      [
        {
          kind: "stale",
          specifier: "npm:esbuild@0.27.2",
          detail: "allow names a version the lock does not resolve",
        },
        {
          kind: "uncovered",
          specifier: "npm:esbuild@0.28.1",
          detail: "declares postinstall and is in neither list",
        },
      ] satisfies Finding[],
    );
  });

  it("finds nothing once every script-bearing package is denied", () => {
    assertEquals(
      findDrift(
        { allow: [], deny: ["npm:esbuild@0.25.12", "npm:esbuild@0.28.1"] },
        locked,
        scriptBearing,
      ),
      [],
    );
  });

  it("counts an allowed package as covered", () => {
    assertEquals(
      findDrift(
        { allow: ["npm:esbuild@0.28.1"], deny: ["npm:esbuild@0.25.12"] },
        locked,
        scriptBearing,
      ),
      [],
    );
  });

  it("rejects an entry that does not name a version", () => {
    assertEquals(
      findDrift(
        { allow: [], deny: ["npm:esbuild", "esbuild@0.25.12"] },
        locked,
        scriptBearing,
      ).map((f) => [f.kind, f.specifier]),
      [
        ["malformed", "npm:esbuild"],
        ["malformed", "esbuild@0.25.12"],
        ["uncovered", "npm:esbuild@0.25.12"],
        ["uncovered", "npm:esbuild@0.28.1"],
      ],
    );
  });

  it("ignores an installed leftover the lock no longer resolves", () => {
    assertEquals(
      findDrift(
        { allow: [], deny: [] },
        locked,
        new Map([["esbuild@0.18.20", ["postinstall"]]]),
      ),
      [],
    );
  });
});

describe("report", () => {
  it("fails and names both drift directions", () => {
    const { lines, ok } = report(
      findDrift(
        DRIFTED,
        new Set(["esbuild@0.25.12", "esbuild@0.28.1"]),
        new Map([
          ["esbuild@0.25.12", ["postinstall"]],
          ["esbuild@0.28.1", ["postinstall"]],
        ]),
      ),
      2,
    );
    assert(!ok);
    const output = lines.join("\n");
    assertStringIncludes(output, "[stale] npm:esbuild@0.27.2");
    assertStringIncludes(output, "[uncovered] npm:esbuild@0.28.1");
  });

  it("passes and says what it checked", () => {
    const { lines, ok } = report([], 3);
    assert(ok);
    assertStringIncludes(lines.join("\n"), "3 resolved package(s)");
  });
});

describe("the gate against a checkout", () => {
  it("fails on one stale entry and one uncovered package", async () => {
    const { code, output } = await runGate(DRIFTED, INSTALLED);
    assertEquals(code, 1, output);
    assertStringIncludes(output, "[stale] npm:esbuild@0.27.2");
    assertStringIncludes(
      output,
      "[uncovered] npm:esbuild@0.28.1 — declares postinstall",
    );
  });

  it("passes once the deny list matches the lock", async () => {
    const { code, output } = await runGate(
      { allow: [], deny: ["npm:esbuild@0.25.12", "npm:esbuild@0.28.1"] },
      INSTALLED,
    );
    assertEquals(code, 0, output);
    assertStringIncludes(output, "2 resolved package(s)");
  });

  it("reads a scoped package out of its plus-encoded store directory", async () => {
    const { code, output } = await runGate({ allow: [], deny: [] }, [
      {
        name: "@parcel/watcher",
        version: "2.5.4",
        scripts: { install: "node-gyp-build" },
      },
    ]);
    assertEquals(code, 1, output);
    assertStringIncludes(
      output,
      "[uncovered] npm:@parcel/watcher@2.5.4 — declares install",
    );
  });

  it("fails closed when a store entry has no manifest", async () => {
    const { code, output } = await runGate({ allow: [], deny: [] }, [
      { name: "esbuild", version: "0.28.1", manifest: false },
    ]);
    assertEquals(code, 1, output);
    assertStringIncludes(output, "No readable manifest");
  });

  it("fails closed when nothing is installed", async () => {
    const { code, output } = await runGate({ allow: [], deny: [] }, []);
    assertEquals(code, 1, output);
    assertStringIncludes(output, "deno install");
  });
});
