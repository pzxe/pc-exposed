
/** Circular score gauge. `score === null` renders an explicit "no score" state. */
export function ScoreRing({ score, size = 200, label }: { score: number | null; size?: number; label?: string }) {
  const r = (size - 24) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : score / 100;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={score === null ? "No score" : `Score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f1ddfe" />
            <stop offset="100%" stopColor="#a879ff" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a2237" strokeWidth={14} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={14} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-bold tabular-nums">{score === null ? "—" : score}</span>
        <span className="text-xs tracking-widest text-muted">{label ?? "OUT OF 100"}</span>
      </div>
    </div>
  );
}

export function ScoreBar({ score }: { score: number | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <div className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent-soft transition-[width] duration-700" style={{ width: `${score ?? 0}%` }} />
    </div>
  );
}
