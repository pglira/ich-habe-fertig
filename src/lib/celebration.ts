import type { Options, Shape } from "canvas-confetti";
import confetti from "canvas-confetti";

// The celebration when a todo or a sub-task is completed: presets for
// `canvas-confetti`.

export type Fire = (options: Options) => void;

export interface CelebrationStyle {
  id: string;
  name: string;
  // Fires the confetti. `scale` multiplies the particle counts.
  run: (fire: Fire, scale: number) => void;
}

export interface Intensity {
  id: string;
  name: string;
  scale: number;
}

export const INTENSITIES: Intensity[] = [
  { id: "few", name: "Few", scale: 0.5 },
  { id: "normal", name: "Normal", scale: 1 },
  { id: "many", name: "Many", scale: 2 },
];

const PALETTE = ["#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93", "#FF924C", "#F7B2BD"];
const GOLD = ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"];

const count = (n: number, scale: number) => Math.max(1, Math.round(n * scale));

// Fires bursts at random positions for `ms` milliseconds.
function repeat(ms: number, every: number, each: (left: number) => void) {
  const end = Date.now() + ms;
  const id = window.setInterval(() => {
    const left = end - Date.now();
    if (left <= 0) return window.clearInterval(id);
    each(left / ms);
  }, every);
}

let emojiShapes: Shape[] | null = null;
function emojis(): Shape[] {
  emojiShapes ??= ["🎉", "✅", "⭐", "🥳"].map((text) => confetti.shapeFromText({ text, scalar: 2 }));
  return emojiShapes;
}

export const CELEBRATION_STYLES: CelebrationStyle[] = [
  {
    id: "burst",
    name: "Burst",
    run: (fire, s) => fire({ particleCount: count(100, s), spread: 70, origin: { y: 0.6 }, colors: PALETTE }),
  },
  {
    id: "realistic",
    name: "Realistic",
    run: (fire, s) => {
      const base = { origin: { y: 0.7 }, colors: PALETTE };
      fire({ ...base, particleCount: count(50, s), spread: 26, startVelocity: 55 });
      fire({ ...base, particleCount: count(40, s), spread: 60 });
      fire({ ...base, particleCount: count(70, s), spread: 100, decay: 0.91, scalar: 0.8 });
      fire({ ...base, particleCount: count(20, s), spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire({ ...base, particleCount: count(20, s), spread: 120, startVelocity: 45 });
    },
  },
  {
    id: "cannons",
    name: "Side cannons",
    run: (fire, s) =>
      repeat(1200, 120, () => {
        fire({ particleCount: count(6, s), angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: PALETTE });
        fire({ particleCount: count(6, s), angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: PALETTE });
      }),
  },
  {
    id: "fireworks",
    name: "Fireworks",
    run: (fire, s) =>
      repeat(2000, 250, (left) => {
        const opts = { particleCount: count(40 * left, s), spread: 360, startVelocity: 30, ticks: 60, colors: PALETTE };
        fire({ ...opts, origin: { x: 0.1 + Math.random() * 0.3, y: Math.random() * 0.4 + 0.1 } });
        fire({ ...opts, origin: { x: 0.6 + Math.random() * 0.3, y: Math.random() * 0.4 + 0.1 } });
      }),
  },
  {
    id: "stars",
    name: "Stars",
    run: (fire, s) => {
      const opts: Options = { spread: 360, ticks: 60, gravity: 0, decay: 0.94, startVelocity: 30, colors: GOLD, origin: { y: 0.5 } };
      fire({ ...opts, particleCount: count(40, s), scalar: 1.2, shapes: ["star"] });
      fire({ ...opts, particleCount: count(15, s), scalar: 0.75, shapes: ["circle"] });
    },
  },
  {
    id: "emoji",
    name: "Emoji",
    run: (fire, s) =>
      fire({ particleCount: count(40, s), spread: 100, startVelocity: 35, scalar: 2, shapes: emojis(), flat: true, origin: { y: 0.6 } }),
  },
];

export const CELEBRATION_DEFAULT = "burst";
export const INTENSITY_DEFAULT = "normal";

export function celebrationStyle(id: string | null | undefined): CelebrationStyle {
  return CELEBRATION_STYLES.find((c) => c.id === id) ?? CELEBRATION_STYLES[0];
}

export function intensity(id: string | null | undefined): Intensity {
  return INTENSITIES.find((i) => i.id === id) ?? INTENSITIES[1];
}
