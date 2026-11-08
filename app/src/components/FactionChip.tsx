export type Faction = 'artificer' | 'broker' | 'weaver' | 'patron';

const LABELS: Record<Faction, string> = {
  artificer: 'Artificer',
  broker: 'Broker',
  weaver: 'Weaver',
  patron: 'Patron',
};

export function FactionChip({ role }: { role: string }) {
  const faction = (role?.toLowerCase() ?? '') as Faction;
  return (
    <span className={`faction-chip ${faction}`} aria-label={`Role: ${LABELS[faction] ?? role}`}>
      {LABELS[faction] ?? role}
    </span>
  );
}
