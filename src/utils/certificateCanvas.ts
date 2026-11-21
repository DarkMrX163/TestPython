import { getDeveloperRank } from '../data/achievements';
import { QUESTIONS } from '../data/questions';
import type { UserProgress } from '../types';
import { getCertificateEligibility } from './storage';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function downloadCertificatePng(progress: UserProgress): Promise<void> {
  if (typeof document === 'undefined') return;

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed with fallback fonts
    }
  }

  const W = 1600;
  const H = 1130;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { studentProfile } = progress;
  const fullName = `${studentProfile.firstName.trim()} ${studentProfile.patronymic.trim()}`.trim();
  const schoolLine = `${studentProfile.school.trim()}  ·  ${studentProfile.grade.trim()} класс`;
  const rank = getDeveloperRank(progress.xp);
  const eligibility = getCertificateEligibility(progress);
  const overallAccuracy =
    progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
      : 0;
  const issuedDate = new Date(
    progress.certificateIssuedAt || new Date().toISOString()
  ).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const certId = progress.certificateId || 'PYTERM-2026-VERIFIED';

  // 1. Bright Colorful Outer Backdrop (Vibrant Python Blue -> Indigo -> Emerald Gradient)
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#EFF6FF');
  bgGrad.addColorStop(0.5, '#F0FDF4');
  bgGrad.addColorStop(1, '#FFFBEB');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Colorful geometric corner ribbons in background
  ctx.save();
  ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(420, 0);
  ctx.lineTo(0, 320);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(245, 158, 11, 0.11)';
  ctx.beginPath();
  ctx.moveTo(W, H);
  ctx.lineTo(W - 440, H);
  ctx.lineTo(W, H - 320);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(16, 185, 129, 0.09)';
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(W - 360, 0);
  ctx.lineTo(W, 260);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 2. Main Crisp White Certificate Sheet with Soft Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, 56, 56, W - 112, H - 112, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // Subtle blueprint dot grid inside the white sheet
  ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
  for (let gx = 96; gx < W - 80; gx += 32) {
    for (let gy = 112; gy < H - 80; gy += 32) {
      ctx.fillRect(gx, gy, 2, 2);
    }
  }

  // Colorful top syntax-spectrum bar clipped to top of card
  ctx.save();
  drawRoundedRect(ctx, 56, 56, W - 112, H - 112, 24);
  ctx.clip();
  const ribbonGrad = ctx.createLinearGradient(56, 56, W - 56, 56);
  ribbonGrad.addColorStop(0, '#2563EB'); // Python Blue
  ribbonGrad.addColorStop(0.35, '#10B981'); // Terminal Emerald
  ribbonGrad.addColorStop(0.7, '#F59E0B'); // Python Gold
  ribbonGrad.addColorStop(1, '#7C3AED'); // Syntax Violet
  ctx.fillStyle = ribbonGrad;
  ctx.fillRect(56, 56, W - 112, 16);
  ctx.restore();

  // Outer card hairline border
  drawRoundedRect(ctx, 56, 56, W - 112, H - 112, 24);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#CBD5E1';
  ctx.stroke();

  // Inner colorful double frame
  drawRoundedRect(ctx, 84, 92, W - 168, H - 176, 16);
  ctx.lineWidth = 2;
  ctx.strokeStyle = eligibility.withHonors ? '#F59E0B' : '#3B82F6';
  ctx.stroke();

  // Programmer Code-Bracket Corner Accents
  ctx.font = '700 28px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2563EB';
  ctx.fillText('{', 106, 134);
  ctx.fillStyle = '#10B981';
  ctx.fillText('<py>', 106, H - 108);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#7C3AED';
  ctx.fillText('}', W - 106, 134);
  ctx.fillStyle = '#F59E0B';
  ctx.fillText('</py>', W - 106, H - 108);

  // 3. Header Row (Brand + Course + Cert ID)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2563EB';
  ctx.font = '700 30px "JetBrains Mono", monospace';
  ctx.fillText('PyTerm', 152, 174);

  ctx.fillStyle = '#475569';
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText('· Интерактивная академия Python', 280, 174);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#4F46E5';
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillText(`ID: ${certId}`, W - 152, 174);

  // Colorful subtle divider
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(152, 204);
  ctx.lineTo(W - 152, 204);
  ctx.stroke();

  // 3.5. Left-Side Circular Logo: ЦДТ «Радуга»
  const logoUrl = `${import.meta.env.BASE_URL}assets/aistudio/1000052880_bdb1afb0.jpg`;
  const logoImg = await loadImage(logoUrl);
  if (logoImg) {
    const logoCx = 228;
    const logoCy = 326;
    const logoR = 88;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.arc(logoCx, logoCy, logoR + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Crop outer margins so only the circular blue-bordered medallion fills the circle
    const cropX = logoImg.width * 0.065;
    const cropY = logoImg.height * 0.055;
    const cropW = logoImg.width * 0.87;
    const cropH = logoImg.height * 0.87;
    ctx.drawImage(
      logoImg,
      cropX,
      cropY,
      cropW,
      cropH,
      logoCx - logoR,
      logoCy - logoR,
      logoR * 2,
      logoR * 2
    );
    ctx.restore();

    ctx.beginPath();
    ctx.arc(logoCx, logoCy, logoR + 2, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
    ctx.stroke();
  }

  // 3.6. Right-Side Logo: Мини-технопарк «Квантум»
  const rightLogoUrl = `${import.meta.env.BASE_URL}assets/aistudio/images_db1623ab.jpeg`;
  const rightLogoImg = await loadImage(rightLogoUrl);
  if (rightLogoImg) {
    const boxSize = 176;
    const boxX = W - 228 - boxSize / 2;
    const boxY = 326 - boxSize / 2;
    const pad = 12;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    drawRoundedRect(ctx, boxX, boxY, boxSize, boxSize, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    const maxDraw = boxSize - pad * 2;
    const scale = Math.min(maxDraw / rightLogoImg.width, maxDraw / rightLogoImg.height);
    const drawW = rightLogoImg.width * scale;
    const drawH = rightLogoImg.height * scale;
    const drawX = boxX + (boxSize - drawW) / 2;
    const drawY = boxY + (boxSize - drawH) / 2;

    ctx.save();
    drawRoundedRect(ctx, boxX, boxY, boxSize, boxSize, 26);
    ctx.clip();
    ctx.drawImage(rightLogoImg, drawX, drawY, drawW, drawH);
    ctx.restore();

    drawRoundedRect(ctx, boxX, boxY, boxSize, boxSize, 26);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.stroke();
  }

  // 4. Center Title Block
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '700 21px "JetBrains Mono", monospace';
  ctx.fillText('С Е Р Т И Ф И К А Т   О   П Р О Х О Ж Д Е Н И И   К У Р С А', W / 2, 272);

  // Vibrant Gradient Headline
  const titleGrad = ctx.createLinearGradient(W / 2 - 420, 300, W / 2 + 420, 360);
  if (eligibility.withHonors) {
    titleGrad.addColorStop(0, '#D97706');
    titleGrad.addColorStop(0.5, '#EA580C');
    titleGrad.addColorStop(1, '#7C3AED');
  } else {
    titleGrad.addColorStop(0, '#2563EB');
    titleGrad.addColorStop(0.5, '#059669');
    titleGrad.addColorStop(1, '#4F46E5');
  }
  ctx.fillStyle = titleGrad;
  ctx.font = '700 60px "JetBrains Mono", monospace';
  ctx.fillText('НАЧИНАЮЩИЙ ПРОГРАММИСТ', W / 2, 352);

  if (eligibility.withHonors) {
    ctx.fillStyle = '#D97706';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText('★  С ОТЛИЧИЕМ  ·  PYTHON 3.12  ·  АЛГОРИТМЫ И КОД  ★', W / 2, 400);
  } else {
    ctx.fillStyle = '#059669';
    ctx.font = '600 22px "JetBrains Mono", monospace';
    ctx.fillText('Python 3.12  ·  Алгоритмы  ·  Циклы  ·  Отладка кода', W / 2, 400);
  }

  // 5. Recipient Name & School
  ctx.fillStyle = '#64748B';
  ctx.font = '500 22px "Manrope", sans-serif';
  ctx.fillText('Настоящим подтверждается, что', W / 2, 474);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 56px "Manrope", sans-serif';
  ctx.fillText(fullName || 'Участник курса', W / 2, 548);

  // Colorful gradient underline under name
  const nameLineGrad = ctx.createLinearGradient(W / 2 - 360, 574, W / 2 + 360, 574);
  nameLineGrad.addColorStop(0, '#2563EB');
  nameLineGrad.addColorStop(0.5, '#10B981');
  nameLineGrad.addColorStop(1, '#F59E0B');
  ctx.strokeStyle = nameLineGrad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 360, 574);
  ctx.lineTo(W / 2 + 360, 574);
  ctx.stroke();

  ctx.fillStyle = '#3730A3';
  ctx.font = '600 26px "JetBrains Mono", monospace';
  ctx.fillText(schoolLine, W / 2, 622);

  ctx.fillStyle = '#475569';
  ctx.font = '500 22px "Manrope", sans-serif';
  ctx.fillText(
    'успешно освоил(а) основы синтаксиса, алгоритмического мышления, циклов, коллекций и отладки на Python.',
    W / 2,
    678
  );

  // 6. Bright Tinted 4-Column Stats Box
  const boxX = 152;
  const boxY = 724;
  const boxW = W - 304;
  const boxH = 132;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const metrics = [
    {
      label: 'Решено задач',
      value: `${progress.correctQuestionIds.length} / ${QUESTIONS.length}`,
      color: '#2563EB',
    },
    { label: 'Общая точность', value: `${overallAccuracy}%`, color: '#059669' },
    { label: 'Опыт (XP)', value: `${progress.xp} XP`, color: '#D97706' },
    { label: 'Ранг', value: `Ур.${rank.level} ${rank.title}`, color: '#4F46E5' },
  ];

  const colW = boxW / metrics.length;
  metrics.forEach((m, idx) => {
    const cx = boxX + colW * idx + colW / 2;
    if (idx > 0) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(boxX + colW * idx, boxY + 22);
      ctx.lineTo(boxX + colW * idx, boxY + boxH - 22);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = '500 18px "JetBrains Mono", monospace';
    ctx.fillText(m.label, cx, boxY + 46);

    ctx.fillStyle = m.color;
    ctx.font =
      idx === 3
        ? '700 21px "JetBrains Mono", monospace'
        : '700 32px "JetBrains Mono", monospace';
    ctx.fillText(m.value, cx, boxY + 94);
  });

  // 7. Footer Signature & Golden Programmer Seal
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText('Дата выдачи:', 152, 944);
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.fillText(issuedDate, 152, 978);

  // Center bright golden-emerald programmer seal
  ctx.textAlign = 'center';
  drawRoundedRect(ctx, W / 2 - 155, 908, 310, 82, 12);
  ctx.fillStyle = '#FFFBEB';
  ctx.fill();
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#B45309';
  ctx.font = '700 21px "JetBrains Mono", monospace';
  ctx.fillText('★ [ PYTHON 3.12 ] ★', W / 2, 944);
  ctx.fillStyle = '#059669';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillText('ПОДТВЕРЖДЕНО PYTERM', W / 2, 972);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 15px "JetBrains Mono", monospace';
  ctx.fillText('Педагог дополнительного образования', W - 152, 918);
  ctx.fillText('мини-технопарка «Квантум» ЦДТ «Радуга»', W - 152, 940);
  ctx.fillText('ГБОУ СОШ 1 г. Нефтегорска', W - 152, 962);
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 21px "JetBrains Mono", monospace';
  ctx.fillText('Вакурова Анна Николаевна', W - 152, 994);

  // Export PNG
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const safeFile = fullName
    ? fullName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]+/g, '_').replace(/^_|_$/g, '')
    : 'student';
  link.download = `PyTerm_Certificate_${safeFile}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
