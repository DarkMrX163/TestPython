import { Award, CheckCircle2, Circle, Download, Lock, Printer } from 'lucide-react';
import { useState } from 'react';
import { getDeveloperRank } from '../data/achievements';
import { QUESTIONS } from '../data/questions';
import type { StudentProfile, UserProgress } from '../types';
import { downloadCertificatePng } from '../utils/certificateCanvas';
import {
  CERTIFICATE_MIN_ACCURACY,
  CERTIFICATE_MIN_SOLVED,
  getCertificateEligibility,
} from '../utils/storage';
import { StudentProfileForm } from './StudentProfileForm';
import { TerminalProgressBar } from './TerminalProgressBar';

interface CertificateViewProps {
  progress: UserProgress;
  onUpdateProfile: (profile: StudentProfile) => void;
  onStartQuiz: () => void;
}

export function CertificateView({
  progress,
  onUpdateProfile,
  onStartQuiz,
}: CertificateViewProps) {
  const [downloading, setDownloading] = useState(false);

  const eligibility = getCertificateEligibility(progress);
  const rank = getDeveloperRank(progress.xp);
  const overallAccuracy =
    progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
      : 0;

  const { firstName, patronymic, school, grade } = progress.studentProfile;
  const fullName = `${firstName.trim()} ${patronymic.trim()}`.trim();
  const schoolDisplay =
    school.trim() || grade.trim()
      ? `${school.trim() || 'Школа не указана'} · ${grade.trim() ? `${grade.trim()} класс` : 'Класс не указан'}`
      : 'Укажи школу и класс в анкете выше';

  const issuedDate = new Date(
    progress.certificateIssuedAt || new Date().toISOString()
  ).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const certId = progress.certificateId || 'PYTERM-2026-PREVIEW';

  const handleDownloadPng = async () => {
    if (!eligibility.readyToDownload) return;
    setDownloading(true);
    try {
      await downloadCertificatePng(progress);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!eligibility.readyToDownload) return;
    window.print();
  };

  return (
    <section className="space-y-8">
      {/* Page Header */}
      <div className="no-print flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#30363D]">
        <div className="space-y-2 max-w-2xl">
          <h1 className="font-mono text-2xl sm:text-3xl font-semibold text-[#E6EDF3] text-balance">
            Сертификат «Начинающий программист»
          </h1>
          <p className="text-sm sm:text-base text-[#8B949E] leading-relaxed">
            Заверши базовый курс по Python, заполни свои данные и скачай именной сертификат в высоком качестве (PNG или печать в PDF).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={!eligibility.readyToDownload || downloading}
            onClick={() => void handleDownloadPng()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] disabled:opacity-45 disabled:cursor-not-allowed text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Создание PNG...' : 'Скачать PNG'}</span>
          </button>

          <button
            type="button"
            disabled={!eligibility.readyToDownload}
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-mono text-[#E6EDF3] border border-[#30363D] hover:bg-[#21262D] disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-[#58A6FF]" />
            <span>Печать / PDF</span>
          </button>
        </div>
      </div>

      {/* Checklist + Profile Form */}
      <div className="no-print space-y-6">
        {/* Course Completion Requirements */}
        <div className="rounded-lg border border-[#30363D] bg-[#161B22] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-mono text-base font-semibold text-[#E6EDF3]">
                Условия получения сертификата
              </h2>
              <p className="font-mono text-xs text-[#8B949E]">
                {eligibility.readyToDownload
                  ? 'Все условия выполнены — твой сертификат готов к скачиванию!'
                  : 'Выполни три шага ниже, чтобы открыть скачивание именного сертификата.'}
              </p>
            </div>
            <TerminalProgressBar
              value={
                (eligibility.solvedOk ? 1 : 0) +
                (eligibility.passedQuizOk ? 1 : 0) +
                (eligibility.profileOk ? 1 : 0)
              }
              max={3}
              segments={12}
              accent={eligibility.readyToDownload ? 'emerald' : 'gold'}
              label="Готовность сертификата"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-lg border border-[#30363D] bg-[#0D1117] space-y-1.5">
              <div className="flex items-center gap-2">
                {eligibility.solvedOk ? (
                  <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#6E7681] shrink-0" />
                )}
                <span className={eligibility.solvedOk ? 'text-[#3FB950]' : 'text-[#E6EDF3]'}>
                  1. Решить задачи курса
                </span>
              </div>
              <div className="text-[#8B949E] pl-6 tabular-nums">
                Решено верно: {eligibility.solvedCount} / {CERTIFICATE_MIN_SOLVED} уникальных задач
              </div>
            </div>

            <div className="p-4 rounded-lg border border-[#30363D] bg-[#0D1117] space-y-1.5">
              <div className="flex items-center gap-2">
                {eligibility.passedQuizOk ? (
                  <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#6E7681] shrink-0" />
                )}
                <span className={eligibility.passedQuizOk ? 'text-[#3FB950]' : 'text-[#E6EDF3]'}>
                  2. Сдать зачётный тест
                </span>
              </div>
              <div className="text-[#8B949E] pl-6">
                Пройти любой тест с точностью ≥ {CERTIFICATE_MIN_ACCURACY}%
              </div>
            </div>

            <div className="p-4 rounded-lg border border-[#30363D] bg-[#0D1117] space-y-1.5">
              <div className="flex items-center gap-2">
                {eligibility.profileOk ? (
                  <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#6E7681] shrink-0" />
                )}
                <span className={eligibility.profileOk ? 'text-[#3FB950]' : 'text-[#E6EDF3]'}>
                  3. Заполнить анкету
                </span>
              </div>
              <div className="text-[#8B949E] pl-6">
                Указать имя, отчество, школу и класс
              </div>
            </div>
          </div>

          {!eligibility.courseCompleted && (
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#8B949E]">
                Подсказка: для отметки «С отличием» реши 12+ задач с общей точностью не ниже 80%.
              </span>
              <button
                type="button"
                onClick={onStartQuiz}
                className="px-4 py-2 text-xs font-mono font-semibold bg-[#2EA043] hover:bg-[#3FB950] text-[#0D1117] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Перейти к задачам курса
              </button>
            </div>
          )}
        </div>

        {/* Editable Student Profile Form */}
        <StudentProfileForm
          profile={progress.studentProfile}
          onChange={onUpdateProfile}
        />
      </div>

      {/* Live Certificate Visual Preview (also used as print target) */}
      <div className="space-y-3">
        {!eligibility.readyToDownload && (
          <div className="no-print flex items-center gap-2 font-mono text-xs text-[#E3B341]">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Предпросмотр сертификата — скачивание откроется после выполнения всех условий выше
            </span>
          </div>
        )}

        <div
          className={`certificate-print-target rounded-2xl p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-[#EFF6FF] via-[#F0FDF4] to-[#FFFBEB] border border-[#CBD5E1] shadow-xl transition-opacity ${
            eligibility.readyToDownload ? 'opacity-100' : 'opacity-85'
          }`}
        >
          <div className="rounded-xl bg-white border border-[#CBD5E1] overflow-hidden shadow-sm">
            {/* Vibrant Python Syntax-Spectrum Top Bar */}
            <div className="h-3 w-full bg-gradient-to-r from-[#2563EB] via-[#10B981] via-65% to-[#7C3AED]" />

            <div className="p-5 sm:p-8 lg:p-10">
              <div
                className={`rounded-xl border-2 p-5 sm:p-8 lg:p-10 space-y-7 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:22px_22px] ${
                  eligibility.withHonors ? 'border-[#F59E0B]' : 'border-[#3B82F6]'
                }`}
              >
                {/* Top Certificate Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E2E8F0] font-mono">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-lg font-bold text-[#2563EB]">{'{'} PyTerm {'}'}</span>
                    <span className="text-xs text-[#475569]">
                      · Интерактивная академия Python
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#4F46E5] tabular-nums">
                    ID: {certId}
                  </span>
                </div>

                {/* Central Title & Left Logo */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-1">
                  {/* Left Side Emblem: ЦДТ «Радуга» */}
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden border-2 border-[#3B82F6]/40 bg-white shadow-md">
                      <img
                        src={`${import.meta.env.BASE_URL}assets/aistudio/1000052880_bdb1afb0.jpg`}
                        alt="Логотип ЦДТ Радуга"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center scale-[1.15]"
                      />
                    </div>
                  </div>

                  {/* Center Title */}
                  <div className="text-center space-y-4 flex-1 min-w-0">
                    <div className="font-mono text-xs font-semibold tracking-[0.22em] text-[#64748B]">
                      СЕРТИФИКАТ О ПРОХОЖДЕНИИ КУРСА
                    </div>

                    <div className="space-y-2">
                      <div
                        className={`font-mono text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance bg-clip-text text-transparent ${
                          eligibility.withHonors
                            ? 'bg-gradient-to-r from-[#D97706] via-[#EA580C] to-[#7C3AED]'
                            : 'bg-gradient-to-r from-[#2563EB] via-[#059669] to-[#4F46E5]'
                        }`}
                      >
                        НАЧИНАЮЩИЙ ПРОГРАММИСТ
                      </div>
                      <div
                        className={`font-mono text-xs sm:text-sm font-semibold ${
                          eligibility.withHonors ? 'text-[#D97706]' : 'text-[#059669]'
                        }`}
                      >
                        {eligibility.withHonors
                          ? '★ С отличием · Python 3.12 · Алгоритмы и код ★'
                          : 'Python 3.12 · Алгоритмы · Циклы · Отладка кода'}
                      </div>
                    </div>
                  </div>

                  {/* Right Side Emblem: Мини-технопарк «Квантум» */}
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl overflow-hidden border-2 border-[#3B82F6]/35 bg-white p-1.5 shadow-md flex items-center justify-center">
                      <img
                        src={`${import.meta.env.BASE_URL}assets/aistudio/images_db1623ab.jpeg`}
                        alt="Логотип мини-технопарка Квантум"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="text-center space-y-3 max-w-2xl mx-auto">
                  <div className="text-sm font-medium text-[#64748B]">
                    Настоящим подтверждается, что
                  </div>
                  <div className="text-2xl sm:text-4xl font-bold text-[#0F172A] pb-2">
                    {fullName || 'Имя Отчество'}
                  </div>
                  <div className="h-1 max-w-md mx-auto rounded-full bg-gradient-to-r from-[#2563EB] via-[#10B981] to-[#F59E0B]" />
                  <div className="font-mono text-sm sm:text-base font-semibold text-[#3730A3] pt-1">
                    {schoolDisplay}
                  </div>
                  <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                    успешно освоил(а) основы синтаксиса, алгоритмического мышления, условий, циклов, коллекций и отладки кода на Python.
                  </p>
                </div>

                {/* Colorful Metrics Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#CBD5E1] rounded-xl bg-[#F8FAFC] divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0] font-mono tabular-nums text-center">
                  <div className="p-4 space-y-1">
                    <div className="text-[11px] font-medium text-[#64748B]">Решено задач</div>
                    <div className="text-lg sm:text-xl font-bold text-[#2563EB]">
                      {progress.correctQuestionIds.length} / {QUESTIONS.length}
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="text-[11px] font-medium text-[#64748B]">Общая точность</div>
                    <div className="text-lg sm:text-xl font-bold text-[#059669]">
                      {overallAccuracy}%
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="text-[11px] font-medium text-[#64748B]">Накопленный опыт</div>
                    <div className="text-lg sm:text-xl font-bold text-[#D97706]">
                      {progress.xp} XP
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="text-[11px] font-medium text-[#64748B]">Ранг разработчика</div>
                    <div className="text-sm sm:text-base font-bold text-[#4F46E5]">
                      Ур.{rank.level} {rank.title}
                    </div>
                  </div>
                </div>

                {/* Bottom Signature & Golden Programmer Seal */}
                <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-6 font-mono text-xs">
                  <div className="text-center sm:text-left space-y-1">
                    <div className="text-[#64748B]">Дата выдачи</div>
                    <div className="text-sm font-bold text-[#0F172A]">
                      {eligibility.courseCompleted ? issuedDate : 'После завершения курса'}
                    </div>
                  </div>

                  <div className="px-5 py-2.5 rounded-xl border-2 border-[#F59E0B] bg-[#FFFBEB] text-center space-y-0.5">
                    <div className="inline-flex items-center gap-1.5 text-[#B45309] font-bold">
                      <Award className="w-4 h-4 text-[#D97706]" />
                      <span>[ PYTHON 3.12 ]</span>
                    </div>
                    <div className="text-[10px] font-semibold text-[#059669]">
                      ПОДТВЕРЖДЕНО PYTERM
                    </div>
                  </div>

                  <div className="text-center sm:text-right space-y-1 max-w-sm">
                    <div className="text-[#64748B] leading-snug">
                      Педагог дополнительного образования
                      <br />
                      мини-технопарка «Квантум» ЦДТ «Радуга»
                      <br />
                      ГБОУ СОШ 1 г. Нефтегорска
                    </div>
                    <div className="text-sm font-bold text-[#0F172A] pt-0.5">
                      Вакурова Анна Николаевна
                    </div>
                  </div>
                </div>

                {/* Subtle Programmer Footer Tags */}
                <div className="flex items-center justify-between font-mono text-xs font-bold pt-1 select-none" aria-hidden="true">
                  <span className="text-[#10B981]">&lt;py&gt;</span>
                  <span className="text-[#F59E0B]">&lt;/py&gt;</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
