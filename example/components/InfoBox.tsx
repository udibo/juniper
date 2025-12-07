interface InfoBoxProps {
  title?: string;
  children: React.ReactNode;
  color?: "emerald" | "blue" | "violet" | "orange" | "pink" | "teal" | "cyan" | "amber" | "red" | "purple" | "slate";
  className?: string;
}

const colorClasses = {
  emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  violet: "bg-violet-500/10 border-violet-500/30 text-violet-400",
  orange: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  pink: "bg-pink-500/10 border-pink-500/30 text-pink-400",
  teal: "bg-teal-500/10 border-teal-500/30 text-teal-400",
  cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
  amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  red: "bg-red-500/10 border-red-500/30 text-red-400",
  purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
  slate: "bg-slate-800/50 border-slate-700 text-slate-400",
};

export function InfoBox({
  title,
  children,
  color = "emerald",
  className = "",
}: InfoBoxProps) {
  const [bgColor, borderColor, textColor] = colorClasses[color].split(" ");
  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-6 ${className}`}>
      {title && (
        <h3 className={`text-sm font-semibold ${textColor} uppercase tracking-wide mb-4`}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}



