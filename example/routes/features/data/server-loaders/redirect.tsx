import { Link, useSearchParams } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

export default function ServerLoaderRedirectDemo() {
  const [searchParams] = useSearchParams();
  const wasRedirected = searchParams.get("redirected") === "true";

  return (
    <div>
      <title>Server Loader: Throw Redirect - Juniper Features</title>
      <FeatureBadge color="violet">Server Loader</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Loader: Throw Redirect
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        Server loaders can <strong>throw a redirect</strong> using the{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded text-violet-400">
          redirect()
        </code>{" "}
        helper from React Router. Throwing (instead of returning) allows you to
        redirect from anywhere—including helper functions or nested code that
        wouldn't normally be able to return a Response.
      </p>

      {wasRedirected && (
        <InfoBox title="Redirect Successful!" color="emerald" className="mb-6">
          <p className="text-slate-300">
            You were redirected here by the server loader. The loader detected
            the{" "}
            <code className="px-1 py-0.5 bg-slate-700 rounded">
              trigger=true
            </code>{" "}
            parameter and issued a redirect.
          </p>
        </InfoBox>
      )}

      <InfoBox
        title="When to Use Server Redirects"
        color="violet"
        className="mb-6"
      >
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Authentication: Redirect unauthenticated users to login</li>
          <li>Authorization: Redirect users without permission</li>
          <li>Data-dependent routing: Redirect based on resource state</li>
          <li>URL normalization: Redirect old URLs to new ones</li>
        </ul>
      </InfoBox>

      <div className="mb-6">
        <Link
          to="/features/data/server-loaders/redirect?trigger=true"
          className="inline-block px-6 py-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 font-semibold rounded-lg transition-colors"
        >
          Trigger Redirect →
        </Link>
      </div>

      <CodeBlock title="Server Loader with Throw Redirect (redirect.ts)">
        {`import type { RouteLoaderArgs } from "@udibo/juniper";
import { redirect } from "react-router";

export function loader({ request }: RouteLoaderArgs): void {
  const url = new URL(request.url);
  const shouldRedirect = url.searchParams.get("trigger") === "true";

  if (shouldRedirect) {
    throw redirect("/features/data/server-loaders/redirect?redirected=true");
  }
}`}
      </CodeBlock>

      <Note className="mt-6">
        Click the button above to navigate with{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded">?trigger=true</code>.
        The server loader will intercept this and redirect you back here with a
        success message.
      </Note>
    </div>
  );
}
