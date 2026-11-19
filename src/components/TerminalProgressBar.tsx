interface TerminalProgressBarProps {
  value: number;
  max: number;
  segments?: number;
  accent?: 'emerald' | 'gold' | 'sky';
  showPercent?: boolean;
  label?: string;
}

export function TerminalProgressBar({
  value,
  max,
  segments = 16,
  accent = 'emerald',
  showPercent = true,
  label,
}: TerminalProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = Math.round(ratio * segments);
  const empty = Math.max(0, segments - filled);
  const percent = Math.round(ratio * 100);

  const accentColor =
    accent === 'gold'
      ? 'text-[#E3B341]'
      : accent === 'sky'
        ? 'text-[#58A6FF]'
        : 'text-[#3FB950]';

  return (
    <div
      className="font-mono text-xs sm:text-sm flex items-center gap-2.5 tabular-nums"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <span className="tracking-tight select-none shrink-0">
        <span className="text-[#484F58]">[</span>
        <span className={accentColor}>{'█'.repeat(filled)}</span>
        <span className="text-[#30363D]">{'░'.repeat(empty)}</span>
        <span className="text-[#484F58]">]</span>
      </span>
      {showPercent && <span className="text-[#8B949E] shrink-0">{percent}%</span>}
    </div>
  );
}
