import type { AnyParams, RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";
import { Spinner } from "@/components/Spinner.tsx";

export interface ServerLoaderData {
  message: string;
  timestamp: string;
  serverOnly: string;
}

export default function ServerLoaderObjectDemo({
  loaderData,
}: RouteProps<AnyParams, ServerLoaderData>) {
  return (
    <div>
      <title>Server Loader: Return Object - Juniper Features</title>
      <FeatureBadge color="teal">Server Loader</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Loader: Return Object
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        A <strong>server-only loader</strong>{" "}
        runs exclusively on the server during SSR and when navigating. It has
        access to server-side resources like databases, file systems, and
        environment variables that should never be exposed to the client.
      </p>

      <InfoBox
        title="When to Use Server-Only Loaders"
        color="teal"
        className="mb-6"
      >
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Accessing databases or server-side services directly</li>
          <li>Reading secrets, API keys, or environment variables</li>
          <li>Performing authentication/authorization checks</li>
          <li>Loading data that requires server-side processing</li>
        </ul>
      </InfoBox>

      <InfoBox title="Loaded Data" color="blue" className="mb-6">
        <DataList>
          <DataListItem label="Message">{loaderData.message}</DataListItem>
          <DataListItem label="Timestamp">
            <span className="font-mono text-sm">{loaderData.timestamp}</span>
          </DataListItem>
          <DataListItem label="Server-Only Data" isLast>
            <span className="text-teal-400 font-mono text-sm">
              {loaderData.serverOnly}
            </span>
          </DataListItem>
        </DataList>
      </InfoBox>

      <CodeBlock title="Server Loader (object.ts)">
        {`import type { RouteLoaderArgs } from "@udibo/juniper";

import type { ServerLoaderData } from "./object.tsx";

export async function loader(
  _args: RouteLoaderArgs,
): Promise<ServerLoaderData> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    message: "Data loaded from the server!",
    timestamp: new Date().toISOString(),
    serverOnly: \`Server PID: \${Deno.pid}\`,
  };
}`}
      </CodeBlock>

      <Note className="mt-6">
        The{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded text-teal-400">
          serverOnly
        </code>{" "}
        field contains the server process ID, demonstrating access to
        server-only resources. This data is never bundled into the client.
      </Note>
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Spinner size="lg" color="amber" />
      <p className="text-slate-400">Loading from server and client...</p>
    </div>
  );
}
