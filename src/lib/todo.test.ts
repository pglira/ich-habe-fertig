import { describe, expect, it } from "vitest";
import { categoryColors, daysBetween, dueIn, fromLocalInput, subtaskCount, utcDate } from "./todo";
import type { TodoItem } from "./tauri";

const now = new Date("2026-03-20T12:00:00Z");

describe("dueIn", () => {
  it("returns null without a due date", () => {
    expect(dueIn(null, now)).toBeNull();
  });
  it("describes past, present and future dates", () => {
    expect(dueIn("2026-03-17", now)).toEqual({ text: "Overdue 3d", state: "overdue" });
    expect(dueIn("2026-03-20", now)).toEqual({ text: "Today", state: "today" });
    expect(dueIn("2026-03-21", now)).toEqual({ text: "Tomorrow", state: "soon" });
    expect(dueIn("2026-03-25", now)).toEqual({ text: "In 5d", state: "soon" });
    expect(dueIn("2026-04-20", now)).toEqual({ text: "In 31d", state: "later" });
  });
});

describe("dates", () => {
  it("counts days across months", () => {
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
  });
  it("uses the UTC date", () => {
    expect(utcDate(new Date("2026-03-20T23:59:00Z"))).toBe("2026-03-20");
  });
  it("converts local input to UTC", () => {
    expect(fromLocalInput("bad")).toBeNull();
    expect(fromLocalInput("2026-03-20T10:00")).toBe(new Date(2026, 2, 20, 10, 0).toISOString());
  });
});

describe("subtaskCount", () => {
  const item = (done: boolean[]): TodoItem => ({
    id: "a", text: "t", notes: "", done: false, category: "", category_hue: null,
    created_at: null, completed_at: null, due_at: null, images: [],
    subtasks: done.map((d, i) => ({ id: String(i), text: "s", done: d })),
  });
  it("shows open of total", () => {
    expect(subtaskCount(item([]))).toBe("");
    expect(subtaskCount(item([true, false, false]))).toBe("2/3");
  });
});

describe("categoryColors", () => {
  it("has no colors without a category", () => {
    expect(categoryColors(null)).toBeNull();
    expect(categoryColors(120)?.chip).toContain("hsl(120");
  });
});
