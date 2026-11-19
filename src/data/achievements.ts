import type { AchievementDef, DeveloperRank, UserProgress } from '../types';
import { DIFFICULTY_META, TOPIC_META } from './questions';

export const DEVELOPER_RANKS: DeveloperRank[] = [
  { level: 1, title: 'Стажёр терминала', minXp: 0, nextXp: 120, promptSymbol: '$' },
  { level: 2, title: 'Джуниор-питонист', minXp: 120, nextXp: 300, promptSymbol: '>>>' },
  { level: 3, title: 'Укротитель циклов', minXp: 300, nextXp: 550, promptSymbol: 'py>' },
  { level: 4, title: 'Инженер алгоритмов', minXp: 550, nextXp: 900, promptSymbol: 'dev#' },
  { level: 5, title: 'Архитектор Python', minXp: 900, nextXp: null, promptSymbol: 'root#' },
];

export function getDeveloperRank(xp: number): DeveloperRank {
  let current = DEVELOPER_RANKS[0];
  for (const rank of DEVELOPER_RANKS) {
    if (xp >= rank.minXp) {
      current = rank;
    }
  }
  return current;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-run',
    title: 'Первый запуск',
    description: 'Заверши свою самую первую викторину по Python.',
    xpReward: 25,
    asciiArt: '[ >_ RUN ]',
    requirementLabel: 'Пройти 1 тест',
    check: (p) => p.sessions.length >= 1,
  },
  {
    id: 'flawless-code',
    title: 'Безупречный код',
    description: 'Пройди любой тест без единой ошибки (100% точность).',
    xpReward: 60,
    asciiArt: '[ 0 ERR ]',
    requirementLabel: '100% в тесте',
    check: (p) => p.sessions.some((s) => s.accuracy === 100 && s.total >= 5),
  },
  {
    id: 'streak-5',
    title: 'Серия x5',
    description: 'Ответь правильно на 5 вопросов подряд без промахов.',
    xpReward: 40,
    asciiArt: '[ 5x COMBO ]',
    requirementLabel: 'Серия 5 ответов',
    check: (p) => p.bestStreak >= 5,
  },
  {
    id: 'streak-10',
    title: 'Неостановимый скрипт',
    description: 'Доведи серию правильных ответов до 10 подряд.',
    xpReward: 80,
    asciiArt: '[ 10x LOOP ]',
    requirementLabel: 'Серия 10 ответов',
    check: (p) => p.bestStreak >= 10,
  },
  {
    id: 'beginner-master',
    title: 'Мастер синтаксиса',
    description: 'Реши верно минимум 8 вопросов базового уровня.',
    xpReward: 50,
    asciiArt: '[ print() ]',
    requirementLabel: '8 базовых задач',
    check: (p) => p.difficultyStats.beginner.correct >= 8,
  },
  {
    id: 'intermediate-pro',
    title: 'Повелитель циклов',
    description: 'Реши верно минимум 8 вопросов среднего уровня.',
    xpReward: 70,
    asciiArt: '[ for i: ]',
    requirementLabel: '8 средних задач',
    check: (p) => p.difficultyStats.intermediate.correct >= 8,
  },
  {
    id: 'advanced-architect',
    title: 'Архитектор функций',
    description: 'Реши верно минимум 7 вопросов продвинутого уровня.',
    xpReward: 100,
    asciiArt: '[ def fn() ]',
    requirementLabel: '7 сложных задач',
    check: (p) => p.difficultyStats.advanced.correct >= 7,
  },
  {
    id: 'bug-hunter',
    title: 'Охотник за багами',
    description: 'Набери 20 правильных ответов за всё время обучения.',
    xpReward: 60,
    asciiArt: '[ DEBUG ]',
    requirementLabel: '20 верных ответов',
    check: (p) => p.totalCorrect >= 20,
  },
  {
    id: 'speed-compiler',
    title: 'Скоростной интерпретатор',
    description: 'Пройди тест быстрее 75 секунд с точностью не ниже 80%.',
    xpReward: 75,
    asciiArt: '[ FAST O(1) ]',
    requirementLabel: '< 75 сек, >= 80%',
    check: (p) => p.sessions.some((s) => s.durationSec <= 75 && s.accuracy >= 80 && s.total >= 5),
  },
  {
    id: 'full-stack-explorer',
    title: 'Полный стек знаний',
    description: 'Попробуй все три уровня сложности: Базовый, Средний и Продвинутый.',
    xpReward: 85,
    asciiArt: '[ ALL 3 LVL ]',
    requirementLabel: 'Все 3 уровня',
    check: (p) =>
      p.completedModes.includes('beginner') &&
      p.completedModes.includes('intermediate') &&
      p.completedModes.includes('advanced'),
  },
  {
    id: 'github-committer',
    title: 'Коммит в облако',
    description: 'Сохрани свой прогресс по Python в GitHub Gist.',
    xpReward: 50,
    asciiArt: '[ git push ]',
    requirementLabel: 'Синхронизация GitHub',
    check: (p) => p.githubSync.syncCount >= 1,
  },
];

