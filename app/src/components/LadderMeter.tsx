"use client";
const TOTAL = 15;

export function LadderMeter({ todayScans }: { todayScans: number }) {
  const filled = Math.min(todayScans, 15);
  const tier = todayScans <= 8 ? 1 : todayScans <= 15 ? 2 : 3;

  return (
    <div>
      <div className="ladder-meter" role="progressbar" aria-valuenow={todayScans} aria-valuemax={15} aria-label={`${todayScans} marks today`}>
        {Array.from({ length: TOTAL }, (_, i) => {
          const rungNum = i + 1;
          const isFilled = rungNum <= filled;
          const isCurrent = rungNum === filled && filled > 0;
          let cls = 'ladder-rung';
          if (!isFilled) cls += ' empty';
          else if (rungNum > 8) cls += ' tier2';
          if (isCurrent) cls += ' current';
          return <span key={i} className={cls} />;
        })}
      </div>
      <p className="text-sm text-muted" style={{ marginTop: 6 }}>
        {filled} marks today · {tier === 1 ? 'full value' : tier === 2 ? 'half value' : 'quarter value'}
        {todayScans < 8 && ` · ${8 - todayScans} until half value`}
      </p>
    </div>
  );
}
