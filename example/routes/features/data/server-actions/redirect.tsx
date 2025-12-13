import { Form, useNavigation, useSearchParams } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

export default function ServerActionRedirectDemo() {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "true";
  const dest = searchParams.get("dest");

  return (
    <div>
      <title>Server Action: Throw Redirect - Juniper Features</title>
      <FeatureBadge color="violet">Server Action</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Action: Throw Redirect
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        Server actions can <strong>throw a redirect</strong>{" "}
        to navigate users after a successful mutation. Throwing (instead of
        returning) allows you to redirect from anywhere—including helper
        functions or validation logic that wouldn't normally be able to return a
        Response.
      </p>

      {success && (
        <InfoBox title="Action Completed!" color="emerald" className="mb-6">
          <p className="text-slate-300">
            The server action processed your request and redirected you back
            here. Destination was: <strong>{dest}</strong>
          </p>
        </InfoBox>
      )}

      <InfoBox
        title="When to Use Action Redirects"
        color="violet"
        className="mb-6"
      >
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>After creating a resource, redirect to its detail page</li>
          <li>After logout, redirect to home or login page</li>
          <li>Multi-step wizards: redirect to the next step</li>
          <li>After deleting, redirect to a list page</li>
        </ul>
      </InfoBox>

      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Choose Redirect Destination
        </h3>
        <Form method="post" className="space-y-4">
          <div>
            <label
              htmlFor="destination"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Destination
            </label>
            <select
              id="destination"
              name="destination"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            >
              <option value="self">
                Stay on this page (with success message)
              </option>
              <option value="home">Redirect to Home</option>
              <option value="features">Redirect to Features Index</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-violet-500 hover:bg-violet-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Processing..." : "Submit & Redirect"}
          </button>
        </Form>
      </div>

      <CodeBlock title="Server Action with Throw Redirect (redirect.ts)">
        {`import type { RouteActionArgs } from "@udibo/juniper";
import { redirect } from "react-router";

export async function action({ request }: RouteActionArgs): Promise<void> {
  const formData = await request.formData();
  const destination = formData.get("destination") as string;

  await new Promise((resolve) => setTimeout(resolve, 300));

  if (destination === "home") {
    throw redirect("/");
  }
  if (destination === "features") {
    throw redirect("/features");
  }

  throw redirect("/features/data/server-actions/redirect?success=true");
}`}
      </CodeBlock>

      <Note className="mt-6">
        Redirects after mutations follow the POST-Redirect-GET pattern,
        preventing duplicate form submissions if the user refreshes the page.
      </Note>
    </div>
  );
}
