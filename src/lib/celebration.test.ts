import { describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: { shapeFromText: () => "circle" } }));

import { CELEBRATION_STYLES, celebrationStyle, intensity } from "./celebration";
import type { Options } from "canvas-confetti";

describe("celebration", () => {
  it("falls back to the defaults", () => {
    expect(celebrationStyle("nope").id).toBe("burst");
    expect(intensity(null).scale).toBe(1);
    expect(intensity("many").scale).toBe(2);
  });

  it("has unique ids", () => {
    expect(new Set(CELEBRATION_STYLES.map((c) => c.id)).size).toBe(CELEBRATION_STYLES.length);
  });

  it("scales the particle count of each style", () => {
    vi.useFakeTimers();
    for (const style of CELEBRATION_STYLES) {
      const total = (scale: number) => {
        const shots: Options[] = [];
        style.run((o) => shots.push(o), scale);
        vi.advanceTimersByTime(3000);
        return shots.reduce((n, o) => n + (o.particleCount ?? 0), 0);
      };
      const normal = total(1);
      expect(normal, style.id).toBeGreaterThan(0);
      expect(total(2), style.id).toBeGreaterThan(normal);
    }
    vi.useRealTimers();
  });
});
