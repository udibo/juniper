import { Form, useActionData, useNavigation } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

export interface ResponseActionData {
  success: boolean;
  message: string;
  processedAt: string;
}

export default function ServerActionResponseDemo() {
  const actionData = useActionData<ResponseActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div>
      <title>Server Action: Return Response - Juniper Features</title>
      <FeatureBadge color="cyan">Server Action</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Action: Return Response
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        Server actions can return a custom{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded text-cyan-400">
          Response
        </code>{" "}
        object for complete control over status codes, headers, and response
        format. This is useful for API-like responses or custom error handling.
      </p>

      <InfoBox
        title="When to Use Custom Response"
        color="cyan"
        className="mb-6"
      >
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>
            Setting specific HTTP status codes (201 Created, 422 Validation
            Error)
          </li>
          <li>Adding custom headers (correlation IDs, timing info)</li>
          <li>Returning non-JSON formats (XML, CSV downloads)</li>
          <li>Implementing API-like error responses</li>
        </ul>
      </InfoBox>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            Submit Data
          </h3>
          <Form method="post" className="space-y-4">
            <div>
              <label
                htmlFor="data"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Data to Process
              </label>
              <input
                type="text"
                id="data"
                name="data"
                required
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="Enter some data"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Process with Custom Response"}
            </button>
          </Form>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            Response Details
          </h3>
          {actionData
            ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                  <p className="text-cyan-400">{actionData.message}</p>
                </div>
                <DataList>
                  <DataListItem label="Success">
                    {actionData.success ? "Yes" : "No"}
                  </DataListItem>
                  <DataListItem label="Processed At" isLast>
                    <span className="font-mono text-xs text-cyan-400">
                      {actionData.processedAt}
                    </span>
                  </DataListItem>
                </DataList>
              </div>
            )
            : (
              <p className="text-slate-500 text-center py-8">
                Submit the form to see the custom response
              </p>
            )}
        </div>
      </div>

      <CodeBlock title="Server Action with Custom Response (response.ts)">
        {`import type { RouteActionArgs } from "@udibo/juniper";

import type { ResponseActionData } from "./response.tsx";

export async function action({ request }: RouteActionArgs): Promise<Response> {
  const formData = await request.formData();
  const input = formData.get("data") as string;

  const responseData: ResponseActionData = {
    success: true,
    message: \`Processed: \${input}\`,
    processedAt: new Date().toISOString(),
  };

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Action-Id": crypto.randomUUID(),
  });

  return new Response(JSON.stringify(responseData), { status: 200, headers });
}`}
      </CodeBlock>

      <Note className="mt-6">
        Check your browser's Network tab to see the custom headers attached to
        the response. The{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded">X-Action-Id</code>
        {" "}
        header can be useful for request tracing and debugging.
      </Note>
    </div>
  );
}
