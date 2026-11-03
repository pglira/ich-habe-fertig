import { describe, expect, it } from "vitest";
import { NOTES_FONTS, NOTES_FONT_DEFAULT, notesFont } from "./fonts";

describe("notesFont", () => {
  it("finds a font by id", () => {
    expect(notesFont("inter").name).toBe("Inter");
  });
  it("falls back to the default font", () => {
    expect(notesFont(null).id).toBe(NOTES_FONT_DEFAULT);
    expect(notesFont("unknown").id).toBe(NOTES_FONT_DEFAULT);
  });
  it("has unique ids", () => {
    expect(new Set(NOTES_FONTS.map((f) => f.id)).size).toBe(NOTES_FONTS.length);
  });
});
