import {
  assertEquals,
  assertExists,
  assertFalse,
  assertInstanceOf,
  assertStringIncludes,
} from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { Suspense } from "react";
import { Await, useAsyncError } from "react-router";

import { Client } from "@udibo/juniper/client";
import { HttpError, registerError } from "@udibo/juniper";
import type { ErrorBoundaryProps, RouteProps } from "@udibo/juniper";
import { createServer } from "@udibo/juniper/server";
import { simulateEnvironment } from "@udibo/juniper/utils/testing";

import {
  createStreamingLoaderData,
  deserializeHydrationData,
  deserializeStreamingLoaderData,
  resetRegistries,
  serializeHydrationData,
} from "./_serialization.ts";

class PrivateError extends Error {}
class PublicError extends Error {}

describe("server error privacy", () => {
  beforeEach(() => {
    resetRegistries();
    registerError<PublicError>({
      name: "PublicError",
      is: (error): error is PublicError => error instanceof PublicError,
      serialize: (error) => ({ message: error.message }),
      deserialize: (data) => new PublicError(data.message as string),
    });
  });
  afterEach(resetRegistries);

  for (const environment of ["production", "development"]) {
    for (const transport of ["hydration", "stream"]) {
      for (const ErrorType of [Error, TypeError, PrivateError, PublicError]) {
        it(
          `${transport} protects ${ErrorType.name} rejections in ${environment}`,
          simulateEnvironment({ APP_ENV: environment }, async () => {
            const original = new ErrorType("private-database-probe");
            const data = {
              failure: Promise.reject(original),
              returned: new Error("intentional-public-error"),
            };
            let restored: typeof data;
            let routeError: unknown;
            if (transport === "hydration") {
              const serialized = await serializeHydrationData({
                matches: [{ id: "/" }],
                loaderData: { "/": data },
                errors: { "/": original },
              });
              const hydration = deserializeHydrationData(serialized);
              restored = hydration.loaderData?.["/"] as typeof data;
              routeError = hydration.errors?.["/"];
            } else {
              restored = await deserializeStreamingLoaderData<typeof data>(
                new Response(createStreamingLoaderData(data)),
              );
            }
            const error = await restored.failure.catch((error: unknown) =>
              error
            );
            assertInstanceOf(error, Error);
            const privateFailure = environment === "production" &&
              ErrorType !== PublicError;
            assertEquals(
              error.message,
              privateFailure
                ? new HttpError(500).exposedMessage
                : original.message,
            );
            if (transport === "hydration") {
              assertInstanceOf(routeError, Error);
              assertEquals(routeError.message, error.message);
            }
            if (privateFailure) assertInstanceOf(error, HttpError);
            if (environment === "development" && ErrorType !== PublicError) {
              assertEquals(error.stack, original.stack);
            }
            assertEquals(restored.returned.message, "intentional-public-error");
          }),
        );
      }
    }

    it(
      `protects immediate SSR errors in ${environment}`,
      simulateEnvironment({ APP_ENV: environment }, async () => {
        using _console = stub(console, "error");
        const client = new Client({
          path: "/",
          main: {
            default: () => <div>Home</div>,
            ErrorBoundary: ({ error }: ErrorBoundaryProps) => (
              <div>{(error as Error).message}</div>
            ),
          },
        });
        const server = createServer(import.meta.url, client, {
          path: "/",
          main: {
            loader: () => {
              throw new Error("private-database-probe");
            },
          },
        });
        const response = await server.request("http://localhost/");
        const html = await response.text();
        assertEquals(response.status, 500);
        const match = html.match(
          /window\.__juniperHydrationData = (.*?); await client\.hydrate\(\);/,
        );
        assertExists(match);
        const hydration = deserializeHydrationData(JSON.parse(match[1]));
        const error = hydration.errors?.["/"];
        assertInstanceOf(error, Error);
        if (environment === "production") {
          assertFalse(html.includes("private-database-probe"));
          assertEquals(error.message, new HttpError(500).exposedMessage);
        } else {
          assertStringIncludes(html, "private-database-probe");
          assertEquals(error.message, "private-database-probe");
        }
      }),
    );
  }

  for (const transport of ["hydration", "stream"]) {
    it(
      `${transport} respects explicit HttpError exposure for rejected promises`,
      simulateEnvironment({ APP_ENV: "production" }, async () => {
        for (
          const original of [
            new HttpError(500, "private-database-probe"),
            new HttpError(400, "Correct the submitted value"),
            new HttpError(500, {
              message: "Service unavailable",
              expose: true,
            }),
          ]
        ) {
          const data = { failure: Promise.reject(original) };
          const restored = transport === "stream"
            ? await deserializeStreamingLoaderData<typeof data>(
              new Response(createStreamingLoaderData(data)),
            )
            : deserializeHydrationData(
              await serializeHydrationData({
                matches: [{ id: "/" }],
                loaderData: { "/": data },
              }),
            ).loaderData?.["/"] as typeof data;
          const error = await restored.failure.catch((error: unknown) => error);
          assertInstanceOf(error, HttpError);
          assertEquals(error.status, original.status);
          assertEquals(error.message, original.exposedMessage);
        }
      }),
    );
  }

  for (const ErrorType of [Error, PublicError]) {
    it(
      `protects deferred SSR rendering for ${ErrorType.name}`,
      simulateEnvironment({ APP_ENV: "production" }, async () => {
        function DeferredError() {
          const error = useAsyncError() as Error;
          return <div>{error.message}</div>;
        }
        const client = new Client({
          path: "/",
          main: {
            default: (
              { loaderData }: RouteProps,
            ) => (
              <Suspense fallback={<div>Loading</div>}>
                <Await
                  resolve={(loaderData as {
                    records: { failure: Promise<never> }[];
                  }).records[0].failure}
                  errorElement={<DeferredError />}
                >
                  {() => <div>Success</div>}
                </Await>
              </Suspense>
            ),
          },
        });
        const server = createServer(import.meta.url, client, {
          path: "/",
          main: {
            loader: () => ({
              records: [{
                failure: Promise.reject(
                  new ErrorType("private-database-probe"),
                ),
              }],
            }),
          },
        });
        const response = await server.request("http://localhost/");
        const html = await response.text();
        assertEquals(
          html.includes("private-database-probe"),
          ErrorType === PublicError,
        );
      }),
    );
  }

  it(
    "escapes script delimiters in public environment values without changing them",
    simulateEnvironment(
      { APP_NAME: "</ScRiPt><script>envProbe()</script>" },
      async () => {
        const client = new Client({
          path: "/",
          main: { default: () => <div>Home</div> },
        });
        const server = createServer(import.meta.url, client, { path: "/" });
        const response = await server.request("http://localhost/");
        const html = await response.text();
        const match = html.match(
          /window\.__juniperHydrationData = (.*?); await client\.hydrate\(\);/,
        );
        assertExists(match);
        const hydration = deserializeHydrationData(JSON.parse(match[1]));
        assertEquals(
          hydration.publicEnv?.APP_NAME,
          "</ScRiPt><script>envProbe()</script>",
        );
        assertFalse(match[1].includes("<"));
        assertFalse(html.includes("</ScRiPt>"));
      },
    ),
  );
});
