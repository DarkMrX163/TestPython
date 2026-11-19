import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TraceStep } from '../types';

interface ExecutionTracePanelProps {
  trace: TraceStep[];
  stepIndex: number;
  onStepChange: (nextIndex: number) => void;
}

export function ExecutionTracePanel({
  trace,
  stepIndex,
  onStepChange,
}: ExecutionTracePanelProps) {
  const [autoPlaying, setAutoPlaying] = useState(false);

  const safeIndex = Math.min(Math.max(0, stepIndex), trace.length - 1);
  const current = trace[safeIndex];

  useEffect(() => {
    if (!autoPlaying) return;
    if (safeIndex >= trace.length - 1) {
      setAutoPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      onStepChange(safeIndex + 1);
    }, 1150);
    return () => window.clearTimeout(timer);
  }, [autoPlaying, safeIndex, trace.length, onStepChange]);

  if (!current) return null;

  return (
    <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#30363D]">
        <div className="font-mono text-xs text-[#E6EDF3] tabular-nums">
          Пошаговая трассировка ·{' '}
          <span className="text-[#58A6FF]">
            Шаг {safeIndex + 1} / {trace.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safeIndex <= 0}
            onClick={() => {
              setAutoPlaying(false);
              onStepChange(safeIndex - 1);
            }}
            aria-label="Предыдущий шаг"
            className="p-1.5 rounded border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-40 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!autoPlaying && safeIndex >= trace.length - 1) {
                onStepChange(0);
              }
              setAutoPlaying((prev) => !prev);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded border border-[#30363D] text-[#E6EDF3] hover:bg-[#21262D] cursor-pointer transition-colors whitespace-nowrap"
          >
            {autoPlaying ? (
              <>
                <Pause className="w-3 h-3 text-[#E3B341]" />
                <span>Пауза</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-[#3FB950]" />
                <span>Авто</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={safeIndex >= trace.length - 1}
            onClick={() => {
              setAutoPlaying(false);
              onStepChange(safeIndex + 1);
            }}
            aria-label="Следующий шаг"
            className="p-1.5 rounded border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-40 cursor-pointer transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Current Step Note */}
      <div className="text-xs sm:text-sm text-[#C9D1D9] leading-relaxed">
        <span className="font-mono text-[#58A6FF] mr-1.5">Строка {current.line}:</span>
        {current.note}
      </div>

      {/* Variables Watch Table */}
      {current.variables.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-mono text-[11px] text-[#8B949E]">Переменные в памяти</div>
          <div className="divide-y divide-[#30363D] rounded border border-[#30363D] bg-[#161B22] font-mono text-xs tabular-nums">
            {current.variables.map((v) => (
              <div
                key={v.name}
                className="px-3 py-1.5 flex items-center justify-between gap-3"
              >
                <span className="text-[#E6EDF3]">
                  {v.name}{' '}
                  <span className="text-[#6E7681] font-normal">: {v.type}</span>
                </span>
                <span
                  className={
                    v.changed ? 'text-[#E3B341] font-semibold' : 'text-[#A5D6FF]'
                  }
                >
                  {v.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {current.output !== undefined && (
        <div className="font-mono text-xs text-[#3FB950] pt-1">
          stdout: <span className="text-[#E6EDF3]">{current.output}</span>
        </div>
      )}
    </div>
  );
}
