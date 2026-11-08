"use client";
import { useEffect, useRef } from 'react';

export function Tally({ value, className = '' }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = Number(el.dataset.prev ?? 0);
    if (start === value) return;
    const duration = 220;
    const startTime = performance.now();
    const raf = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(start + (value - start) * eased).toLocaleString();
      if (t < 1) requestAnimationFrame(raf);
      else { el.dataset.prev = String(value); }
    };
    requestAnimationFrame(raf);
  }, [value]);

  return (
    <span ref={ref} className={`font-num ${className}`} data-prev={value}>
      {value.toLocaleString()}
    </span>
  );
}
