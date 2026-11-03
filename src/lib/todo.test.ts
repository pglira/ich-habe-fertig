import { describe, expect, it } from "vitest";
import { autoColor, categoryColors, daysBetween, hslToHex, isLight, dueIn, fromLocalInput, subtaskCount, utcDate } from "./todo";
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
    category_color: null, created_at: null, completed_at: null, due_at: null, images: [],
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
  it("prefers the color that the user set", () => {
    expect(categoryColors(120, "#ffee00")).toMatchObject({ chip: "#ffee00", bar: "#ffee00", text: "#111111" });
    expect(categoryColors(120, "#102030")?.text).toBe("#ffffff");
    expect(categoryColors(null, "#102030")?.chip).toBe("#102030");
    expect(categoryColors(120, "bad")?.chip).toContain("hsl(120");
  });
  it("converts HSL to hex", () => {
    expect(hslToHex(0, 1, 0.5)).toBe("#ff0000");
    expect(hslToHex(120, 1, 0.25)).toBe("#008000");
    expect(autoColor(0)).toMatch(/^#[0-9a-f]{6}$/);
    expect(isLight("#ffffff")).toBe(true);
    expect(isLight("#000000")).toBe(false);
  });
});
