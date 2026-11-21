import { CheckCircle2, Edit3, UserCheck } from 'lucide-react';
import { useState } from 'react';
import type { StudentProfile } from '../types';
import { isProfileComplete } from '../utils/storage';

interface StudentProfileFormProps {
  profile: StudentProfile;
  onChange: (next: StudentProfile) => void;
  compact?: boolean;
}

export function StudentProfileForm({
  profile,
  onChange,
  compact = false,
}: StudentProfileFormProps) {
  const complete = isProfileComplete(profile);
  const [editing, setEditing] = useState(!complete);

  const updateField = (field: keyof StudentProfile, value: string) => {
    onChange({ ...profile, [field]: value });
  };

  if (compact && complete && !editing) {
    return (
      <div className="rounded-lg border border-[#30363D] bg-[#0D1117] p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#3FB950]">
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Данные для сертификата</span>
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 font-mono text-xs text-[#8B949E] hover:text-[#E6EDF3] cursor-pointer whitespace-nowrap"
          >
            <Edit3 className="w-3 h-3" />
            <span>Изменить</span>
          </button>
        </div>

        <div className="space-y-0.5">
          <div className="font-mono text-sm font-semibold text-[#E6EDF3] truncate">
            {profile.firstName.trim()} {profile.patronymic.trim()}
          </div>
          <div className="font-mono text-xs text-[#8B949E] truncate">
            {profile.school.trim()} · {profile.grade.trim()} класс
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-[#30363D] ${
        compact ? 'bg-[#0D1117] p-4' : 'bg-[#161B22] p-6'
      } space-y-4`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="font-mono text-xs sm:text-sm font-semibold text-[#E6EDF3]">
            Анкета участника (для сертификата)
          </h3>
          {!compact && (
            <p className="text-xs text-[#8B949E]">
              Эти данные появятся на твоём именном сертификате «Начинающий программист» и в отчёте GitHub.
            </p>
          )}
        </div>
        {complete && (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-[#3FB950] whitespace-nowrap shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Заполнено</span>
          </span>
        )}
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'} gap-3`}>
        <label className="space-y-1.5 block">
          <span className="block font-mono text-[11px] text-[#8B949E]">Имя</span>
          <input
            type="text"
            value={profile.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
            placeholder="Например: Артём"
            maxLength={40}
            className="w-full px-3 py-2 rounded-md border border-[#30363D] bg-[#0D1117] font-mono text-xs sm:text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#58A6FF]"
          />
        </label>

        <label className="space-y-1.5 block">
          <span className="block font-mono text-[11px] text-[#8B949E]">Отчество</span>
          <input
            type="text"
            value={profile.patronymic}
            onChange={(e) => updateField('patronymic', e.target.value)}
            placeholder="Например: Сергеевич"
            maxLength={40}
            className="w-full px-3 py-2 rounded-md border border-[#30363D] bg-[#0D1117] font-mono text-xs sm:text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#58A6FF]"
          />
        </label>

        <label className="space-y-1.5 block">
          <span className="block font-mono text-[11px] text-[#8B949E]">Школа</span>
          <input
            type="text"
            value={profile.school}
            onChange={(e) => updateField('school', e.target.value)}
            placeholder="Например: Школа № 12"
            maxLength={60}
            className="w-full px-3 py-2 rounded-md border border-[#30363D] bg-[#0D1117] font-mono text-xs sm:text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#58A6FF]"
          />
        </label>

        <label className="space-y-1.5 block">
          <span className="block font-mono text-[11px] text-[#8B949E]">Класс</span>
          <input
            type="text"
            value={profile.grade}
            onChange={(e) => updateField('grade', e.target.value)}
            placeholder="Например: 7Б"
            maxLength={12}
            className="w-full px-3 py-2 rounded-md border border-[#30363D] bg-[#0D1117] font-mono text-xs sm:text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#58A6FF]"
          />
        </label>
      </div>

      {compact && complete && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 font-mono text-xs text-[#3FB950] border border-[#3FB950]/40 hover:bg-[#2EA043]/10 rounded transition-colors cursor-pointer"
          >
            Готово
          </button>
        </div>
      )}
    </div>
  );
}
