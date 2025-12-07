import type { RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";

export default function NestedParamsRoute({
  params,
}: RouteProps<{ userId: string }>) {
  return (
    <div>
      <title>Nested Params - Juniper Features</title>
      <FeatureBadge color="purple">Nested Parameters</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Nested Parameters
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Parameterized directories allow you to capture dynamic segments in
        folder names. Place a{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          [param]
        </code>{" "}
        directory to match any value at that path segment.
      </p>

      <InfoBox title="Captured Parameters" color="purple" className="mb-6">
        <div className="text-2xl font-mono text-slate-100">
          userId = <span className="text-purple-400">"{params.userId}"</span>
        </div>
      </InfoBox>

      <CodeBlock title="File Structure">
{`routes/
  features/
    routing/
      user/
        [userId]/        ← Parameterized directory
          profile.tsx    ← You are here`}
      </CodeBlock>

      <CodeBlock title="Route Pattern" className="mt-6">
        {`/features/routing/user/:userId/profile`}
      </CodeBlock>
    </div>
  );
}
