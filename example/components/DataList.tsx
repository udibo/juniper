interface DataListItemProps {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
}

export function DataListItem(
  { label, children, isLast = false }: DataListItemProps,
) {
  return (
    <div
      className={`flex justify-between items-center py-2 ${
        !isLast ? "border-b border-slate-700/50" : ""
      }`}
    >
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-100 font-medium">{children}</dd>
    </div>
  );
}

interface DataListProps {
  children: React.ReactNode;
  className?: string;
}

export function DataList({ children, className = "" }: DataListProps) {
  return <dl className={`space-y-3 ${className}`}>{children}</dl>;
}
