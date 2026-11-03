import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategorySelect } from "@/components/CategorySelect";
import type { Category } from "@/lib/tauri";

interface Props {
  open: boolean;
  // The categories that the dropdown offers.
  categories: Category[];
  onCancel: () => void;
  onSubmit: (title: string, category: string) => void;
}

// The dialog to add a todo: a title and an optional category.
export function AddTodoDialog({ open, categories, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory("");
    }
  }, [open]);
  const trimmed = title.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add todo</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSubmit(trimmed, category);
          }}
          className="grid gap-4"
        >
          <label className="grid gap-1.5 text-xs text-muted-foreground">
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </label>
          <div className="grid gap-1.5 text-xs text-muted-foreground">
            Category
            <CategorySelect value={category} onChange={setCategory} categories={categories} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!trimmed}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
