"use client";
export type Faction = 'artificer' | 'broker' | 'weaver' | 'patron';

const SIGILS: Record<Faction, React.ReactNode> = {
  artificer: (
    // Compass/gear
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="16" cy="16" r="2" fill="currentColor"/>
      <line x1="16" y1="6" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="22" x2="16" y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="16" x2="10" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="22" y1="16" x2="26" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20 12l-4 4-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  broker: (
    // Scales
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="10" x2="24" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="17" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="24" cy="17" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="8" y1="10" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="24" y1="10" x2="24" y2="13" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  weaver: (
    // Spiral/quill
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 4c-6 0-10 4-10 8s4 6 8 4-2-8 4-8 8 6 2 12-10 4-10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="24" x2="20" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  patron: (
    // Crown
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 22l3-12 7 7 7-7 3 12H6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="6" y1="26" x2="26" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="10" r="2" fill="currentColor"/>
    </svg>
  ),
};

export function RoleSigil({ role, size = 32, className = '' }: { role: string; size?: number; className?: string }) {
  const faction = (role?.toLowerCase() ?? '') as Faction;
  const colorVar = `var(--${faction}, var(--muted))`;
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, color: colorVar, flexShrink: 0 }}
      aria-label={`${faction} sigil`}
    >
      {SIGILS[faction] ?? SIGILS.artificer}
    </span>
  );
}
