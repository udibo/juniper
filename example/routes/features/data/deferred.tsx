import { delay } from "@std/async/delay";
import { Suspense } from "react";
import { Await, useAsyncError } from "react-router";
import { HttpError } from "@udibo/juniper";
import type { AnyParams, RouteLoaderArgs, RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder.tsx";
import { Spinner } from "@/components/Spinner.tsx";

interface DeferredLoaderData {
  fastData: string;
  slowData: Promise<string>;
  verySlowData: Promise<string>;
}

export function loader(_args: RouteLoaderArgs): DeferredLoaderData {
  return {
    fastData: "This data loaded instantly!",
    slowData: delay(1000).then(() => "Loaded after 1 second"),
    verySlowData: delay(2500).then(() => "Loaded after 2.5 seconds"),
  };
}

function AwaitError() {
  const error = useAsyncError();
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
      Error: {error instanceof HttpError && !error.expose
        ? "Server error"
        : (error instanceof Error ? error.message : String(error))}
    </div>
  );
}

export default function DeferredDataDemo({
  loaderData,
}: RouteProps<AnyParams, DeferredLoaderData>) {
  return (
    <div>
      <title>Deferred Data - Juniper Features</title>
      <FeatureBadge color="violet">Deferred Data</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Deferred Data</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Deferred loading allows you to return promises from your loader. Fast
        data renders immediately while slower data streams in using{" "}
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
            Instant
          </span>
          <p className="text-slate-100 mt-1">{loaderData.fastData}</p>
        </InfoBox>

        <Suspense
          fallback={<LoadingPlaceholder label="Loading slow data..." />}
        >
          <Await resolve={loaderData.slowData} errorElement={<AwaitError />}>
            {(data: string) => (
              <InfoBox color="blue">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  1 Second Delay
                </span>
                <p className="text-slate-100 mt-1">{data}</p>
              </InfoBox>
            )}
          </Await>
        </Suspense>

        <Suspense
          fallback={<LoadingPlaceholder label="Loading very slow data..." />}
        >
          <Await
            resolve={loaderData.verySlowData}
            errorElement={<AwaitError />}
          >
            {(data: string) => (
              <InfoBox color="purple">
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
                  2.5 Second Delay
                </span>
                <p className="text-slate-100 mt-1">{data}</p>
              </InfoBox>
            )}
          </Await>
        </Suspense>
      </div>

      <CodeBlock>
        {`import { delay } from "@std/async/delay";
import type { RouteLoaderArgs } from "@udibo/juniper";

export function loader(args: RouteLoaderArgs) {
  return {
    fastData: "Instant!",
    slowData: delay(1000).then(() => "Delayed")
  };
}

// In component:
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
      <p className="text-slate-400">Loading deferred data...</p>
    </div>
  );
}
