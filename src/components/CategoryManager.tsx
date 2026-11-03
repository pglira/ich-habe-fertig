import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineEdit } from "@/components/InlineEdit";
import type { Category } from "@/lib/tauri";
import { autoColor, categoryColors } from "@/lib/todo";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onAdd: (name: string) => void;
  onRename: (old: string, name: string) => void;
  onDelete: (name: string) => void;
  // `color` is `#rrggbb`, or null for the automatic color.
  onColor: (name: string, color: string | null) => void;
  onArchive: (name: string, archived: boolean) => void;
}

function Row({ c, onRename, onDelete, onColor, onArchive }: { c: Category } & Pick<Props, "onRename" | "onDelete" | "onColor" | "onArchive">) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const colors = categoryColors(c.hue, c.color)!;

  // The delete button asks once more; the question expires after 4 seconds.
  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  return (
    <li className={cn("group flex h-9 items-center gap-2 border-b border-border/50 px-2", c.archived && "text-muted-foreground")}>
      <label
        className="relative size-6 shrink-0 cursor-pointer border border-white/20"
        style={{ backgroundColor: colors.chip }}
        title={c.color ? "Change the color" : "Set a color (now automatic)"}
      >
        <input
          type="color"
          value={c.color ?? autoColor(c.hue)}
          onChange={(e) => onColor(c.name, e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Color of ${c.name}`}
        />
      </label>
      <span className="flex min-w-0 flex-1 items-center text-sm" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
        <InlineEdit value={c.name} editing={editing} onEditing={setEditing} onCommit={(t) => onRename(c.name, t)} />
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums" title="Open / all todos">
        {c.total ? `${c.open} open · ${c.total}` : "unused"}
      </span>
      <div className="flex shrink-0 items-center opacity-60 group-hover:opacity-100">
        <Button variant="ghost" size="icon-xs" title="Rename" onClick={() => setEditing(true)}>
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          title={c.archived ? "Restore: offer the category again" : "Archive: do not offer the category for new todos"}
          onClick={() => onArchive(c.name, !c.archived)}
        >
          {c.archived ? <ArchiveRestore /> : <Archive />}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Use the automatic color"
          disabled={!c.color}
          className={cn(!c.color && "invisible")}
          onClick={() => onColor(c.name, null)}
        >
          <RotateCcw />
        </Button>
        {confirm ? (
          <Button variant="destructive" size="xs" onClick={() => onDelete(c.name)} autoFocus>
            {c.total ? `Remove from ${c.total}` : "Delete"}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs" title="Delete the category" onClick={() => setConfirm(true)}>
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );
}

// A dialog to add, rename, color and delete categories.
export function CategoryManager({ open, onClose, categories, onAdd, onRename, onDelete, onColor, onArchive }: Props) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  const trimmed = name.trim();
  const exists = categories.some((c) => c.name === trimmed);
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            Click a color to change it. A rename to an existing name merges the two categories. An archived
            category stays on its todos, but the app does not offer it for new todos. A deleted category is
            removed from its todos.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] overflow-y-auto border">
          {active.map((c) => (
            <Row key={c.name} c={c} onRename={onRename} onDelete={onDelete} onColor={onColor} onArchive={onArchive} />
          ))}
          {archived.length > 0 && (
            <li className="border-b bg-muted px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Archived
            </li>
          )}
          {archived.map((c) => (
            <Row key={c.name} c={c} onRename={onRename} onDelete={onDelete} onColor={onColor} onArchive={onArchive} />
          ))}
          {categories.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">No categories.</li>}
        </ul>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !exists) {
              onAdd(trimmed);
              setName("");
            }
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category"
            className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-sm outline-none focus:border-ring"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!trimmed || exists} title={exists ? "The category exists" : undefined}>
            <Plus />
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
