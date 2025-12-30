import { delay } from "@std/async/delay";
import type { AnyParams, RouteActionArgs, RouteProps } from "@udibo/juniper";
import { Form, useNavigation } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";

interface ActionData {
  success: boolean;
  message: string;
  submittedAt: string;
  formData: {
    name: string;
    email: string;
  };
}

export async function action(
  { request }: RouteActionArgs<AnyParams, ActionData>,
): Promise<ActionData> {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  await delay(800);

  return {
    success: true,
    message: `Form submitted successfully!`,
    submittedAt: new Date().toISOString(),
    formData: { name, email },
  };
}

export default function FormActionDemo({
  actionData,
}: RouteProps<AnyParams, unknown, ActionData>) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div>
      <title>Form Action - Juniper Features</title>
      <FeatureBadge color="orange">Form Action</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Form Action</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Actions handle form submissions and data mutations. Like loaders, they
        run on both server and client by default. Use a separate{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded text-orange-400">
          .ts
        </code>{" "}
        file for server-only actions that need database access or secrets.
      </p>

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
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Enter your email"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </Form>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">
            Action Result
          </h3>
          {actionData
            ? (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-lg ${
                    actionData.success
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : "bg-red-500/10 border border-red-500/30"
                  }`}
                >
                  <p
                    className={actionData.success
                      ? "text-emerald-400"
                      : "text-red-400"}
                  >
                    {actionData.message}
                  </p>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-700/50">
                    <dt className="text-slate-400">Name</dt>
                    <dd className="text-slate-100">
                      {actionData.formData.name}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700/50">
                    <dt className="text-slate-400">Email</dt>
                    <dd className="text-slate-100">
                      {actionData.formData.email}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-slate-400">Submitted</dt>
                    <dd className="text-slate-100 font-mono text-xs">
                      {actionData.submittedAt}
                    </dd>
                  </div>
                </dl>
              </div>
            )
            : (
              <p className="text-slate-500 text-center py-8">
                Submit the form to see the action result
              </p>
            )}
        </div>
      </div>

      <CodeBlock>
        {`import type { RouteActionArgs } from "@udibo/juniper";

export async function action({ request }: RouteActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name");
  // Process form data...
  return { success: true, message: "Submitted!" };
}

// In component:
<Form method="post">
  <input name="name" />
  <button type="submit">Submit</button>
</Form>`}
      </CodeBlock>
    </div>
  );
}
