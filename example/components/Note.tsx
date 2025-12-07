interface NoteProps {
  label?: "Note" | "Tip" | "Warning";
  children: React.ReactNode;
  className?: string;
}

export function Note({ label = "Note", children, className = "" }: NoteProps) {
  return (
    <div
      className={`p-4 bg-slate-900/50 rounded-xl border border-slate-700 ${className}`}
    >
      <p className="text-slate-400 text-sm">
        <strong className="text-slate-200">{label}:</strong> {children}
      </p>
    </div>
  );
}
