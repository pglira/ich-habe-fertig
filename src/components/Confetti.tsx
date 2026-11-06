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
  // Increments on each stop. A run fires only while its generation is current,
  // so the delayed bursts of a stopped run do not fire.
  const generation = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const f = confetti.create(canvasRef.current, { resize: true, disableForReducedMotion: true });
    fire.current = f;
    // A hidden or minimized window pauses the animation frames, so a running
    // celebration would resume when the window shows again. Stop it instead.
    const stop = () => {
      generation.current++;
      f.reset();
    };
    const onVisibility = () => document.hidden && stop();
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  useImperativeHandle(ref, () => {
    const run = () => {
      const f = fire.current;
      if (!f) return;
      const c = current.current;
      const g = generation.current;
      celebrationStyle(c.style).run((o) => {
        if (g === generation.current) void f(o);
      }, intensity(c.intensity).scale);
    };
    return {
      burst: () => current.current.enabled && run(),
      preview: run,
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60] size-full" />;
});
