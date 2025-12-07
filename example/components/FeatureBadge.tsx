interface FeatureBadgeProps {
  children: React.ReactNode;
  color?: "emerald" | "blue" | "violet" | "orange" | "pink" | "teal" | "cyan" | "amber" | "red" | "purple";
}

const colorClasses = {
  emerald: "bg-emerald-500/10 text-emerald-400",
  blue: "bg-blue-500/10 text-blue-400",
  violet: "bg-violet-500/10 text-violet-400",
  orange: "bg-orange-500/10 text-orange-400",
  pink: "bg-pink-500/10 text-pink-400",
  teal: "bg-teal-500/10 text-teal-400",
  cyan: "bg-cyan-500/10 text-cyan-400",
  amber: "bg-amber-500/10 text-amber-400",
  red: "bg-red-500/10 text-red-400",
  purple: "bg-purple-500/10 text-purple-400",
};

export function FeatureBadge({ children, color = "emerald" }: FeatureBadgeProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span
        className={`px-3 py-1 ${colorClasses[color]} text-xs font-semibold rounded-full uppercase tracking-wide`}
      >
        {children}
      </span>
    </div>
  );
}



