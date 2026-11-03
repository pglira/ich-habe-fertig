import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import confetti from "canvas-confetti";
import { celebrationStyle, intensity } from "@/lib/celebration";
import { useSettings } from "@/lib/settings";

export interface ConfettiHandle {
  // Celebrates with the style and the intensity of the settings, if the
  // celebration is on.
  burst: () => void;
  // Celebrates also if the celebration is off.
  preview: () => void;
}

// A canvas above the whole window for `canvas-confetti`.
export const Confetti = forwardRef<ConfettiHandle>(function Confetti(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fire = useRef<confetti.CreateTypes | null>(null);
  const { celebration } = useSettings();
  const current = useRef(celebration);
  current.current = celebration;

  useEffect(() => {
    if (!canvasRef.current) return;
    fire.current = confetti.create(canvasRef.current, { resize: true, disableForReducedMotion: true });
    return () => fire.current?.reset();
  }, []);

  useImperativeHandle(ref, () => {
    const run = () => {
      const f = fire.current;
      if (!f) return;
      const c = current.current;
      celebrationStyle(c.style).run((o) => void f(o), intensity(c.intensity).scale);
    };
    return {
      burst: () => current.current.enabled && run(),
      preview: run,
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60] size-full" />;
});
