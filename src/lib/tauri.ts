import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export interface SubTask {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoItem {
  id: string;
  text: string;
  notes: string;
  done: boolean;
  category: string;
  // The hue (0..360) of the color of the category; null for no category.
  category_hue: number | null;
  // The color `#rrggbb` that the user set for the category; null for the automatic color.
  category_color: string | null;
  // RFC 3339 time stamps in UTC.
  created_at: string | null;
  completed_at: string | null;
  // A date `YYYY-MM-DD`.
  due_at: string | null;
  // Paths relative to the data directory.
  images: string[];
  subtasks: SubTask[];
}

export interface Category {
  name: string;
  // The color `#rrggbb` that the user set; null for the automatic color.
  color: string | null;
  // The hue of the automatic color.
  hue: number;
  // An archived category is not offered for new assignments.
  archived: boolean;
  open: number;
  total: number;
}

export interface Startup {
  data_dir: string | null;
  error: string | null;
}

// The settings of the app. Unknown keys from newer versions pass through.
export interface Settings {
  // The id of the notes font (`src/lib/fonts.ts`); null for the default.
  notes_font: string | null;
  [key: string]: unknown;
}

export const api = {
  startup: () => invoke<Startup>("startup"),
  openDataDir: (path: string) => invoke<string>("open_data_dir", { path }),
  loadItems: () => invoke<TodoItem[]>("load_items"),
  addItem: (text: string, category: string | null = null) => invoke<TodoItem>("add_item", { text, category }),
  deleteItem: (id: string) => invoke<boolean>("delete_item", { id }),
  setDone: (id: string, done: boolean) => invoke<boolean>("set_done", { id, done }),
  updateText: (id: string, text: string) => invoke<boolean>("update_text", { id, text }),
  updateNotes: (id: string, notes: string) => invoke<boolean>("update_notes", { id, notes }),
  setCategory: (id: string, category: string) => invoke<boolean>("set_category", { id, category }),
  setDue: (id: string, due: string | null) => invoke<boolean>("set_due", { id, due }),
  setCreated: (id: string, created: string) => invoke<boolean>("set_created", { id, created }),
  addSubtask: (id: string, text: string) => invoke<SubTask | null>("add_subtask", { id, text }),
  setSubtaskDone: (id: string, subId: string, done: boolean) =>
    invoke<boolean>("set_subtask_done", { id, subId, done }),
  updateSubtaskText: (id: string, subId: string, text: string) =>
    invoke<boolean>("update_subtask_text", { id, subId, text }),
  deleteSubtask: (id: string, subId: string) => invoke<boolean>("delete_subtask", { id, subId }),
  removeImage: (id: string, rel: string) => invoke<boolean>("remove_image", { id, rel }),
  pasteImage: (id: string) => invoke<number>("paste_image", { id }),
  importImages: (id: string, paths: string[]) => invoke<number>("import_images", { id, paths }),
  openImage: (rel: string) => invoke<void>("open_image", { rel }),
  listCategories: () => invoke<Category[]>("list_categories"),
  addCategory: (name: string) => invoke<boolean>("add_category", { name }),
  renameCategory: (old: string, name: string) => invoke<number>("rename_category", { old, new: name }),
  deleteCategory: (name: string) => invoke<number>("delete_category", { name }),
  setCategoryArchived: (name: string, archived: boolean) =>
    invoke<void>("set_category_archived", { name, archived }),
  setCategoryColor: (name: string, color: string | null) => invoke<void>("set_category_color", { name, color }),
  loadSettings: () => invoke<Settings>("load_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
};

// The URL of an image file of the data directory, served by the `ihf` URI scheme.
export function imageUrl(rel: string): string {
  return convertFileSrc(rel, "ihf");
}
