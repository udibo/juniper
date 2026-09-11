import { brotliCompressSync, constants } from "node:zlib";

import {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertInstanceOf,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { Client } from "@udibo/juniper/client";
import type { RouteProps } from "@udibo/juniper";
import { createServer } from "@udibo/juniper/server";

import {
  cborDecode,
  deserializeHydrationData,
  encodeToBase64,
  fromTaggedJson,
  type SerializedHydrationData,
  type SerializedHydrationDataV3,
} from "./_serialization.ts";

const HYDRATION_ASSIGNMENT =
  /window\.__juniperHydrationData = (.*?); await client\.hydrate\(\);/;

function serverWithLoaderData(loaderData: unknown) {
  const client = new Client({
    path: "/",
    main: { default: () => <div>Home</div> },
  });
  return createServer(import.meta.url, client, {
    path: "/",
    main: { loader: () => loaderData },
  });
}

function scriptBodyContaining(html: string, marker: string): string {
  const markerAt = html.indexOf(marker);
  assert(markerAt >= 0, `the document carries no ${marker}`);
  const bodyStart = html.lastIndexOf(">", markerAt) + 1;
  const bodyEnd = html.toLowerCase().indexOf("</script", bodyStart);
  return html.slice(bodyStart, bodyEnd);
}

describe("the document's hydration payload", () => {
  const hostile =
    "</script><script>globalThis.pwned=1</script><!--<script></SCRIPT >\u2028\u2029";

  it("keeps hostile loader text inside the hydration script", async () => {
    const server = serverWithLoaderData({ text: hostile });
    const html = await (await server.request("http://localhost/")).text();

    const body = scriptBodyContaining(html, "window.__juniperHydrationData");
    assert(
      body.startsWith('import { client } from "/build/main.js";'),
      "the script element opens with the hydration statement",
    );
    assert(
      body.endsWith("; await client.hydrate();"),
      "the first </script the HTML parser sees is the one Juniper wrote",
    );
    assertFalse(body.includes("<"));
    assertFalse(body.includes("\u2028"));
    assertFalse(body.includes("\u2029"));

    const payload = HYDRATION_ASSIGNMENT.exec(body)?.[1];
    assertExists(payload);
    const serialized = JSON.parse(payload) as SerializedHydrationData;
    assertEquals(serialized.version, 3);
    assertEquals(
      deserializeHydrationData(serialized).loaderData?.["/"],
      { text: hostile },
    );
  });
});

describe("data requests", () => {
  it("still answer in CBOR, with its native types rather than JSON tags", async () => {
    const server = serverWithLoaderData({
      at: new Date(0),
      missing: undefined,
    });
    const res = await server.request("http://localhost/", {
      headers: { "X-Juniper-Route-Id": "/" },
    });
    assertEquals(res.headers.get("content-type"), "application/cbor");
    const data = cborDecode<Record<string, unknown>>(
      new Uint8Array(await res.arrayBuffer()),
    );
    assertInstanceOf(data.at, Date);
    assertEquals(data.at.getTime(), 0);
    assert(Object.hasOwn(data, "missing") && data.missing === undefined);
  });

  it("still stream deferred data as CBOR chunks", async () => {
    const server = serverWithLoaderData({ later: Promise.resolve(1) });
    const res = await server.request("http://localhost/", {
      headers: { "X-Juniper-Route-Id": "/" },
    });
    assertEquals(res.headers.get("content-type"), "application/cbor-stream");
    await res.body?.cancel();
  });
});

function brotli(text: string): number {
  return brotliCompressSync(new TextEncoder().encode(text), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
  }).length;
}

describe("what a prose page costs to send", () => {
  it("compresses smaller with version 3 than with version 2", async () => {
    const prose = await Deno.readTextFile(
      new URL("../docs/routing.md", import.meta.url),
    );
    const paragraphs = prose.split(/\n{2,}/).filter((part) => part.trim());
    const client = new Client({
      path: "/",
      main: {
        default: ({ loaderData }: RouteProps) => (
          <article>
            {(loaderData as { paragraphs: string[] }).paragraphs.map((
              paragraph,
              index,
            ) => <p key={index}>{paragraph}</p>)}
          </article>
        ),
      },
    });
    const server = createServer(import.meta.url, client, {
      path: "/",
      main: { loader: () => ({ paragraphs }) },
    });
    const html = await (await server.request("http://localhost/")).text();

    const script = /<script[^>]*>import \{ client \}[\s\S]*?<\/script>/.exec(
      html,
    )?.[0];
    assertExists(script);
    const v3Text = HYDRATION_ASSIGNMENT.exec(script)?.[1];
    assertExists(v3Text);
    const v3 = JSON.parse(v3Text) as SerializedHydrationDataV3;
    const v2 = {
      version: 2 as const,
      data: encodeToBase64(fromTaggedJson(v3.data)),
      publicEnv: v3.publicEnv,
    };
    assertEquals(
      deserializeHydrationData(v2).loaderData,
      deserializeHydrationData(v3).loaderData,
      "both documents carry the same page",
    );
    const v2Html = html.replace(
      v3Text,
      () => JSON.stringify(v2).replaceAll("<", "\\u003c"),
    );
    const markup = brotli(html.replace(script, ""));
    const v3Ratio = brotli(html) / markup;
    const v2Ratio = brotli(v2Html) / markup;

    assert(
      v3Ratio < v2Ratio,
      `version 3 ships ${v3Ratio.toFixed(3)}x its markup in brotli against ${
        v2Ratio.toFixed(3)
      }x for version 2`,
    );
  });
});
