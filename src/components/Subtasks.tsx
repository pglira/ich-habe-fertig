import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/InlineEdit";
import { Check, SectionHeader } from "@/components/Section";
import type { TodoItem } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface Props {
  item: TodoItem | null;
  hideCompleted: boolean;
  onHideCompleted: (v: boolean) => void;
  onAdd: (text: string) => void;
  onToggle: (subId: string, done: boolean) => void;
  onRename: (subId: string, text: string) => void;
  onDelete: (subId: string) => void;
}

// The subtasks of the selected item. A double click or F2 renames a subtask;
// Delete deletes the selected subtask.
export function Subtasks({ item, hideCompleted, onHideCompleted, onAdd, onToggle, onRename, onDelete }: Props) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const subtasks = (item?.subtasks ?? []).filter((s) => !hideCompleted || !s.done);
  const doneCount = (item?.subtasks ?? []).filter((s) => s.done).length;

  const submit = () => {
    const t = text.trim();
    if (!t || !item) return;
    onAdd(t);
    setText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeader title={item?.subtasks.length ? `Sub-tasks · ${item.subtasks.length - doneCount} open` : "Sub-tasks"}>
        <Check label="Hide completed" checked={hideCompleted} onChange={onHideCompleted} />
      </SectionHeader>
      <ul
        className="min-h-0 flex-1 overflow-y-auto outline-none"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!selected || editing) return;
          if (e.key === "Delete") onDelete(selected);
          if (e.key === "F2") setEditing(selected);
        }}
      >
        {subtasks.map((s) => (
          <li
            key={s.id}
            onMouseDown={() => setSelected(s.id)}
            onDoubleClick={() => setEditing(s.id)}
            className={cn(
              "group flex h-8 items-center gap-2.5 border-b border-border/50 px-3 text-sm",
              selected === s.id ? "bg-primary/20" : "hover:bg-muted/60",
            )}
          >
            <input
              type="checkbox"
              className="checkbox"
              checked={s.done}
              onChange={(e) => onToggle(s.id, e.target.checked)}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <span className={cn("flex min-w-0 flex-1 items-center", s.done && "text-muted-foreground line-through")}>
              <InlineEdit
                value={s.text}
                editing={editing === s.id}
                onEditing={(on) => setEditing(on ? s.id : null)}
                onCommit={(t) => onRename(s.id, t)}
              />
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100"
              title="Delete sub-task"
              onClick={() => onDelete(s.id)}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
        {item && subtasks.length === 0 && (
          <li className="px-3 py-3 text-xs text-muted-foreground">
            {item.subtasks.length ? "All sub-tasks are completed." : "No sub-tasks."}
          </li>
        )}
      </ul>
      <form
        className="flex shrink-0 items-center gap-1 border-t px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={text}
          disabled={!item}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a sub-task"
          className="h-7 min-w-0 flex-1 border border-input bg-background px-2 text-sm outline-none focus:border-ring disabled:opacity-50"
        />
        <Button type="submit" variant="outline" size="xs" className="h-7" disabled={!item || !text.trim()}>
          <Plus />
          Add
        </Button>
      </form>
    </div>
  );
}
