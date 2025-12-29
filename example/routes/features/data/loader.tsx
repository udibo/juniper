import type { AnyParams, RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";
import { Spinner } from "@/components/Spinner.tsx";
import { delay } from "@std/async/delay";

interface LoaderData {
  timestamp: string;
  randomNumber: number;
  message: string;
}

export async function loader(): Promise<LoaderData> {
  await delay(500);
  return {
    timestamp: new Date().toISOString(),
    randomNumber: Math.floor(Math.random() * 1000),
    message: "Data loaded successfully!",
  };
}

export default function LoaderDemo({
  loaderData,
}: RouteProps<AnyParams, LoaderData>) {
  return (
    <div>
      <title>Loader - Juniper Features</title>
      <FeatureBadge color="blue">Loader</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Loader</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Loaders fetch data for your route. They run during navigation and can
        call APIs, access localStorage, or perform any data fetching.
      </p>

      <InfoBox title="Loaded Data" color="blue" className="mb-6">
        <DataList>
          <DataListItem label="Message">{loaderData.message}</DataListItem>
          <DataListItem label="Timestamp">
            <span className="font-mono text-sm">{loaderData.timestamp}</span>
          </DataListItem>
          <DataListItem label="Random Number" isLast>
            <span className="text-emerald-400 font-mono text-xl">
              {loaderData.randomNumber}
            </span>
          </DataListItem>
        </DataList>
      </InfoBox>

      <CodeBlock>
        {`import type { RouteLoaderArgs } from "@udibo/juniper";

export async function loader(args: RouteLoaderArgs) {
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    timestamp: new Date().toISOString(),
    randomNumber: Math.floor(Math.random() * 1000),
    message: "Data loaded successfully!"
  };
}`}
      </CodeBlock>

      <Note className="mt-6">
        Refresh the page or navigate away and back to see the loader run again
        with new data.
      </Note>
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Spinner size="lg" />
      <p className="text-slate-400">Loading data...</p>
    </div>
  );
}
