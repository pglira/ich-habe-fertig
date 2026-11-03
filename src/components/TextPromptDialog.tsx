import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  title: string;
  label: string;
  confirm: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}

// A dialog with one text field. It refuses an empty text.
export function TextPromptDialog({ open, title, label, confirm, onCancel, onSubmit }: Props) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText("");
  }, [open]);
  const trimmed = text.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSubmit(trimmed);
          }}
          className="grid gap-4"
        >
          <label className="grid gap-1.5 text-xs text-muted-foreground">
            {label}
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-8 border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!trimmed}>
              {confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}

// A dialog that asks to confirm a destructive action.
export function ConfirmDialog({ open, title, message, confirm, onCancel, onConfirm }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" autoFocus onClick={onConfirm}>
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
