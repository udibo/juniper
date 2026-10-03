import {
  assert,
  assertEquals,
  assertMatch,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { delay } from "@std/async/delay";
import { join } from "@std/path";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";

import { Builder } from "@udibo/juniper/build";

type Entrypoint = "server" | "client";

const routeName = (index: number) =>
  `route_${String(index).padStart(4, "0")}_${"segment".repeat(10)}`;

async function withRoutes(
  count: number,
  run: (builder: Builder) => Promise<void>,
): Promise<void> {
  const projectRoot = await Deno.makeTempDir({ prefix: "juniper formatter " });
  try {
    const routes = join(projectRoot, "routes");
    await Deno.mkdir(routes);
    await Deno.writeTextFile(join(projectRoot, "deno.json"), "{}");
    for (let index = 0; index < count; index++) {
      const name = routeName(index);
      await Deno.writeTextFile(
        join(routes, `${name}.ts`),
        `export const loader = () => ({ index: ${index} });\n`,
      );
      await Deno.writeTextFile(
        join(routes, `${name}.tsx`),
        "export default function Route() { return null; }\n",
      );
    }
    await using builder = new Builder({ projectRoot });
    await run(builder);
  } finally {
    await Deno.remove(projectRoot, { recursive: true });
  }
}

async function closeChild(
  child: Deno.ChildProcess,
  pending: boolean,
  settled: Promise<void>,
): Promise<void> {
  try {
    if (pending) child.kill("SIGTERM");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  await child.status;
  await settled;
  if (!child.stdout.locked) await child.stdout.cancel();
  try {
    if (!child.stderr.locked) await child.stderr.cancel();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
}

async function generate(
  builder: Builder,
  entrypoint: Entrypoint,
  options: {
    malformedInput?: boolean;
    rejectInput?: "write" | "close";
  } = {},
): Promise<void> {
  const children: Deno.ChildProcess[] = [];
  const pending = new Set<Deno.ChildProcess>();
  const inputObservers: Disposable[] = [];
  const spawn = Deno.Command.prototype.spawn;
  using _observer = stub(
    Deno.Command.prototype,
    "spawn",
    function (this: Deno.Command) {
      const child = spawn.call(this);
      children.push(child);
      pending.add(child);
      void child.status.then(() => pending.delete(child));
      if (options.rejectInput || options.malformedInput) {
        const getWriter = child.stdin.getWriter.bind(child.stdin);
        inputObservers.push(stub(child.stdin, "getWriter", () => {
          const writer = getWriter();
          if (options.malformedInput) {
            const write = writer.write.bind(writer);
            inputObservers.push(
              stub(
                writer,
                "write",
                () =>
                  write(new TextEncoder().encode("export const broken = ;\n")),
              ),
            );
            return writer;
          }
          const reject = () => {
            const result = Promise.reject(
              new Error(`owned stdin ${options.rejectInput} failure`),
            );
            void result.catch(() => {});
            return result;
          };
          inputObservers.push(stub(writer, options.rejectInput!, reject));
          return writer;
        }));
      }
      return child;
    },
  );
  const containment = new AbortController();
  const operation = entrypoint === "server"
    ? builder.buildMainServerEntrypoint()
    : builder.buildMainClientEntrypoint();
  let failure: unknown;
  const settled = operation.catch((error) => {
    failure = error;
  });
  try {
    const outcome = await Promise.race([
      settled.then(() => "settled"),
      delay(10_000, { signal: containment.signal }).then(() => "deadline"),
    ]);
    assertEquals(outcome, "settled", "the owned formatter must finish");
    if (failure) throw failure;
    assertEquals(children.length, 1);
    assertEquals(pending.size, 0);
  } finally {
    containment.abort();
    for (const child of children) {
      await closeChild(child, pending.has(child), settled);
    }
    await settled;
    for (const inputObserver of inputObservers.reverse()) {
      inputObserver[Symbol.dispose]();
    }
  }
}

describe("Builder formatter ownership", () => {
  for (const entrypoint of ["server", "client"] as const) {
    for (const count of [2, 512]) {
      it(`${entrypoint} generation formats all ${count} actual route pairs`, async () => {
        await withRoutes(count, async (builder) => {
          await generate(builder, entrypoint);
          const artifact = await Deno.readTextFile(
            entrypoint === "server" ? builder.serverPath : builder.clientPath,
          );
          assertStringIncludes(artifact, routeName(0));
          assertStringIncludes(artifact, routeName(count - 1));
          assertEquals((artifact.match(/\bpath:/g) ?? []).length, count + 1);
          assertStringIncludes(
            artifact,
            entrypoint === "server" ? "createServer" : "new Client",
          );
        });
      });
    }
  }
});

describe("Builder formatter failure ownership", () => {
  for (const entrypoint of ["server", "client"] as const) {
    it(`${entrypoint} preserves genuine formatter diagnostics and an existing artifact on nonzero exit`, async () => {
      await withRoutes(2, async (builder) => {
        const artifactPath = entrypoint === "server"
          ? builder.serverPath
          : builder.clientPath;
        await Deno.writeTextFile(artifactPath, "existing artifact\n");
        const error = await assertRejects(
          () =>
            generate(builder, entrypoint, {
              malformedInput: true,
            }),
          Error,
          `Failed to format generated main ${entrypoint} file: 1`,
        );
        assert(error.cause instanceof Error);
        assertMatch(error.cause.message, /Syntax\s?Error/i);
        assertEquals(
          await Deno.readTextFile(artifactPath),
          "existing artifact\n",
        );
      });
    });

    for (const rejectInput of ["write", "close"] as const) {
      it(`${entrypoint} joins formatter resources after an input ${rejectInput} failure`, async () => {
        await withRoutes(2, async (builder) => {
          const artifactPath = entrypoint === "server"
            ? builder.serverPath
            : builder.clientPath;
          await Deno.writeTextFile(artifactPath, "existing artifact\n");
          await assertRejects(
            () => generate(builder, entrypoint, { rejectInput }),
            Error,
            `owned stdin ${rejectInput} failure`,
          );
          assertEquals(
            await Deno.readTextFile(artifactPath),
            "existing artifact\n",
          );
        });
      });
    }
  }
});
