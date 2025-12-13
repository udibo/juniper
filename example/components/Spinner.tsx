interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "emerald" | "blue" | "teal" | "slate" | "amber";
  className?: string;
}

const sizeClasses = {
  sm: "w-3 h-3 border-2",
  md: "w-4 h-4 border-2",
  lg: "w-12 h-12 border-4",
};

const colorClasses = {
  emerald: "border-emerald-400",
  blue: "border-blue-400",
  teal: "border-teal-400",
  slate: "border-slate-400",
  amber: "border-amber-400",
};

export function Spinner(
  { size = "md", color = "emerald", className = "" }: SpinnerProps,
) {
  return (
    <div
      className={`${sizeClasses[size]} ${
        colorClasses[color]
      } border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}
