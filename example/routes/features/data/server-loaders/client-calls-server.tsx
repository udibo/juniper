import type { AnyParams, RouteLoaderArgs, RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";
import { Spinner } from "@/components/Spinner.tsx";

export interface ServerData {
  serverMessage: string;
  serverTimestamp: string;
  secretData: string;
}

interface ClientEnrichedData extends ServerData {
  clientTimestamp: string;
  browserInfo: string;
  combinedMessage: string;
}

export async function loader({
  serverLoader,
}: RouteLoaderArgs): Promise<ClientEnrichedData> {
  const serverData = await serverLoader() as ServerData;

  return {
    ...serverData,
    clientTimestamp: new Date().toISOString(),
    browserInfo: typeof navigator !== "undefined"
      ? navigator.userAgent.split(" ").slice(-1)[0]
      : "SSR",
    combinedMessage: `${serverData.serverMessage} + client enrichment`,
  };
}

export default function ClientCallsServerDemo({
  loaderData,
}: RouteProps<AnyParams, ClientEnrichedData>) {
  return (
    <div>
      <title>Client Loader Calls Server - Juniper Features</title>
      <FeatureBadge color="amber">Client + Server Loader</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Client Loader Calls Server Loader
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        When you have both a server loader and a client loader, the client
        loader can call{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded text-amber-400">
          serverLoader()
        </code>{" "}
        to fetch server data and then enrich it with client-side information.
        This pattern combines the security of server-side data loading with
        client-specific enhancements.
      </p>

      <InfoBox title="Why Use This Pattern?" color="amber" className="mb-6">
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>
            <strong>Security:</strong>{" "}
            Keep sensitive data fetching on the server
          </li>
          <li>
            <strong>Client Context:</strong>{" "}
            Add browser-specific data (localStorage, navigator, etc.)
          </li>
          <li>
            <strong>Caching:</strong>{" "}
            Layer client-side caching on top of server data
          </li>
          <li>
            <strong>Transformation:</strong>{" "}
            Transform server data for client rendering
          </li>
        </ul>
      </InfoBox>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <InfoBox title="Server Data" color="teal">
          <DataList>
            <DataListItem label="Message">
              {loaderData.serverMessage}
            </DataListItem>
            <DataListItem label="Timestamp">
              <span className="font-mono text-xs">
                {loaderData.serverTimestamp}
              </span>
            </DataListItem>
            <DataListItem label="Secret" isLast>
              <span className="font-mono text-xs text-teal-400">
                {loaderData.secretData}
              </span>
            </DataListItem>
          </DataList>
        </InfoBox>

        <InfoBox title="Client Enrichment" color="amber">
          <DataList>
            <DataListItem label="Client Time">
              <span className="font-mono text-xs">
                {loaderData.clientTimestamp}
              </span>
            </DataListItem>
            <DataListItem label="Browser">
              <span className="font-mono text-xs">
                {loaderData.browserInfo}
              </span>
            </DataListItem>
            <DataListItem label="Combined" isLast>
              <span className="text-amber-400 text-sm">
                {loaderData.combinedMessage}
              </span>
            </DataListItem>
          </DataList>
        </InfoBox>
      </div>

      <CodeBlock title="Client Loader Calling Server (client-calls-server.tsx)">
        {`import type { RouteLoaderArgs } from "@udibo/juniper";

// ServerData type is defined in the same .tsx file
export interface ServerData {
  serverMessage: string;
  serverTimestamp: string;
  secretData: string;
}

interface ClientEnrichedData extends ServerData {
  clientTimestamp: string;
  browserInfo: string;
  combinedMessage: string;
}

export async function loader({
  serverLoader,
}: RouteLoaderArgs): Promise<ClientEnrichedData> {
  const serverData = await serverLoader() as ServerData;

  return {
    ...serverData,
    clientTimestamp: new Date().toISOString(),
    browserInfo: navigator.userAgent.split(" ").slice(-1)[0],
    combinedMessage: \`\${serverData.serverMessage} + client enrichment\`,
  };
}`}
      </CodeBlock>

      <Note className="mt-6">
        During SSR, the server loader runs directly. On client-side navigation,
        the client loader calls{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded">serverLoader()</code>
        {" "}
        which fetches data from a server endpoint, then enriches it with client
        context.
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
