import type { RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";

export default function WildcardRoute({
  params,
}: RouteProps<{ "*": string }>) {
  const path = params["*"] ?? "";
  const pathSegments = path ? path.split("/") : [];

  return (
    <div>
      <title>Wildcard Route - Juniper Features</title>
      <FeatureBadge color="amber">Wildcard Route</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Wildcard Route</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Wildcard (catch-all) routes use{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          [...].tsx
        </code>{" "}
        syntax to capture all remaining path segments. This is useful for file
        browsers, documentation paths, or any nested structure.
      </p>

      <InfoBox title="Captured Path" color="amber" className="mb-6">
        <div className="text-xl font-mono text-slate-100 mb-4">
          path = <span className="text-amber-400">"{path}"</span>
        </div>
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Segments
        </h4>
        <div className="flex flex-wrap gap-2">
          {pathSegments.length > 0
            ? pathSegments.map((segment, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-slate-800 text-slate-200 rounded-md font-mono text-sm"
              >
                {segment}
              </span>
            ))
            : <span className="text-slate-500 italic">No path segments</span>}
        </div>
      </InfoBox>

      <CodeBlock title="File Structure">
{`routes/
  features/
    routing/
      files/
        [...].tsx    ← Catches all nested paths`}
      </CodeBlock>

      <CodeBlock title="Route Pattern" className="mt-6">
        {`/features/routing/files/*`}
      </CodeBlock>
    </div>
  );
}