export function evaluateAchievements(progress: UserProgress): {
  newlyUnlocked: AchievementDef[];
  updatedProgress: UserProgress;
} {
  const already = new Set(progress.unlockedAchievements);
  const newlyUnlocked: AchievementDef[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (!already.has(ach.id) && ach.check(progress)) {
      already.add(ach.id);
      newlyUnlocked.push(ach);
    }
  }

  if (newlyUnlocked.length === 0) {
    return { newlyUnlocked: [], updatedProgress: progress };
  }

  const bonusXp = newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0);
  return {
    newlyUnlocked,
    updatedProgress: {
      ...progress,
      xp: progress.xp + bonusXp,
      unlockedAchievements: Array.from(already),
    },
  };
}

export function generateMarkdownReport(progress: UserProgress, githubLogin?: string | null): string {
  const rank = getDeveloperRank(progress.xp);
  const overallAccuracy =
    progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
      : 0;

  const unlockedList = ACHIEVEMENTS.filter((a) => progress.unlockedAchievements.includes(a.id));

  const topicRows = (Object.keys(TOPIC_META) as Array<keyof typeof TOPIC_META>).map((topicKey) => {
    const stat = progress.topicStats[topicKey] || { answered: 0, correct: 0 };
    const acc = stat.answered > 0 ? Math.round((stat.correct / stat.answered) * 100) : 0;
    return `| ${TOPIC_META[topicKey].label} | ${stat.correct} / ${stat.answered} | ${acc}% |`;
  });

  const diffRows = (Object.keys(DIFFICULTY_META) as Array<keyof typeof DIFFICULTY_META>).map(
    (diffKey) => {
      const stat = progress.difficultyStats[diffKey] || { answered: 0, correct: 0 };
      const acc = stat.answered > 0 ? Math.round((stat.correct / stat.answered) * 100) : 0;
      return `| ${DIFFICULTY_META[diffKey].label} (${DIFFICULTY_META[diffKey].ageRange}) | ${stat.correct} / ${stat.answered} | ${acc}% |`;
    }
  );

  const recentSessions = progress.sessions.slice(0, 8).map((s) => {
    const dateStr = new Date(s.date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const modeLabel =
      s.mode === 'mixed' ? 'Смешанный' : DIFFICULTY_META[s.mode].label;
    return `| ${dateStr} | ${modeLabel} | ${s.score}/${s.total} (${s.accuracy}%) | +${s.xpEarned} XP | ${s.durationSec} с |`;
  });

  return [
    `# PyTerm — Отчёт о прогрессе по Python`,
    ``,
    githubLogin ? `**Разработчик:** [@${githubLogin}](https://github.com/${githubLogin})` : `**Участник:** Юный разработчик Python`,
    `**Дата обновления:** ${new Date().toLocaleString('ru-RU')}`,
    ``,
    `## Профиль`,
    ``,
    `- **Ранг:** Уровень ${rank.level} — ${rank.title}`,
    `- **Опыт (XP):** ${progress.xp} XP`,
    `- **Решено задач:** ${progress.totalCorrect} из ${progress.totalAnswered} (${overallAccuracy}%)`,
    `- **Лучшая серия:** ${progress.bestStreak} подряд`,
    `- **Открыто достижений:** ${unlockedList.length} / ${ACHIEVEMENTS.length}`,
    ``,
    `## Прогресс по уровням сложности`,
    ``,
    `| Уровень | Верно / Всего | Точность |`,
    `| --- | --- | --- |`,
    ...diffRows,
    ``,
    `## Прогресс по темам`,
    ``,
    `| Тема | Верно / Всего | Точность |`,
    `| --- | --- | --- |`,
    ...topicRows,
    ``,
    `## Открытые достижения`,
    ``,
    ...(unlockedList.length > 0
      ? unlockedList.map((a) => `- \`${a.asciiArt}\` **${a.title}** — ${a.description}`)
      : [`- Пока достижений нет. Пройди первую викторину!`]),
    ``,
    `## Последние сессии`,
    ``,
    ...(recentSessions.length > 0
      ? [
          `| Дата | Режим | Результат | Опыт | Время |`,
          `| --- | --- | --- | --- | --- |`,
          ...recentSessions,
        ]
      : [`Пока нет завершённых сессий.`]),
    ``,
  ].join('\n');
}
