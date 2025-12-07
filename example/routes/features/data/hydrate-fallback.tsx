import type { AnyParams, RouteLoaderArgs, RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";
import { Spinner } from "@/components/Spinner.tsx";

interface LoaderData {
  message: string;
  timestamp: string;
}

export async function loader(_args: RouteLoaderArgs): Promise<LoaderData> {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  return {
    message: "Content loaded after hydration!",
    timestamp: new Date().toISOString(),
  };
}

export function HydrateFallback() {
  return (
    <div>
      <title>Hydrate Fallback - Juniper Features</title>
      <FeatureBadge color="teal">Hydrate Fallback</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Hydrate Fallback
      </h2>

      <InfoBox color="teal" className="mb-6">
        <div className="flex flex-col items-center gap-4 py-2">
          <Spinner size="lg" color="teal" />
          <p className="text-teal-300 font-medium text-lg">
            This is the HydrateFallback component...
          </p>
          <p className="text-slate-400 text-sm text-center max-w-md">
            Shown while React is hydrating on the client and the loader is
            running. This provides a smooth loading experience.
          </p>
        </div>
      </InfoBox>

      <CodeBlock>
        {`export function HydrateFallback() {
  return (
    <div className="loading-spinner">
      <p>Loading...</p>
    </div>
  );
}`}
      </CodeBlock>
    </div>
  );
}

export default function HydrateFallbackDemo({
  loaderData,
}: RouteProps<AnyParams, LoaderData>) {
  return (
    <div>
      <title>Hydrate Fallback - Juniper Features</title>
      <FeatureBadge color="teal">Hydrate Fallback</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Hydrate Fallback
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        The{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          HydrateFallback
        </code>{" "}
        component is displayed while React hydrates on the client and while the
        {" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          loader
        </code>{" "}
        runs. This prevents a flash of empty content during initial page load.
      </p>

      <InfoBox title="Hydration Complete!" color="teal" className="mb-6">
        <DataList>
          <DataListItem label="Message">{loaderData.message}</DataListItem>
          <DataListItem label="Loaded At" isLast>
            <span className="font-mono text-sm">{loaderData.timestamp}</span>
          </DataListItem>
        </DataList>
      </InfoBox>

      <CodeBlock className="mb-6">
        {`import type { RouteLoaderArgs } from "@udibo/juniper";

export function HydrateFallback() {
  return (
    <div className="loading-spinner">
      <p>Loading...</p>
    </div>
  );
}

export async function loader(args: RouteLoaderArgs) {
  const data = await fetchData();
  return data;
}

export default function Page({ loaderData }) {
  return <div>{loaderData.message}</div>;
}`}
      </CodeBlock>

      <Note label="Tip">
        Refresh the page to see the HydrateFallback in action again. It's shown
        during the initial hydration phase.
      </Note>
    </div>
  );
}
