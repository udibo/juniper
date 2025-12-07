import { Spinner } from "@/components/Spinner.tsx";

interface LoadingPlaceholderProps {
  label: string;
}

export function LoadingPlaceholder({ label }: LoadingPlaceholderProps) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-slate-700/30 rounded-lg animate-pulse">
      <Spinner size="md" />
      <span className="text-slate-400">{label}</span>
    </div>
  );
}
