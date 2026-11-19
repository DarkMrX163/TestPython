let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number,
  delaySec = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export function playCorrectSound(streak: number): void {
  const boost = Math.min(streak, 6) * 35;
  playTone(523.25 + boost, 0.11, 'triangle', 0.08, 0);
  playTone(659.25 + boost, 0.16, 'triangle', 0.09, 0.075);
}

export function playWrongSound(): void {
  playTone(210, 0.14, 'sawtooth', 0.05, 0);
  playTone(165, 0.18, 'sawtooth', 0.05, 0.09);
}

export function playAchievementSound(): void {
  playTone(523.25, 0.12, 'triangle', 0.08, 0);
  playTone(659.25, 0.12, 'triangle', 0.08, 0.08);
  playTone(783.99, 0.14, 'triangle', 0.09, 0.16);
  playTone(1046.5, 0.24, 'triangle', 0.1, 0.25);
}

export function playStepTick(): void {
  playTone(440, 0.045, 'sine', 0.035, 0);
}
