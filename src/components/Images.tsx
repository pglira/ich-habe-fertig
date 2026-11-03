import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImageOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/Section";
import { imageUrl, type TodoItem } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export const THUMB_MIN = 48;
export const THUMB_MAX = 256;
const THUMB_STEP = 16;

interface Props {
  item: TodoItem | null;
  // True while files are dragged over the window.
  dragging: boolean;
  size: number;
  onSize: (size: number) => void;
  onPaste: () => void;
  onRemove: (rel: string) => void;
  onOpen: (rel: string) => void;
}

function Thumb({ rel, size, selected, onSelect, onOpen }: { rel: string; size: number; selected: boolean; onSelect: () => void; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      title={`${rel}\nDouble-click to open`}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cn(
        "flex shrink-0 items-center justify-center border bg-background p-1 outline-none",
        selected ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground",
      )}
      style={{ width: size + 10, height: size + 10 }}
    >
      {broken ? (
        <ImageOff className="size-6 text-muted-foreground" />
      ) : (
        <img src={imageUrl(rel)} alt="" className="max-h-full max-w-full object-contain" draggable={false} onError={() => setBroken(true)} />
      )}
    </button>
  );
}

// The image attachments of the selected item as thumbnails. Ctrl + wheel
// changes the size of the thumbnails.
export function Images({ item, dragging, size, onSize, onPaste, onRemove, onOpen }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const images = item?.images ?? [];
  const sel = selected && images.includes(selected) ? selected : null;
  const gridRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ size, onSize });
  sizeRef.current = { size, onSize };

  // A native listener, because React adds wheel listeners as passive and
  // passive listeners cannot prevent the default scroll.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const { size, onSize } = sizeRef.current;
      const next = size + (e.deltaY < 0 ? THUMB_STEP : -THUMB_STEP);
      onSize(Math.min(THUMB_MAX, Math.max(THUMB_MIN, next)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeader title={images.length ? `Images · ${images.length}` : "Images"}>
        <Button variant="ghost" size="xs" disabled={!item} onClick={onPaste} title="Paste an image from the clipboard (Ctrl V)">
          <ClipboardPaste />
          Paste
        </Button>
        <Button variant="ghost" size="xs" disabled={!sel} onClick={() => sel && onRemove(sel)} title="Remove the selected image">
          <Trash2 />
          Remove
        </Button>
      </SectionHeader>
      <div
        ref={gridRef}
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto p-2 outline-none",
          dragging && item && "bg-primary/10 outline-2 -outline-offset-4 outline-dashed outline-primary",
        )}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Delete" && sel) onRemove(sel);
        }}
      >
        <div className="flex flex-wrap gap-2">
          {images.map((rel) => (
            <Thumb key={rel} rel={rel} size={size} selected={rel === sel} onSelect={() => setSelected(rel)} onOpen={() => onOpen(rel)} />
          ))}
        </div>
        {item && images.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Paste an image with Ctrl V, or drag image files from the file manager into the window.
          </p>
        )}
      </div>
    </div>
  );
}
