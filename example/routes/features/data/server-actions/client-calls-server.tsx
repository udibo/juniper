import type { RouteActionArgs } from "@udibo/juniper";
import { Form, useActionData, useNavigation } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

export interface ServerMutationResult {
  success: boolean;
  message: string;
  savedAt: string;
  recordId: string;
}

interface ClientEnrichedResult extends ServerMutationResult {
  clientValidated: boolean;
  optimisticId: string;
  totalProcessingTime: number;
}

export async function action({
  request,
  serverAction,
}: RouteActionArgs): Promise<ClientEnrichedResult> {
  const startTime = Date.now();

  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  const validationErrors: string[] = [];
  if (title.length < 3) {
    validationErrors.push("Title must be at least 3 characters");
  }
  if (content.length < 10) {
    validationErrors.push("Content must be at least 10 characters");
  }

  if (validationErrors.length > 0) {
    return {
      success: false,
      message: `Client validation failed: ${validationErrors.join(", ")}`,
      savedAt: "",
      recordId: "",
      clientValidated: false,
      optimisticId: "",
      totalProcessingTime: Date.now() - startTime,
    };
  }

  const optimisticId = `opt-${Date.now()}`;

  const serverResult = await serverAction() as ServerMutationResult;

  return {
    ...serverResult,
    clientValidated: true,
    optimisticId,
    totalProcessingTime: Date.now() - startTime,
  };
}

export default function ClientCallsServerActionDemo() {
  const actionData = useActionData<ClientEnrichedResult>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div>
      <title>Client Action Calls Server - Juniper Features</title>
      <FeatureBadge color="amber">Client + Server Action</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Client Action Calls Server Action
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        When you have both a client action and a server action, the client
        action can perform validation, generate optimistic IDs, then call{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded text-amber-400">
          serverAction()
        </code>{" "}
        to persist data. This pattern provides fast client feedback while
        keeping mutations secure on the server.
      </p>

      <InfoBox title="Why Use This Pattern?" color="amber" className="mb-6">
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>
            <strong>Instant Validation:</strong>{" "}
            Validate on the client before hitting the server
          </li>
          <li>
            <strong>Optimistic Updates:</strong>{" "}
            Generate client-side IDs for instant UI updates
          </li>
          <li>
            <strong>Security:</strong> All actual mutations happen server-side
          </li>
          <li>
            <strong>Enrichment:</strong> Track client-side metrics like timing
          </li>
        </ul>
      </InfoBox>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            Create Record
          </h3>
          <Form method="post" className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Title (min 3 chars)
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                placeholder="Enter title"
              />
            </div>
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Content (min 10 chars)
              </label>
              <textarea
                id="content"
                name="content"
                required
                rows={3}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                placeholder="Enter content"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Validate & Submit"}
            </button>
          </Form>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            Combined Result
          </h3>
          {actionData
            ? (
              <div className="space-y-4">
                <div
                  className={`p-3 rounded-lg ${
                    actionData.success
                      ? "bg-amber-500/10 border border-amber-500/30"
                      : "bg-red-500/10 border border-red-500/30"
                  }`}
                >
                  <p
                    className={actionData.success
                      ? "text-amber-400"
                      : "text-red-400"}
                  >
                    {actionData.message}
                  </p>
                </div>
                <DataList>
                  <DataListItem label="Client Validated">
                    <span
                      className={actionData.clientValidated
                        ? "text-emerald-400"
                        : "text-red-400"}
                    >
                      {actionData.clientValidated ? "Yes" : "No"}
                    </span>
                  </DataListItem>
                  {actionData.success && (
                    <>
                      <DataListItem label="Record ID">
                        <span className="font-mono text-xs text-teal-400">
                          {actionData.recordId}
                        </span>
                      </DataListItem>
                      <DataListItem label="Optimistic ID">
                        <span className="font-mono text-xs text-amber-400">
                          {actionData.optimisticId}
                        </span>
                      </DataListItem>
                    </>
                  )}
                  <DataListItem label="Processing Time" isLast>
                    <span className="font-mono text-xs">
                      {actionData.totalProcessingTime}ms
                    </span>
                  </DataListItem>
                </DataList>
              </div>
            )
            : (
              <p className="text-slate-500 text-center py-8">
                Submit the form to see client + server action in action
              </p>
            )}
        </div>
      </div>

      <CodeBlock title="Client Action Calling Server (client-calls-server.tsx)">
        {`import type { RouteActionArgs } from "@udibo/juniper";

// ServerMutationResult type is defined in the same .tsx file
export interface ServerMutationResult {
  success: boolean;
  message: string;
  savedAt: string;
  recordId: string;
}

interface ClientEnrichedResult extends ServerMutationResult {
  clientValidated: boolean;
  optimisticId: string;
  totalProcessingTime: number;
}

export async function action({
  request,
  serverAction,
}: RouteActionArgs): Promise<ClientEnrichedResult> {
  const startTime = Date.now();
  const formData = await request.formData();
  const title = formData.get("title") as string;

  if (title.length < 3) {
    return { success: false, message: "Title too short", ... };
  }

  const optimisticId = \`opt-\${Date.now()}\`;
  const serverResult = await serverAction() as ServerMutationResult;

  return {
    ...serverResult,
    clientValidated: true,
    optimisticId,
    totalProcessingTime: Date.now() - startTime,
  };
}`}
      </CodeBlock>

      <Note className="mt-6">
        Try submitting with short values to see client validation fail
        instantly, without making a server request. Valid submissions go through
        to the server.
      </Note>
    </div>
  );
}
