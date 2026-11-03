import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

const PALETTE = ["#FF595E", "#FFCA3A", "#8AC926", "#1982C4", "#6A4C93", "#FF924C", "#F7B2BD"];
const COUNT = 80;
const GRAVITY = 900;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

export interface ConfettiHandle {
  burst: () => void;
}

// A canvas above the whole window. `burst()` throws confetti from the center;
// the particles fall with gravity and fade out in two seconds.
export const Confetti = forwardRef<ConfettiHandle>(function Confetti(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const frame = useRef<number | null>(null);
  const last = useRef(0);

  const step = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dt = Math.min(Math.max((t - last.current) / 1000, 0), 0.05);
    last.current = t;
    for (const p of particles.current) {
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.5;
    }
    particles.current = particles.current.filter((p) => p.life > 0);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles.current) {
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    frame.current = particles.current.length ? requestAnimationFrame(step) : null;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      burst() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        for (let i = 0; i < COUNT; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 150 + Math.random() * 270;
          particles.current.push({
            x: cx + (Math.random() * 80 - 40),
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: -Math.abs(Math.sin(angle) * speed) - 100,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            size: 4 + Math.floor(Math.random() * 5),
            life: 1,
          });
        }
        if (frame.current === null) {
          last.current = performance.now();
          frame.current = requestAnimationFrame(step);
        }
      },
    }),
    [step],
  );

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60]" />;
});
