import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  editing: boolean;
  onEditing: (editing: boolean) => void;
  // Called with the trimmed text if it is not empty and differs from `value`.
  onCommit: (text: string) => void;
  className?: string;
}

// A text that changes to a text field while `editing` is true. Enter and a
// click outside commit the change; Escape cancels it.
export function InlineEdit({ value, editing, onEditing, onCommit, className }: Props) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => ref.current?.select());
    }
  }, [editing, value]);

  if (!editing) {
    return <span className={cn("truncate", className)}>{value}</span>;
  }
  const commit = () => {
    const t = draft.trim();
    onEditing(false);
    if (t && t !== value) onCommit(t);
  };
  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onEditing(false);
      }}
      className="h-6 min-w-0 flex-1 border border-ring bg-background px-1 text-sm text-foreground outline-none"
    />
  );
}
