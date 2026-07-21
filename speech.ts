// TTS local con degradación elegante.
//
// Usa `window.speechSynthesis` (voces del sistema): local, gratis, sin claves y
// offline en la mayoría de dispositivos — encaja con la filosofía 100% offline.
// Si el navegador no tiene voz en español, la app simplemente no ofrece audio:
// `isSpeechAvailable()` devuelve false y `speak` es un no-op. Todo va envuelto en
// guards para no romper en entornos sin la API (SSR, tests sin DOM).

const hasApi = (): boolean =>
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

// Preferencia de acento: rioplatense primero, luego otros latinoamericanos,
// luego España, y por último cualquier español.
const scoreVoice = (lang: string): number => {
    const l = lang.toLowerCase();
    if (!l.startsWith('es')) return -1;
    if (l === 'es-ar') return 5;
    if (l === 'es-419' || l === 'es-us' || l === 'es-mx') return 4;
    if (l === 'es-es') return 2;
    return 1; // cualquier otro es-*
};

let cachedVoice: SpeechSynthesisVoice | null = null;
let listenerAttached = false;

const chooseVoice = (): SpeechSynthesisVoice | null => {
    if (!hasApi()) return null;
    let best: SpeechSynthesisVoice | null = null;
    let bestScore = 0;
    try {
        for (const v of window.speechSynthesis.getVoices()) {
            const s = scoreVoice(v.lang);
            if (s > bestScore) {
                bestScore = s;
                best = v;
            }
        }
    } catch {
        return null;
    }
    return best;
};

const refreshVoice = (): void => {
    cachedVoice = chooseVoice();
};

// En Chrome la lista de voces llega de forma asíncrona (`voiceschanged`).
const ensureListener = (): void => {
    if (listenerAttached || !hasApi()) return;
    try {
        window.speechSynthesis.addEventListener('voiceschanged', refreshVoice);
        listenerAttached = true;
    } catch {
        /* ignore */
    }
};

// True si la API existe y hay al menos una voz en español disponible.
export const isSpeechAvailable = (): boolean => {
    if (!hasApi()) return false;
    ensureListener();
    if (!cachedVoice) refreshVoice();
    return !!cachedVoice;
};

// Pronuncia el texto en español, cancelando cualquier locución en curso.
export const speak = (text: string): void => {
    if (!hasApi() || !text) return;
    ensureListener();
    if (!cachedVoice) refreshVoice();
    try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        if (cachedVoice) {
            utter.voice = cachedVoice;
            utter.lang = cachedVoice.lang;
        } else {
            utter.lang = 'es';
        }
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
    } catch {
        /* ignore */
    }
};
