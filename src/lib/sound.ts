let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

export function unlockAudioContext(): void {
  try {
    getAudioContext();
  } catch {
    // Ignore audio context init errors in restricted environments
  }
}

export function playOrderAlertChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const scheduleNotes = () => {
    const now = ctx.currentTime;
    const notes = [587.33, 783.99, 1046.5]; // D5 -> G5 -> C6 warm restaurant bell chime

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.24, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.48);
    });
  };

  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(scheduleNotes)
      .catch(() => undefined);
    return;
  }

  scheduleNotes();
}
