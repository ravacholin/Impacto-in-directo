// Efectos de sonido sintetizados con Web Audio API (osciladores, sin archivos
// de audio): así la app se mantiene 100% offline y sin assets que descargar.
// Todo va envuelto en guards para no romper en entornos sin la API (SSR, jsdom).

const hasApi = (): boolean =>
    typeof window !== 'undefined' &&
    (typeof window.AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined');

let cachedContext: AudioContext | null = null;

// Un único AudioContext reutilizado entre llamadas (crear uno por sonido agota
// el límite de contextos concurrentes de algunos navegadores).
const getContext = (): AudioContext | null => {
    if (!hasApi()) return null;
    if (cachedContext) return cachedContext;
    try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        cachedContext = new Ctor();
    } catch {
        return null;
    }
    return cachedContext;
};

export type FeedbackSoundKind = 'correct' | 'incorrect';

// Tono ascendente (D5 → A5, sine) para acierto; zumbido descendente
// (sawtooth, 120 → 90 Hz) para error. Envolvente corta con caída exponencial.
export const playFeedbackSound = (kind: FeedbackSoundKind): void => {
    const ctx = getContext();
    if (!ctx) return;
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;

        if (kind === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.setValueAtTime(90, now + 0.1);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        }
    } catch {
        /* ignore */
    }
};
