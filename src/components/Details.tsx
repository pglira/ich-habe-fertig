import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TodoItem } from "@/lib/tauri";
import { categoryColors, formatLocal, fromLocalInput, localDate, toLocalInput } from "@/lib/todo";

const CATEGORY_DEBOUNCE_MS = 300;

const FIELD =
  "h-7 min-w-0 flex-1 border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring disabled:opacity-50 [color-scheme:dark]";

interface Props {
  item: TodoItem | null;
  // All categories in use, for completion.
  categories: string[];
  onCategory: (id: string, category: string) => void;
  onCreated: (id: string, created: string) => void;
  onDue: (id: string, due: string | null) => void;
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
export function Details({ item, categories, onCategory, onCreated, onDue }: Props) {
  const id = item?.id ?? null;
  const [category, setCategory] = useState("");
  const [created, setCreated] = useState("");
  const [due, setDue] = useState("");
  const timer = useRef<number | null>(null);
  const pending = useRef<{ id: string; value: string } | null>(null);
  const categoryRef = useRef(onCategory);
  categoryRef.current = onCategory;

  const flush = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) categoryRef.current(p.id, p.value);
  };

  // Load the fields of a newly selected item. Write a pending category first.
  useEffect(() => {
    flush();
    setCategory(item?.category ?? "");
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

  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const colors = categoryColors(item?.category_hue ?? null);
  const disabled = !item;

  return (
    <div className="grid shrink-0 gap-1.5 border-t bg-card/40 px-3 py-2.5">
      <Row label="Category">
        <input
          className={FIELD}
          disabled={disabled}
          value={category}
          list="categories"
          placeholder="None"
          onChange={(e) => {
            setCategory(e.target.value);
            if (!id) return;
            pending.current = { id, value: e.target.value };
            if (timer.current !== null) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(flush, CATEGORY_DEBOUNCE_MS);
          }}
          onBlur={flush}
        />
        <span className="size-7 shrink-0 border" style={{ backgroundColor: colors?.chip }} title="Color of the category" />
        <datalist id="categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
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
