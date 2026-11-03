import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from "@uiw/react-codemirror";

const NOTES_DEBOUNCE_MS = 300;

export interface NotesEditorHandle {
  focus: () => void;
}

interface Props {
  // The item of the notes; null shows a disabled, empty editor.
  itemId: string | null;
  notes: string;
  onSave: (id: string, notes: string) => void;
}

const theme = EditorView.theme(
  {
    "&": { height: "100%", fontSize: "13px", backgroundColor: "var(--background)" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--font-notes, var(--font-mono))", lineHeight: "1.55" },
    ".cm-content": { caretColor: "var(--foreground)", padding: "6px 0" },
    ".cm-gutters": {
      backgroundColor: "var(--card)",
      color: "var(--muted-foreground)",
      border: "none",
      borderRight: "1px solid var(--border)",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 10px", minWidth: "32px" },
    ".cm-activeLine": { backgroundColor: "color-mix(in oklch, var(--muted) 55%, transparent)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--muted)", color: "var(--foreground)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in oklch, var(--primary) 35%, transparent) !important",
    },
    ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  },
  { dark: true },
);

// A plain text editor with line numbers. It saves its text when the typing
// pauses, when another item is selected and when it unmounts.
export const NotesEditor = forwardRef<NotesEditorHandle, Props>(function NotesEditor({ itemId, notes, onSave }, ref) {
  const [text, setText] = useState(notes);
  const cm = useRef<ReactCodeMirrorRef>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<{ id: string; text: string } | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const flush = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) saveRef.current(p.id, p.text);
  };

  useImperativeHandle(ref, () => ({ focus: () => cm.current?.view?.focus() }), []);

  useEffect(() => {
    flush();
    setText(notes);
    // Only a new item replaces the text in the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => () => flush(), []);

  return (
    <div className="min-h-0 flex-1 overflow-hidden" data-testid="notes">
      <CodeMirror
        ref={cm}
        value={text}
        height="100%"
        className="h-full"
        theme={theme}
        editable={itemId !== null}
        placeholder={itemId ? "Notes" : ""}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: false,
          autocompletion: false,
          bracketMatching: false,
          closeBrackets: false,
          searchKeymap: true,
        }}
        extensions={[EditorView.lineWrapping]}
        onChange={(value) => {
          setText(value);
          if (!itemId) return;
          pending.current = { id: itemId, text: value };
          if (timer.current !== null) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, NOTES_DEBOUNCE_MS);
        }}
        onBlur={flush}
      />
    </div>
  );
});
