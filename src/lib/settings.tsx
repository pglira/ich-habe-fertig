import * as React from "react";
import { api, type Settings } from "@/lib/tauri";
import { notesFont } from "@/lib/fonts";
import { celebrationStyle, intensity } from "@/lib/celebration";

interface Ctx {
  settings: Settings;
  setNotesFont: (id: string) => void;
  hideCompleted: boolean;
  setHideCompleted: (hide: boolean) => void;
  celebration: { enabled: boolean; style: string; intensity: string };
  setCelebration: (patch: Partial<Pick<Settings, "celebration" | "celebration_style" | "celebration_intensity">>) => void;
}

// The key under which the browser storage kept "Hide completed" before it
// became a setting.
const LEGACY_HIDE_KEY = "ihf:hideCompleted";

const SettingsContext = React.createContext<Ctx | null>(null);

// Loads the settings from the backend and saves each change. The font of the
// notes is the CSS variable `--font-notes` on the root element.
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<Settings>({ notes_font: null });

  React.useEffect(() => {
    api
      .loadSettings()
      .then((s) => {
        // Take over the value from the browser storage once.
        if (s.hide_completed == null) {
          try {
            const legacy = localStorage.getItem(LEGACY_HIDE_KEY);
            if (legacy !== null) {
              s = { ...s, hide_completed: JSON.parse(legacy) === true };
              api.saveSettings(s).catch(() => {});
            }
          } catch {
            // storage is not available or the value is invalid
          }
        }
        setSettings(s);
      })
      .catch(() => {});
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
    () => ({
      settings,
      setNotesFont: (id: string) => update({ notes_font: id }),
      hideCompleted: settings.hide_completed ?? true,
      setHideCompleted: (hide: boolean) => update({ hide_completed: hide }),
      celebration: {
        enabled: settings.celebration ?? true,
        style: celebrationStyle(settings.celebration_style).id,
        intensity: intensity(settings.celebration_intensity).id,
      },
      setCelebration: update,
    }),
    [settings, update],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
