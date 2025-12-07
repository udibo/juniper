import type { RouteLoaderArgs } from "@udibo/juniper";
import { useLoaderData } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { isServer } from "@udibo/juniper/utils/env";
import { HttpError } from "@udibo/http-error";

export function loader(_args: RouteLoaderArgs) {
  if (isServer()) {
    throw new HttpError(
      400,
      "This error was thrown during server-side rendering!",
    );
  }

  return {
    message: "Data loaded successfully from the server!",
    timestamp: new Date().toISOString(),
  };
}

export default function SSRErrorDemo() {
  const loaderData = useLoaderData<typeof loader>();

  if (!loaderData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <title>SSR Error Handling - Juniper Features</title>
      <FeatureBadge color="red">SSR Errors</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server-Side Error Handling
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Errors can occur during server-side rendering, such as in{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          loader
        </code>{" "}
        functions. The{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          ErrorBoundary
        </code>{" "}
        catches these errors and displays a fallback UI, preventing the entire
        page from failing.
      </p>

      <InfoBox title="Current State" color="emerald" className="mb-6">
        <div className="space-y-2">
          <p className="text-slate-300">
            <span className="font-semibold">Status:</span>{" "}
            <span className="text-emerald-400">Data loaded successfully</span>
          </p>
          <p className="text-slate-300">
            <span className="font-semibold">Message:</span> {loaderData.message}
          </p>
          <p className="text-slate-300">
            <span className="font-semibold">Timestamp:</span>{" "}
            {loaderData.timestamp}
          </p>
        </div>
      </InfoBox>

      <InfoBox title="Trigger SSR Error" color="red" className="mb-6">
        <p className="text-slate-300 mb-4">
          This page's loader throws an error when running on the server. You're
          seeing this content because client-side navigation ran the loader on
          the client. Click the button below to refresh the page, which will
          render server-side and trigger the error.
        </p>
        <button
          type="button"
          onClick={() => globalThis.location.reload()}
          className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
        >
          Refresh Page (Trigger SSR Error)
        </button>
      </InfoBox>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          How It Works
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>
            When a page is loaded directly (refresh or URL entry), the loader
            runs on the server during SSR
          </li>
          <li>
            When navigating client-side (clicking links), the loader runs on the
            client
          </li>
          <li>
            If an error occurs during SSR (e.g., database failure), it's thrown
            on the server
          </li>
          <li>The nearest ErrorBoundary catches the error</li>
          <li>
            The server sends the error boundary's HTML instead of the route's
            content
          </li>
        </ol>
      </div>

      <CodeBlock>
        {`// routes/features/errors/ssr.tsx
import type { RouteLoaderArgs } from "@udibo/juniper";
import { isServer } from "@udibo/juniper/utils/env";

export function loader(_args: RouteLoaderArgs) {
  // This error only occurs during SSR
  if (isServer()) {
    throw new Error("SSR Error!");
  }

  // Client-side navigation runs loader on client
  return { message: "Loaded on client!" };
}

export default function Page() {
  const loaderData = useLoaderData<typeof loader>();
  return <div>{loaderData.message}</div>;
}

// Parent route (main.tsx)
export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  return (
    <div>
      <h1>Server Error</h1>
      <p>{error.message}</p>
    </div>
  );
}`}
      </CodeBlock>
    </div>
  );
}
