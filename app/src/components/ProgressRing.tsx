export function ProgressRing({ value, max, faction, size = 44 }: { value: number; max: number; faction: string; size?: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const dash = circumference * pct;
  const color = `var(--${faction?.toLowerCase()}, var(--brass))`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${value} of ${max}`}>
      {/* track */}
      <circle cx={size/2} cy={size/2} r={r} stroke="var(--ink-800)" strokeWidth="3" fill="none" />
      {/* fill */}
      <circle
        cx={size/2} cy={size/2} r={r}
        stroke={color} strokeWidth="3" fill="none"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        className="progress-ring"
      />
    </svg>
  );
}
