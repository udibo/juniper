import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";

export default function RoutingIndex() {
  return (
    <div>
      <title>Index Route - Juniper Features</title>
      <FeatureBadge color="emerald">Index Route</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Index Route</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        An index route is the default route for a directory. When you navigate
        to{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          /features/routing
        </code>
        , this index route is rendered.
      </p>

      <CodeBlock title="File Structure">
{`routes/
  features/
    routing/
      index.tsx    ← You are here
      ...`}
      </CodeBlock>

      <CodeBlock title="Route Path" className="mt-6">
        {`/features/routing`}
      </CodeBlock>
    </div>
  );
}
