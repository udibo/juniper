import type { AnyParams, RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

export interface ResponseLoaderData {
  title: string;
  description: string;
  timestamp: string;
}

export default function ServerLoaderResponseDemo({
  loaderData,
}: RouteProps<AnyParams, ResponseLoaderData>) {
  return (
    <div>
      <title>Server Loader: Return Response - Juniper Features</title>
      <FeatureBadge color="cyan">Server Loader</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Loader: Return Response
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        Server loaders can return a custom{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded text-cyan-400">
          Response
        </code>{" "}
        object for fine-grained control over headers, status codes, and content
        types. This is useful for setting cache headers, custom response
        formats, or streaming responses.
      </p>

      <InfoBox
        title="When to Use Custom Response"
        color="cyan"
        className="mb-6"
      >
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Setting custom cache headers (Cache-Control, ETag, etc.)</li>
          <li>Adding security headers or CORS headers</li>
          <li>Returning different content types (XML, CSV, etc.)</li>
          <li>Streaming large responses</li>
          <li>Setting specific HTTP status codes</li>
        </ul>
      </InfoBox>

      <InfoBox title="Response Data" color="blue" className="mb-6">
        <DataList>
          <DataListItem label="Title">{loaderData.title}</DataListItem>
          <DataListItem label="Description">
            {loaderData.description}
          </DataListItem>
          <DataListItem label="Timestamp" isLast>
            <span className="font-mono text-sm text-cyan-400">
              {loaderData.timestamp}
            </span>
          </DataListItem>
        </DataList>
      </InfoBox>

      <CodeBlock title="Server Loader with Custom Response (response.ts)">
        {`import type { RouteLoaderArgs } from "@udibo/juniper";

import type { ResponseLoaderData } from "./response.tsx";

export function loader(_args: RouteLoaderArgs): Response {
  const data: ResponseLoaderData = {
    title: "Custom Response Example",
    description: "Data loaded via a custom Response object",
    timestamp: new Date().toISOString(),
  };

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "private, max-age=60",
    "X-Custom-Header": "Juniper-Demo",
  });

  return new Response(JSON.stringify(data), { headers });
}`}
      </CodeBlock>

      <Note className="mt-6">
        The custom headers set by the server loader are included in the
        response. Check your browser's developer tools to see the{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded">Cache-Control</code>
        {" "}
        and custom headers.
      </Note>
    </div>
  );
}
