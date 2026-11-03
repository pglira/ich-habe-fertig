// The fonts that the user can choose for the notes editor. A font that is not
// bundled (PragmataPro) loads from the system and falls back to the generic
// family if it is not installed.
export interface NotesFont {
  id: string;
  name: string;
  family: string;
  monospace: boolean;
}

export const NOTES_FONTS: NotesFont[] = [
  { id: "ibm-plex-mono", name: "IBM Plex Mono", family: '"IBM Plex Mono", monospace', monospace: true },
  { id: "jetbrains-mono", name: "JetBrains Mono", family: '"JetBrains Mono Variable", monospace', monospace: true },
  { id: "fira-code", name: "Fira Code", family: '"Fira Code Variable", monospace', monospace: true },
  { id: "source-code-pro", name: "Source Code Pro", family: '"Source Code Pro Variable", monospace', monospace: true },
  { id: "pragmatapro", name: "PragmataPro", family: '"PragmataPro", monospace', monospace: true },
  { id: "system-mono", name: "System monospace", family: "monospace", monospace: true },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", family: '"IBM Plex Sans Variable", sans-serif', monospace: false },
  { id: "inter", name: "Inter", family: '"Inter Variable", sans-serif', monospace: false },
  { id: "source-sans-3", name: "Source Sans 3", family: '"Source Sans 3 Variable", sans-serif', monospace: false },
  { id: "system-sans", name: "System sans-serif", family: "sans-serif", monospace: false },
];

export const NOTES_FONT_DEFAULT = "ibm-plex-mono";

// The notes font with the id `id`, or the default font for an unknown id.
export function notesFont(id: string | null | undefined): NotesFont {
  return NOTES_FONTS.find((f) => f.id === id) ?? NOTES_FONTS[0];
}
