import { delay } from "@std/async/delay";
import type { RouteActionArgs } from "@udibo/juniper";
import { useFetcher } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { Note } from "@/components/Note.tsx";
import { Spinner } from "@/components/Spinner.tsx";

interface CounterActionData {
  count: number;
  lastAction: string;
  timestamp: string;
}

let counter = 0;

export async function action(
  { request }: RouteActionArgs,
): Promise<CounterActionData> {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  await delay(300);

  if (intent === "increment") {
    counter += 1;
  } else if (intent === "decrement") {
    counter -= 1;
  } else if (intent === "reset") {
    counter = 0;
  }

  return {
    count: counter,
    lastAction: intent,
    timestamp: new Date().toISOString(),
  };
}

export default function FetcherActionDemo() {
  const fetcher = useFetcher<CounterActionData>();
  const isSubmitting = fetcher.state !== "idle";
  const count = fetcher.data?.count ?? 0;

  return (
    <div>
      <title>Fetcher Action - Juniper Features</title>
      <FeatureBadge color="pink">Fetcher Action</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Fetcher Action</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Fetchers allow you to submit data without navigation. They're perfect
        for UI interactions like counters, toggles, or inline editing that
        shouldn't change the URL.
      </p>

      <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-6">
        <div className="text-center mb-8">
          <div
            className={`text-7xl font-bold mb-2 transition-all ${
              isSubmitting ? "text-slate-500 scale-95" : "text-emerald-400"
            }`}
          >
            {count}
          </div>
          <p className="text-slate-500 text-sm">
            {fetcher.data?.lastAction
              ? `Last action: ${fetcher.data.lastAction}`
              : "Click a button to update"}
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="decrement" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-14 h-14 bg-slate-700 hover:bg-slate-600 text-slate-100 text-2xl font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              −
            </button>
          </fetcher.Form>

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="reset" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 h-14 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              Reset
            </button>
          </fetcher.Form>

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="increment" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-2xl font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              +
            </button>
          </fetcher.Form>
        </div>

        {fetcher.state !== "idle" && (
          <div className="text-center mt-4">
            <span className="text-slate-500 text-sm flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Updating...
            </span>
          </div>
        )}
      </div>

      <CodeBlock>
        {`import type { RouteActionArgs } from "@udibo/juniper";

export async function action({ request }: RouteActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  // Process intent...
  return { count: newCount };
}

// In component:
const fetcher = useFetcher();

<fetcher.Form method="post">
  <input type="hidden" name="intent" value="increment" />
  <button type="submit">+</button>
</fetcher.Form>

// Access response data
const count = fetcher.data?.count ?? 0;`}
      </CodeBlock>

      <Note label="Tip" className="mt-6">
        Unlike{" "}
        <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
          Form
        </code>, fetchers don't cause navigation or add entries to the browser
        history. The URL stays the same while data is updated.
      </Note>
    </div>
  );
}
