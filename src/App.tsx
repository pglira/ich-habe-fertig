import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { homeDir } from "@tauri-apps/api/path";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Confetti, type ConfettiHandle } from "@/components/Confetti";
import { Details } from "@/components/Details";
import { Images } from "@/components/Images";
import { NotesEditor, type NotesEditorHandle } from "@/components/NotesEditor";
import { ResizeHandle } from "@/components/ResizeHandle";
import { Check, SectionHeader } from "@/components/Section";
import { StartScreen } from "@/components/StartScreen";
import { Subtasks } from "@/components/Subtasks";
import { ConfirmDialog, TextPromptDialog } from "@/components/TextPromptDialog";
import { TodoList } from "@/components/TodoList";
import { usePersistentState } from "@/lib/storage";
import { api, type TodoItem } from "@/lib/tauri";

const NOW_REFRESH_MS = 60_000;
const STATUS_MS = 5000;
const LEFT_DEFAULT = 560;
const SUBTASKS_DEFAULT = 260;
const IMAGES_DEFAULT = 180;

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// The main view of an open data directory.
function TodoApp({ dataDir }: { dataDir: string }) {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = usePersistentState("hideCompleted", true);
  const [subHideCompleted, setSubHideCompleted] = usePersistentState("subHideCompleted", true);
  const [thumbSize, setThumbSize] = usePersistentState("thumbSize", 96);
  const [leftWidth, setLeftWidth] = usePersistentState("leftWidth", LEFT_DEFAULT);
  const [subtasksHeight, setSubtasksHeight] = usePersistentState("subtasksHeight", SUBTASKS_DEFAULT);
  const [imagesHeight, setImagesHeight] = usePersistentState("imagesHeight", IMAGES_DEFAULT);
  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const confetti = useRef<ConfettiHandle>(null);
  const notesRef = useRef<NotesEditorHandle>(null);
  const statusTimer = useRef<number | null>(null);

  const visible = useMemo(() => (hideCompleted ? items.filter((i) => !i.done) : items), [items, hideCompleted]);
  const selected = visible.find((i) => i.id === selectedId) ?? null;
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected?.id ?? null;
  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const openCount = items.filter((i) => !i.done).length;

  const notify = useCallback((text: string, error = false) => {
    setStatus({ text, error });
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), STATUS_MS);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setItems(await api.loadItems());
    } catch (e) {
      notify(String(e), true);
    }
  }, [notify]);

  // Runs a command, shows its error, and loads the items again.
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (e) {
        notify(String(e), true);
        return undefined;
      } finally {
        await refresh();
      }
    },
    [notify, refresh],
  );

  useEffect(() => {
    refresh();
    getCurrentWindow().setTitle(`ich-habe-fertig — ${dataDir}`).catch(() => {});
    const id = window.setInterval(() => setNow(new Date()), NOW_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [dataDir, refresh]);

  const toggleDone = useCallback(
    async (item: TodoItem) => {
      const changed = await run(() => api.setDone(item.id, !item.done));
      if (changed && !item.done) confetti.current?.burst();
    },
    [run],
  );

  const addItem = async (text: string) => {
    setAdding(false);
    const created = await run(() => api.addItem(text));
    if (!created) return;
    setSelectedId(created.id);
    window.setTimeout(() => notesRef.current?.focus(), 50);
  };

  const deleteItem = async (id: string) => {
    setDeleting(null);
    const idx = visible.findIndex((i) => i.id === id);
    const next = visible[idx + 1] ?? visible[idx - 1] ?? null;
    await run(() => api.deleteItem(id));
    setSelectedId(next?.id ?? null);
  };

  const saveNotes = useCallback(
    (id: string, notes: string) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notes } : i)));
      api.updateNotes(id, notes).catch((e) => notify(`Could not save the notes: ${e}`, true));
    },
    [notify],
  );

  const pasteImage = useCallback(async () => {
    const id = selectedRef.current;
    if (!id) return;
    const n = await run(() => api.pasteImage(id));
    if (n) notify(n === 1 ? "Attached 1 image." : `Attached ${n} images.`);
  }, [run, notify]);

  // Image files dropped on the window attach to the selected item.
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent(async (e) => {
      const p = e.payload;
      if (p.type === "enter" || p.type === "over") setDragging(true);
      else if (p.type === "leave") setDragging(false);
      else if (p.type === "drop") {
        setDragging(false);
        const id = selectedRef.current;
        if (!id) return notify("Select a todo first, then drop the images.", true);
        const n = await run(() => api.importImages(id, p.paths));
        if (n === 0) notify("The dropped files contain no images.", true);
        else if (n) notify(n === 1 ? "Attached 1 image." : `Attached ${n} images.`);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [run, notify]);

  // Ctrl N adds a todo. Ctrl V outside of text fields pastes an image.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        setAdding(true);
      } else if (key === "v" && !isEditable(e.target) && !document.querySelector(".cm-focused")) {
        e.preventDefault();
        pasteImage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pasteImage]);

  const sid = selected?.id ?? null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b bg-card/40 px-3">
        <span className="mr-2 text-sm font-semibold">ich-habe-fertig</span>
        <Button size="xs" onClick={() => setAdding(true)} title="Add a todo (Ctrl N)">
          <Plus />
          Add
        </Button>
        <Button variant="outline" size="xs" disabled={!sid} onClick={() => sid && setDeleting(sid)} title="Delete the selected todo (Delete)">
          <Trash2 />
          Delete
        </Button>
        <div className="ml-auto">
          <Check label="Hide completed" checked={hideCompleted} onChange={setHideCompleted} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <section className="flex min-w-[360px] shrink-0 flex-col" style={{ width: leftWidth, maxWidth: "70%" }}>
          <TodoList
            items={visible}
            selectedId={sid}
            now={now}
            onSelect={setSelectedId}
            onToggle={toggleDone}
            onRename={(id, text) => run(() => api.updateText(id, text))}
            onDelete={setDeleting}
          />
          <Details
            item={selected}
            categories={categories}
            onCategory={(id, c) => run(() => api.setCategory(id, c))}
            onCreated={(id, c) => run(() => api.setCreated(id, c))}
            onDue={(id, d) => run(() => api.setDue(id, d))}
          />
        </section>
        <ResizeHandle side="left" className="border-l" onResize={(w) => setLeftWidth(clamp(w, 360, 1400))} onReset={() => setLeftWidth(LEFT_DEFAULT)} />

        <section className="flex min-w-0 flex-1 flex-col">
          <SectionHeader title="Notes" subtitle={selected?.text} />
          <NotesEditor ref={notesRef} itemId={sid} notes={selected?.notes ?? ""} onSave={saveNotes} />
          <ResizeHandle side="top" onResize={(h) => setSubtasksHeight(clamp(h, 90, 900))} onReset={() => setSubtasksHeight(SUBTASKS_DEFAULT)} />
          <div className="shrink-0 border-t" style={{ height: subtasksHeight }}>
            <Subtasks
              item={selected}
              hideCompleted={subHideCompleted}
              onHideCompleted={setSubHideCompleted}
              onAdd={(text) => sid && run(() => api.addSubtask(sid, text))}
              onToggle={async (subId, done) => {
                if (!sid) return;
                const changed = await run(() => api.setSubtaskDone(sid, subId, done));
                if (changed && done) confetti.current?.burst();
              }}
              onRename={(subId, text) => sid && run(() => api.updateSubtaskText(sid, subId, text))}
              onDelete={(subId) => sid && run(() => api.deleteSubtask(sid, subId))}
            />
          </div>
          <ResizeHandle side="top" onResize={(h) => setImagesHeight(clamp(h, 90, 900))} onReset={() => setImagesHeight(IMAGES_DEFAULT)} />
          <div className="shrink-0 border-t" style={{ height: imagesHeight }}>
            <Images
              item={selected}
              dragging={dragging}
              size={thumbSize}
              onSize={setThumbSize}
              onPaste={pasteImage}
              onRemove={(rel) => sid && run(() => api.removeImage(sid, rel))}
              onOpen={(rel) => api.openImage(rel).catch((e) => notify(String(e), true))}
            />
          </div>
        </section>
      </main>

      <footer className="flex h-6 shrink-0 items-center gap-3 border-t bg-card/40 px-3 text-[11px] text-muted-foreground">
        <span className="truncate" title={dataDir}>
          {dataDir}
        </span>
        <span className="shrink-0">
          {openCount} open · {items.length} total
        </span>
        {status && (
          <span className={status.error ? "ml-auto truncate text-destructive" : "ml-auto truncate text-foreground"}>{status.text}</span>
        )}
      </footer>

      <TextPromptDialog
        open={adding}
        title="Add todo"
        label="Title"
        confirm="Add"
        onCancel={() => setAdding(false)}
        onSubmit={addItem}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete todo"
        message={`Delete "${items.find((i) => i.id === deleting)?.text ?? ""}" permanently, with its sub-tasks and images?`}
        confirm="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteItem(deleting)}
      />
      <Confetti ref={confetti} />
    </div>
  );
}

export default function App() {
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  const choose = useCallback(async () => {
    const home = await homeDir().catch(() => undefined);
    const picked = await openDialog({ directory: true, title: "Select the todo data directory", defaultPath: home });
    if (typeof picked !== "string") return;
    try {
      setDataDir(await api.openDataDir(picked));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.startup().then((s) => {
      setDataDir(s.data_dir);
      setError(s.error);
      setReady(true);
      // Without a directory argument, ask for the directory at once.
      if (!s.data_dir && !s.error) choose();
    });
  }, [choose]);

  if (!ready) return null;
  return (
    <TooltipProvider>
      {dataDir ? <TodoApp dataDir={dataDir} /> : <StartScreen error={error} onChoose={choose} />}
    </TooltipProvider>
  );
}
