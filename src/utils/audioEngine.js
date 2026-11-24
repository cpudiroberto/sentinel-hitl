/**
 * Motor sintético Web Audio API sin archivos externos.
 * Se desbloquea únicamente tras el primer gesto del usuario (cero warnings en F12).
 */
let audioCtx = null;
let unlocked = false;
let enabled = true;

export function setAudioEnabled(value) {
  enabled = Boolean(value);
}

export function initAudioUnlock() {
  if (typeof window === 'undefined') return () => {};

  const unlock = () => {
    unlocked = true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !audioCtx) {
        audioCtx = new AudioCtx();
      }
      if (audioCtx?.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    } catch {
      // Silencio seguro si el entorno bloquea Web Audio
    }
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

export function playTone(kind) {
  if (!enabled || !unlocked || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') return;

    const now = audioCtx.currentTime;
    const playNote = (type, f1, f2, dur, vol, delay = 0) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(f1, now + delay);
      if (f2 !== f1) {
        osc.frequency.exponentialRampToValueAtTime(f2, now + delay + dur);
      }
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(vol, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };

    if (kind === 'click') playNote('sine', 620, 680, 0.055, 0.09);
    else if (kind === 'tab') playNote('sine', 480, 590, 0.075, 0.095);
    else if (kind === 'theme') playNote('triangle', 420, 560, 0.09, 0.085);
    else if (kind === 'export') {
      playNote('sine', 523, 523, 0.08, 0.09, 0);
      playNote('sine', 659, 784, 0.14, 0.095, 0.08);
    } else if (kind === 'autoOk') playNote('sine', 494, 587, 0.09, 0.075);
    else if (kind === 'alert') playNote('sine', 587, 698, 0.14, 0.1);
    else if (kind === 'criticalCalm') {
      // Acorde grave-medio distinguible para eventos críticos sin resultar estridente
      playNote('sine', 330, 330, 0.28, 0.09, 0);
      playNote('triangle', 440, 392, 0.3, 0.075, 0.12);
    } else if (kind === 'approve') {
      playNote('sine', 523, 659, 0.11, 0.1, 0);
      playNote('sine', 659, 784, 0.15, 0.1, 0.09);
    } else if (kind === 'block') {
      playNote('triangle', 340, 220, 0.16, 0.11, 0);
      playNote('sine', 220, 185, 0.14, 0.09, 0.11);
    } else if (kind === 'error429') playNote('sawtooth', 210, 155, 0.2, 0.09);
    else if (kind === 'verify') playNote('sine', 740, 880, 0.1, 0.09);
  } catch {
    // Silencio seguro
  }
}