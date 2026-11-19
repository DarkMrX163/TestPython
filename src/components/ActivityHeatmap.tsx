import { useMemo } from 'react';
import { calculateDailyStreak, getLocalDateKey } from '../utils/storage';

interface ActivityHeatmapProps {
  activityByDate: Record<string, number>;
}

const WEEKS_COUNT = 16;

function getLevelClass(count: number): string {
  if (count <= 0) return 'bg-[#161B22] border-[#30363D]/70';
  if (count <= 3) return 'bg-[#0E4429] border-[#0E4429]';
  if (count <= 7) return 'bg-[#006D32] border-[#006D32]';
  if (count <= 14) return 'bg-[#26A641] border-[#26A641]';
  return 'bg-[#39D353] border-[#39D353]';
}

export function ActivityHeatmap({ activityByDate }: ActivityHeatmapProps) {
  const { weeks, activeDays, totalTasksPeriod } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Align grid end to current week (Sunday = 6 in Mon-first grid)
    const jsDay = today.getDay(); // 0=Sun..6=Sat
    const monOffset = jsDay === 0 ? 6 : jsDay - 1;
    const totalDays = (WEEKS_COUNT - 1) * 7 + monOffset + 1;

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (totalDays - 1));

    const columns: Array<Array<{ key: string; label: string; count: number } | null>> = [];
    let daysWithActivity = 0;
    let sumTasks = 0;

    for (let w = 0; w < WEEKS_COUNT; w++) {
      const col: Array<{ key: string; label: string; count: number } | null> = [];
      for (let d = 0; d < 7; d++) {
        const idx = w * 7 + d;
        if (idx >= totalDays) {
          col.push(null);
          continue;
        }
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + idx);
        const key = getLocalDateKey(cellDate);
        const count = activityByDate[key] ?? 0;
        if (count > 0) daysWithActivity += 1;
        sumTasks += count;

        const label = cellDate.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
        });
        col.push({ key, label, count });
      }
      columns.push(col);
    }

    return {
      weeks: columns,
      activeDays: daysWithActivity,
      totalTasksPeriod: sumTasks,
    };
  }, [activityByDate]);

  const dailyStreak = calculateDailyStreak(activityByDate);

  return (
    <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
            Календарь практики (как на GitHub)
          </h2>
          <p className="font-mono text-xs text-[#8B949E] tabular-nums">
            За {WEEKS_COUNT} недель: {totalTasksPeriod} задач · активных дней: {activeDays} · серия дней: {dailyStreak}
          </p>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#8B949E] shrink-0">
          <span>Меньше</span>
          <span className="w-3 h-3 rounded-[2px] border bg-[#161B22] border-[#30363D]" />
          <span className="w-3 h-3 rounded-[2px] border bg-[#0E4429] border-[#0E4429]" />
          <span className="w-3 h-3 rounded-[2px] border bg-[#006D32] border-[#006D32]" />
          <span className="w-3 h-3 rounded-[2px] border bg-[#26A641] border-[#26A641]" />
          <span className="w-3 h-3 rounded-[2px] border bg-[#39D353] border-[#39D353]" />
          <span>Больше</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1.5">
          <div className="flex flex-col justify-between py-0.5 pr-1 font-mono text-[10px] text-[#6E7681] select-none">
            <span>Пн</span>
            <span>Ср</span>
            <span>Пт</span>
          </div>
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1.5">
              {week.map((day, dIdx) =>
                day ? (
                  <div
                    key={day.key}
                    title={`${day.label}: ${day.count} задач`}
                    aria-label={`${day.label}: ${day.count} задач`}
                    className={`w-3.5 h-3.5 rounded-[3px] border transition-colors ${getLevelClass(
                      day.count
                    )}`}
                  />
                ) : (
                  <div key={`empty-${wIdx}-${dIdx}`} className="w-3.5 h-3.5" />
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
