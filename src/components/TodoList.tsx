import { useEffect, useRef, useState } from "react";
import { InlineEdit } from "@/components/InlineEdit";
import type { TodoItem } from "@/lib/tauri";
import { categoryColors, dueIn, subtaskCount, type DueState } from "@/lib/todo";
import { cn } from "@/lib/utils";

interface Props {
  items: TodoItem[];
  selectedId: string | null;
  // The current time; the due column is relative to it.
  now: Date;
  onSelect: (id: string) => void;
  onToggle: (item: TodoItem) => void;
  onRename: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

const DUE_CLASS: Record<DueState, string> = {
  overdue: "text-destructive font-medium",
  today: "text-amber-400 font-medium",
  soon: "text-foreground",
  later: "text-muted-foreground",
};

const GRID = "grid grid-cols-[28px_40px_minmax(0,110px)_minmax(0,1fr)_84px] items-center gap-2";

// The table of todos. Up and Down move the selection, Space completes the
// selected item, F2 or a double click on the title renames it, and Delete
// deletes it.
export function TodoList({ items, selectedId, now, onSelect, onToggle, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    const idx = items.findIndex((i) => i.id === selectedId);
    const sel = items[idx];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = items[Math.min(items.length - 1, Math.max(0, idx + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) onSelect(next.id);
    } else if (!sel) {
      return;
    } else if (e.key === " ") {
      e.preventDefault();
      onToggle(sel);
    } else if (e.key === "F2" || e.key === "Enter") {
      e.preventDefault();
      setEditing(sel.id);
    } else if (e.key === "Delete") {
      e.preventDefault();
      onDelete(sel.id);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn(GRID, "h-7 shrink-0 border-b px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase")}>
        <span />
        <span className="text-center" title="Open / all sub-tasks">Sub</span>
        <span>Category</span>
        <span>Title</span>
        <span>Due</span>
      </div>
      <div
        ref={listRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-y-auto outline-none"
        data-testid="todo-list"
      >
        {items.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No todos. Press Ctrl N to add one.</p>
        )}
        {items.map((item) => {
          const colors = item.done ? null : categoryColors(item.category_hue, item.category_color);
          const due = dueIn(item.due_at, now);
          const selected = item.id === selectedId;
          return (
            <div
              key={item.id}
              data-id={item.id}
              onMouseDown={() => onSelect(item.id)}
              className={cn(
                GRID,
                "relative h-8 cursor-default border-b border-border/50 px-2 text-sm",
                selected ? "bg-primary/25" : "hover:bg-muted/60",
                item.done && "text-muted-foreground",
              )}
              style={!selected && colors ? { backgroundColor: colors.row } : undefined}
            >
              <span
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: selected ? "var(--primary)" : colors?.bar }}
              />
              <input
                type="checkbox"
                className="checkbox justify-self-center"
                checked={item.done}
                onChange={() => onToggle(item)}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={item.done ? "Mark as open" : "Mark as done"}
              />
              <span className="text-center font-mono text-xs text-muted-foreground tabular-nums">{subtaskCount(item)}</span>
              <span className="min-w-0">
                {item.category && (
                  <span
                    className={cn("block truncate px-1.5 py-px text-xs", !colors && "border text-muted-foreground")}
                    style={colors ? { backgroundColor: colors.chip, color: colors.text } : undefined}
                    title={item.category}
                  >
                    {item.category}
                  </span>
                )}
              </span>
              <span
                className={cn("flex min-w-0 items-center", item.done && "line-through")}
                onDoubleClick={() => setEditing(item.id)}
                title={item.text}
              >
                <InlineEdit
                  value={item.text}
                  editing={editing === item.id}
                  onEditing={(on) => {
                    setEditing(on ? item.id : null);
                    if (!on) listRef.current?.focus();
                  }}
                  onCommit={(t) => onRename(item.id, t)}
                />
              </span>
              <span className={cn("truncate text-xs", due && !item.done ? DUE_CLASS[due.state] : "text-muted-foreground")}>
                {due?.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
