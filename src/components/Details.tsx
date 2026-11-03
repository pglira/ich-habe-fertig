import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "@/components/CategorySelect";
import type { Category, TodoItem } from "@/lib/tauri";
import { formatLocal, fromLocalInput, localDate, toLocalInput } from "@/lib/todo";

const FIELD =
  "h-7 min-w-0 flex-1 border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring disabled:opacity-50 [color-scheme:dark]";

interface Props {
  item: TodoItem | null;
  // All categories, also the archived ones. The dropdown offers the others.
  categories: Category[];
  onCategory: (id: string, category: string) => void;
  onCreated: (id: string, created: string) => void;
  onDue: (id: string, due: string | null) => void;
  // Opens the category manager.
  onManage: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </div>
  );
}

// The category, the creation date, the completion date and the due date of
// the selected item.
export function Details({ item, categories, onCategory, onCreated, onDue, onManage }: Props) {
  const id = item?.id ?? null;
  const [created, setCreated] = useState("");
  const [due, setDue] = useState("");

  // Load the fields of a newly selected item.
  useEffect(() => {
    setCreated(toLocalInput(item?.created_at ?? null));
    setDue(item?.due_at ?? localDate(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setCreated(toLocalInput(item?.created_at ?? null));
  }, [item?.created_at]);

  useEffect(() => {
    if (item?.due_at) setDue(item.due_at);
  }, [item?.due_at]);

  const disabled = !item;
  // The current category stays in the dropdown also if it is archived.
  const options = categories.filter((c) => !c.archived || c.name === item?.category);

  return (
    <div className="grid shrink-0 gap-1.5 border-t bg-card/40 px-3 py-2.5">
      <Row label="Category">
        <div className="min-w-0 flex-1">
          <CategorySelect
            value={item?.category ?? ""}
            onChange={(c) => id && c !== item?.category && onCategory(id, c)}
            categories={options}
            disabled={disabled}
            compact
          />
        </div>
        <Button variant="outline" size="xs" className="h-7 w-7 px-0" title="Manage the categories" onClick={onManage}>
          <Settings2 />
        </Button>
      </Row>
      <Row label="Created">
        <input
          type="datetime-local"
          className={FIELD}
          disabled={disabled}
          value={created}
          onChange={(e) => setCreated(e.target.value)}
        />
        <Button
          variant="outline"
          size="xs"
          className="h-7 w-14"
          disabled={disabled || created === toLocalInput(item?.created_at ?? null)}
          onClick={() => {
            const iso = fromLocalInput(created);
            if (id && iso) onCreated(id, iso);
          }}
        >
          Set
        </Button>
        <span className="w-14 shrink-0" />
      </Row>
      <Row label="Completed">
        <span className="h-7 px-2 text-sm leading-7 text-muted-foreground">{item ? formatLocal(item.completed_at) : "—"}</span>
      </Row>
      <Row label="Due">
        <input type="date" className={FIELD} disabled={disabled} value={due} onChange={(e) => setDue(e.target.value)} />
        <Button
          variant="outline"
          size="xs"
          className="h-7 w-14"
          disabled={disabled || !due || due === item?.due_at}
          onClick={() => id && onDue(id, due)}
        >
          Set
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7 w-14"
          disabled={disabled || !item?.due_at}
          onClick={() => id && onDue(id, null)}
        >
          Clear
        </Button>
      </Row>
    </div>
  );
}
