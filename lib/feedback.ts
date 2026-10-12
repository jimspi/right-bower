/** Haptics + optional sounds. Audio is created lazily from a user gesture (no autoplay problems). */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.06, delay = 0) {
  const c = audio();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export type Cue = "card" | "bid" | "trick" | "win" | "lose" | "error" | "euchre";

export function cue(kind: Cue, opts: { sound: boolean; haptics: boolean }) {
  if (opts.haptics && typeof navigator !== "undefined" && "vibrate" in navigator) {
    const pat: Record<Cue, number | number[]> = {
      card: 8,
      bid: 12,
      trick: [12, 40, 12],
      win: [30, 60, 30, 60, 60],
      lose: [60],
      error: [25, 30, 25],
      euchre: [40, 40, 40],
    };
    try {
      navigator.vibrate(pat[kind]);
    } catch {
      /* ignore */
    }
  }
  if (!opts.sound) return;
  switch (kind) {
    case "card":
      tone(520, 0.06, "triangle", 0.05);
      break;
    case "bid":
      tone(440, 0.09, "sine", 0.05);
      break;
    case "trick":
      tone(660, 0.1, "triangle", 0.06);
      tone(880, 0.12, "triangle", 0.05, 0.08);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "triangle", 0.07, i * 0.12));
      break;
    case "lose":
      [392, 330, 262].forEach((f, i) => tone(f, 0.25, "sine", 0.06, i * 0.14));
      break;
    case "euchre":
      tone(300, 0.2, "sawtooth", 0.04);
      tone(220, 0.25, "sawtooth", 0.04, 0.12);
      break;
    case "error":
      tone(180, 0.12, "square", 0.03);
      break;
  }
}
