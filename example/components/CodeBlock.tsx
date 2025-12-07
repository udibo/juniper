export interface CodeBlockProps {
  title?: string;
  children: string;
  className?: string;
}

export function CodeBlock({
  title = "Example Code",
  children,
  className = "",
}: CodeBlockProps) {
  return (
    <div
      className={`bg-slate-900/50 rounded-xl p-6 border border-slate-700 ${className}`}
    >
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
        {title}
      </h3>
      <pre className="text-sm text-slate-300 font-mono overflow-x-auto">
        {children}
      </pre>
    </div>
  );
}
