import type { TodoItem } from "@/lib/tauri";

const pad = (n: number) => String(n).padStart(2, "0");

// The UTC date of a time as `YYYY-MM-DD`.
export function utcDate(now: Date): string {
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

// The local date of a time as `YYYY-MM-DD`.
export function localDate(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The number of days from one `YYYY-MM-DD` date to another.
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type DueState = "overdue" | "today" | "soon" | "later";

// The text and the state of a due date, relative to the UTC date of `now`.
export function dueIn(due: string | null, now: Date): { text: string; state: DueState } | null {
  if (!due) return null;
  const days = daysBetween(utcDate(now), due);
  if (days < 0) return { text: `Overdue ${-days}d`, state: "overdue" };
  if (days === 0) return { text: "Today", state: "today" };
  if (days === 1) return { text: "Tomorrow", state: "soon" };
  return { text: `In ${days}d`, state: days <= 7 ? "soon" : "later" };
}

// A time stamp as local `YYYY-MM-DD HH:MM`; a dash for none.
export function formatLocal(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// A time stamp as the value of a `datetime-local` input (local time, minutes).
export function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The value of a `datetime-local` input as an RFC 3339 time stamp in UTC.
export function fromLocalInput(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// The count of open and all subtasks as `open/total`; empty for no subtasks.
export function subtaskCount(item: TodoItem): string {
  const total = item.subtasks.length;
  if (total === 0) return "";
  const open = item.subtasks.filter((s) => !s.done).length;
  return `${open}/${total}`;
}

// The colors of a category with the given hue.
export function categoryColors(hue: number | null): { chip: string; row: string; bar: string } | null {
  if (hue === null) return null;
  return {
    chip: `hsl(${hue} 45% 32%)`,
    row: `hsl(${hue} 40% 30% / 0.22)`,
    bar: `hsl(${hue} 60% 55%)`,
  };
}
