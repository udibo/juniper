import type { RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";

export default function ParameterizedRoute({
  params,
}: RouteProps<{ id: string }>) {
  return (
    <div>
      <title>Parameterized Route - Juniper Features</title>
      <FeatureBadge color="cyan">Parameterized Route</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Parameterized Route
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Parameterized routes use square brackets to capture dynamic segments.
        The value is available via the{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          params
        </code>{" "}
        prop.
      </p>

      <InfoBox title="Captured Parameter" color="emerald" className="mb-6">
        <div className="text-2xl font-mono text-slate-100">
          id = <span className="text-emerald-400">"{params.id}"</span>
        </div>
      </InfoBox>

      <CodeBlock title="File Structure">
{`routes/
  features/
    routing/
      post/
        [id].tsx    ← Dynamic segment`}
      </CodeBlock>

      <CodeBlock title="Route Pattern" className="mt-6">
        {`/features/routing/post/:id`}
      </CodeBlock>
    </div>
  );
}
