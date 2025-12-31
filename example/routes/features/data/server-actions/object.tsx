import type { AnyParams, RouteProps } from "@udibo/juniper";
import { Form, useNavigation } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

export interface ServerActionData {
  success: boolean;
  message: string;
  timestamp: string;
  serverProcessed: boolean;
}

export default function ServerActionObjectDemo({
  actionData,
}: RouteProps<AnyParams, unknown, ServerActionData>) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div>
      <title>Server Action: Return Object - Juniper Features</title>
      <FeatureBadge color="teal">Server Action</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Action: Return Object
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        A <strong>server-only action</strong>{" "}
        runs exclusively on the server when handling form submissions. It has
        access to databases, can perform secure mutations, and returns data to
        update the UI.
      </p>

      <InfoBox
        title="When to Use Server-Only Actions"
        color="teal"
        className="mb-6"
      >
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Database writes (create, update, delete)</li>
          <li>Sending emails or notifications</li>
          <li>Processing payments or sensitive operations</li>
          <li>Any mutation requiring server-side validation</li>
        </ul>
      </InfoBox>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            Submit Form
          </h3>
          <Form method="post" className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Your Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                placeholder="Enter your name"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Submit to Server"}
            </button>
          </Form>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            Action Result
          </h3>
          {actionData
            ? (
              <div className="space-y-4">
                <div
                  className={`p-3 rounded-lg ${
                    actionData.success
                      ? "bg-teal-500/10 border border-teal-500/30"
                      : "bg-red-500/10 border border-red-500/30"
                  }`}
                >
                  <p
                    className={actionData.success
                      ? "text-teal-400"
                      : "text-red-400"}
                  >
                    {actionData.message}
                  </p>
                </div>
                <DataList>
                  <DataListItem label="Success">
                    {actionData.success ? "Yes" : "No"}
                  </DataListItem>
                  <DataListItem label="Server Processed">
                    <span className="text-teal-400">
                      {actionData.serverProcessed ? "Yes" : "No"}
                    </span>
                  </DataListItem>
                  <DataListItem label="Timestamp" isLast>
                    <span className="font-mono text-xs">
                      {actionData.timestamp}
                    </span>
                  </DataListItem>
                </DataList>
              </div>
            )
            : (
              <p className="text-slate-500 text-center py-8">
                Submit the form to see the server action result
              </p>
            )}
        </div>
      </div>

      <CodeBlock title="Server Action (object.ts)">
        {`import type { RouteActionArgs } from "@udibo/juniper";

import type { ServerActionData } from "./object.tsx";

export async function action(
  { request }: RouteActionArgs,
): Promise<ServerActionData> {
  const formData = await request.formData();
  const name = formData.get("name") as string;

  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    message: \`Hello, \${name}! Your form was processed on the server.\`,
    timestamp: new Date().toISOString(),
    serverProcessed: true,
  };
}`}
      </CodeBlock>

      <Note className="mt-6">
        The action runs only on the server, so you can safely access databases,
        API keys, and other server resources without exposing them to the
        client.
      </Note>
    </div>
  );
}
