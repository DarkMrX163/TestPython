import {
  Check,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  Github,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { generateMarkdownReport } from '../data/achievements';
import type { GitHubConfig, GitHubUser, SavedGistItem, UserProgress } from '../types';

interface GitHubSyncViewProps {
  progress: UserProgress;
  githubConfig: GitHubConfig | null;
  githubUser: GitHubUser | null;
  savedGists: SavedGistItem[];
  loadingGists: boolean;
  syncing: boolean;
  restoringId: string | null;
  statusMessage: { type: 'success' | 'error'; text: string } | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSaveToGist: (isPublic: boolean, createNew: boolean) => void;
  onRefreshGists: () => void;
  onRestoreGist: (gistId: string) => void;
}

export function GitHubSyncView({
  progress,
  githubConfig,
  githubUser,
  savedGists,
  loadingGists,
  syncing,
  restoringId,
  statusMessage,
  onConnect,
  onDisconnect,
  onSaveToGist,
  onRefreshGists,
  onRestoreGist,
}: GitHubSyncViewProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const markdownReport = generateMarkdownReport(progress, githubUser?.login);

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(markdownReport);
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleDownloadReport = () => {
    const blob = new Blob([markdownReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'python-quiz-report.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyCallback = async () => {
    if (!githubConfig?.callbackUrl) return;
    try {
      await navigator.clipboard.writeText(githubConfig.callbackUrl);
      setCopiedCallback(true);
      window.setTimeout(() => setCopiedCallback(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-[#30363D] max-w-3xl">
        <h1 className="font-mono text-2xl sm:text-3xl font-semibold text-[#E6EDF3] text-balance">
          Синхронизация с GitHub
        </h1>
        <p className="text-sm sm:text-base text-[#8B949E] leading-relaxed">
          Сохраняй свои результаты, статистику и достижения в личный GitHub Gist — так ты сможешь делиться отчётом с преподавателем, добавлять его в портфолио и переносить прогресс между устройствами.
        </p>
      </div>

      {/* Status Notification */}
      {statusMessage && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 font-mono text-xs sm:text-sm flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'border-[#3FB950]/50 bg-[#2EA043]/10 text-[#3FB950]'
              : 'border-[#F85149]/50 bg-[#F85149]/10 text-[#F85149]'
          }`}
        >
          <span>{statusMessage.text}</span>
          {progress.githubSync.gistUrl && statusMessage.type === 'success' && (
            <a
              href={progress.githubSync.gistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline underline-offset-4 whitespace-nowrap shrink-0 hover:opacity-80"
            >
              <span>Открыть Gist</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Account & Cloud Sync */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
                Аккаунт GitHub
              </h2>
              <span className="font-mono text-xs text-[#8B949E]">
                {githubUser ? 'Подключён' : 'Не подключён'}
              </span>
            </div>

            {githubUser ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#30363D]">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {!avatarFailed && githubUser.avatar_url ? (
                      <img
                        src={githubUser.avatar_url}
                        alt={`Аватар ${githubUser.login}`}
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarFailed(true)}
                        className="w-11 h-11 rounded-lg border border-[#30363D] object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg border border-[#30363D] bg-[#21262D] flex items-center justify-center font-mono text-sm font-semibold text-[#E6EDF3] shrink-0">
                        {githubUser.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold text-[#E6EDF3] truncate">
                        {githubUser.name || githubUser.login}
                      </div>
                      <a
                        href={githubUser.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-[#58A6FF] hover:underline inline-flex items-center gap-1"
                      >
                        <span>@{githubUser.login}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#8B949E] hover:text-[#E6EDF3] border border-[#30363D] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Выйти</span>
                  </button>
                </div>

                {/* Visibility Toggle & Save Actions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-xs text-[#8B949E]">Доступность Gist</span>
                    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0D1117] border border-[#30363D]">
                      <button
                        type="button"
                        onClick={() => setIsPublic(false)}
                        className={`px-3 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                          !isPublic ? 'bg-[#21262D] text-[#E6EDF3]' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                        }`}
                      >
                        Приватный
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPublic(true)}
                        className={`px-3 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                          isPublic ? 'bg-[#21262D] text-[#E6EDF3]' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                        }`}
                      >
                        Публичный
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={() => onSaveToGist(isPublic, false)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-mono font-medium bg-[#2EA043] hover:bg-[#3FB950] disabled:opacity-50 text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <CloudUpload className="w-4 h-4" />
                      <span>
                        {syncing
                          ? 'Сохранение...'
                          : progress.githubSync.gistId
                            ? 'Обновить Gist на GitHub'
                            : 'Сохранить в GitHub Gist'}
                      </span>
                    </button>

                    {progress.githubSync.gistId && (
                      <button
                        type="button"
                        disabled={syncing}
                        onClick={() => onSaveToGist(isPublic, true)}
                        className="px-3.5 py-2.5 text-xs font-mono text-[#E6EDF3] border border-[#30363D] hover:bg-[#21262D] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Создать новый Gist
                      </button>
                    )}
                  </div>

                  {progress.githubSync.lastSyncedAt && (
                    <div className="pt-3 border-t border-[#30363D] flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-[#8B949E]">
                      <span>
                        Последнее сохранение:{' '}
                        {new Date(progress.githubSync.lastSyncedAt).toLocaleString('ru-RU')}
                      </span>
                      {progress.githubSync.gistUrl && (
                        <a
                          href={progress.githubSync.gistUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#58A6FF] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <span>Открыть на GitHub</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#8B949E] leading-relaxed">
                  Подключи свой аккаунт GitHub через OAuth, чтобы автоматически сохранять файлы{' '}
                  <code className="font-mono text-xs text-[#E6EDF3]">python-quiz-report.md</code> и{' '}
                  <code className="font-mono text-xs text-[#E6EDF3]">pyterm-progress.json</code> в GitHub Gist.
                </p>

                {githubConfig?.configured ? (
                  <button
                    type="button"
                    onClick={onConnect}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-mono font-medium bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Github className="w-4 h-4" />
                    <span>Войти через GitHub</span>
                  </button>
                ) : (
                  <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-4 space-y-3 font-mono text-xs">
                    <div className="text-[#E3B341] font-medium">
                      Требуется настройка GitHub OAuth App
                    </div>
                    <p className="text-[#8B949E] font-sans text-xs leading-relaxed">
                      Чтобы включить вход через GitHub, создай OAuth App в настройках разработчика GitHub и добавь переменные{' '}
                      <code className="font-mono text-[#E6EDF3]">GITHUB_CLIENT_ID</code> и{' '}
                      <code className="font-mono text-[#E6EDF3]">GITHUB_CLIENT_SECRET</code> в секреты приложения.
                    </p>
                    {githubConfig?.callbackUrl && (
                      <div className="space-y-1.5">
                        <div className="text-[#8B949E]">Authorization callback URL:</div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-[#161B22] border border-[#30363D]">
                          <code className="text-[#58A6FF] truncate">{githubConfig.callbackUrl}</code>
                          <button
                            type="button"
                            onClick={handleCopyCallback}
                            className="inline-flex items-center gap-1 text-[#8B949E] hover:text-[#E6EDF3] cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {copiedCallback ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#3FB950]" />
                                <span className="text-[#3FB950]">Скопировано</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Копировать</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="text-[#8B949E] font-sans text-xs">
                      Пока OAuth не настроен, ты можешь скопировать или скачать готовый Markdown-отчёт справа и загрузить его в свой репозиторий или Gist вручную.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Saved Gists List (only when connected) */}
          {githubUser && (
            <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
                  Сохранённые снимки Gist
                </h2>
                <button
                  type="button"
                  disabled={loadingGists}
                  onClick={onRefreshGists}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-[#8B949E] hover:text-[#E6EDF3] border border-[#30363D] rounded transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingGists ? 'animate-spin' : ''}`} />
                  <span>Обновить</span>
                </button>
              </div>

              {loadingGists ? (
                <div className="space-y-2.5">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded border border-[#30363D] bg-[#0D1117]/60 animate-pulse"
                    />
                  ))}
                </div>
              ) : savedGists.length === 0 ? (
                <p className="text-sm text-[#8B949E]">
                  Сохранённых снимков PyTerm в твоём аккаунте GitHub пока нет. Нажми «Сохранить в GitHub Gist» выше.
                </p>
              ) : (
                <div className="divide-y divide-[#30363D]">
                  {savedGists.map((gist) => (
                    <div
                      key={gist.id}
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <a
                          href={gist.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs sm:text-sm text-[#58A6FF] hover:underline truncate block"
                        >
                          {gist.description}
                        </a>
                        <div className="font-mono text-xs text-[#8B949E] tabular-nums">
                          {new Date(gist.updatedAt).toLocaleString('ru-RU')} ·{' '}
                          {gist.isPublic ? 'Публичный' : 'Приватный'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={restoringId === gist.id}
                        onClick={() => onRestoreGist(gist.id)}
                        className="px-3 py-1.5 text-xs font-mono text-[#E6EDF3] border border-[#30363D] hover:bg-[#21262D] rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {restoringId === gist.id ? 'Загрузка...' : 'Восстановить'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Markdown Report Preview & Export */}
        <div className="lg:col-span-6 rounded-lg border border-[#30363D] bg-[#161B22] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#30363D] flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs sm:text-sm text-[#E6EDF3]">
              python-quiz-report.md
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#8B949E] hover:text-[#E6EDF3] border border-[#30363D] rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#3FB950]" />
                    <span className="text-[#3FB950]">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Копировать</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#E6EDF3] bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать .md</span>
              </button>
            </div>
          </div>

          <pre className="p-5 font-mono text-xs leading-relaxed text-[#C9D1D9] bg-[#0D1117] overflow-x-auto max-h-[540px] overflow-y-auto whitespace-pre-wrap">
            {markdownReport}
          </pre>
        </div>
      </div>
    </section>
  );
}
