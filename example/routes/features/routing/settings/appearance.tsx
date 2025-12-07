import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

export default function PrefixRoute() {
  return (
    <div>
      <title>Prefix Route - Juniper Features</title>
      <FeatureBadge color="pink">Prefix Route</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Prefix Route</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        A prefix route is a folder that contains routes but has no{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          main.tsx
        </code>{" "}
        of its own. The folder acts as a path prefix for organizing related
        routes without rendering a layout.
      </p>

      <InfoBox title="Current Path" color="pink" className="mb-6">
        <code className="text-xl font-mono text-slate-100">
          /features/routing/settings/appearance
        </code>
      </InfoBox>

      <CodeBlock title="File Structure">
        {`routes/
  features/
    routing/
      settings/           ← No main.tsx (prefix only)
        appearance.tsx    ← You are here
        theme.tsx         ← Another route under settings`}
      </CodeBlock>

      <Note label="Tip" className="mt-6">
        Prefix routes are useful for grouping related pages under a common URL
        prefix without needing a shared layout.
      </Note>
    </div>
  );
}
