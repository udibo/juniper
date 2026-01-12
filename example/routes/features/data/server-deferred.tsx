import { Suspense } from "react";
import { Await, useAsyncError } from "react-router";
import { HttpError } from "@udibo/juniper";
import type { AnyParams, RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder.tsx";
import { Spinner } from "@/components/Spinner.tsx";

import type { ServerDeferredLoaderData } from "./server-deferred.ts";

function AwaitError() {
  const error = useAsyncError();
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
      Error: {error instanceof HttpError
        ? error.exposedMessage
        : (error instanceof Error ? error.message : String(error))}
    </div>
  );
}

export default function ServerDeferredDataDemo({
  loaderData,
}: RouteProps<AnyParams, ServerDeferredLoaderData>) {
  return (
    <div>
      <title>Server Deferred Data - Juniper Features</title>
      <FeatureBadge color="cyan">Server Deferred</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Deferred Data
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Server loaders can also return promises for deferred data. The promises
        are serialized using CBOR and streamed to the client for progressive
        hydration. This demonstrates the full server-to-client data flow with
        {" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          Suspense
        </code>{" "}
        and{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          Await
        </code>.
      </p>

      <div className="space-y-4 mb-6">
        <InfoBox color="emerald">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
            Instant (Server Timestamp)
          </span>
          <p className="text-slate-100 mt-1">{loaderData.fastData}</p>
        </InfoBox>

        <Suspense
          fallback={
            <LoadingPlaceholder label="Streaming slow data from server..." />
          }
        >
          <Await resolve={loaderData.slowData} errorElement={<AwaitError />}>
            {(data: string) => (
              <InfoBox color="blue">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  1.5 Second Server Delay
                </span>
                <p className="text-slate-100 mt-1">{data}</p>
              </InfoBox>
            )}
          </Await>
        </Suspense>

        <Suspense
          fallback={
            <LoadingPlaceholder label="Streaming very slow data from server..." />
          }
        >
          <Await
            resolve={loaderData.verySlowData}
            errorElement={<AwaitError />}
          >
            {(data: string) => (
              <InfoBox color="purple">
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
                  3 Second Server Delay
                </span>
                <p className="text-slate-100 mt-1">{data}</p>
              </InfoBox>
            )}
          </Await>
        </Suspense>
      </div>

      <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">
          How it works:
        </h3>
        <ol className="list-decimal list-inside text-slate-400 text-sm space-y-1">
          <li>
            Server loader runs and returns an object with promises
          </li>
          <li>
            Fast data is included in the initial HTML response
          </li>
          <li>
            Promises are serialized using CBOR with custom tags
          </li>
          <li>
            Client hydrates immediately with Suspense fallbacks
          </li>
          <li>
            As server promises resolve, data streams to the client
          </li>
        </ol>
      </div>

      <CodeBlock>
        {`// server-deferred.ts (server-only loader)
import { delay } from "@std/async/delay";

export async function loader() {
  return {
    fastData: "Instant from server!",
    slowData: delay(1500).then(() => "Streamed later")
  };
}

// server-deferred.tsx (component)
<Suspense fallback={<Loading />}>
  <Await resolve={loaderData.slowData}>
    {(data) => <div>{data}</div>}
  </Await>
</Suspense>`}
      </CodeBlock>
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Spinner size="lg" />
      <p className="text-slate-400">Hydrating server deferred data...</p>
    </div>
  );
}
