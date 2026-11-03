import { cn } from "@/lib/utils";

// The title bar of a panel.
export function SectionHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-8 shrink-0 items-center gap-2 border-b bg-card/60 px-3", className)}>
      <h2 className="shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {subtitle && <span className="min-w-0 truncate text-xs text-foreground/80">{subtitle}</span>}
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </div>
  );
}

// A labeled checkbox in the style of the app.
export function Check({ label, checked, onChange, title }: { label: string; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none" title={title}>
      <input type="checkbox" className="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
