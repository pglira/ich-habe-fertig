import * as React from "react";
import { api, type Settings } from "@/lib/tauri";
import { notesFont } from "@/lib/fonts";

interface Ctx {
  settings: Settings;
  setNotesFont: (id: string) => void;
}

const SettingsContext = React.createContext<Ctx | null>(null);

// Loads the settings from the backend and saves each change. The font of the
// notes is the CSS variable `--font-notes` on the root element.
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<Settings>({ notes_font: null });

  React.useEffect(() => {
    api.loadSettings().then(setSettings).catch(() => {});
  }, []);

  React.useEffect(() => {
    document.documentElement.style.setProperty("--font-notes", notesFont(settings.notes_font).family);
  }, [settings.notes_font]);

  const update = React.useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      api.saveSettings(next).catch(() => {});
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ settings, setNotesFont: (id: string) => update({ notes_font: id }) }),
    [settings, update],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
