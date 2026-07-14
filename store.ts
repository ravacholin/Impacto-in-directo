// Persistencia ligera en localStorage: ajustes del usuario y estadísticas por
// regla gramatical. Sin backend y sin librerías: funciones puras + try/catch
// alrededor de todo acceso a localStorage (modo privado, cuotas, SSR…).

import type { Difficulty, RuleId } from './types';

const SETTINGS_KEY = 'ii_settings_v1';
const STATS_KEY = 'ii_stats_v1';

// Ventana de resultados recientes por regla, y umbral de "regla débil".
const RECENT_WINDOW = 10;
const WEAK_MIN_ATTEMPTS = 5;
const WEAK_ACCURACY = 0.7;

export interface Settings {
    difficulty: Difficulty;
    timerEnabled: boolean;
    infinite: boolean;
}

const DEFAULT_SETTINGS: Settings = { difficulty: 1, timerEnabled: true, infinite: false };

interface RuleStats {
    correct: number;
    total: number;
    // Últimos resultados (1 = acierto, 0 = error), máximo RECENT_WINDOW.
    recent: number[];
}

export interface Stats {
    version: 1;
    rules: Partial<Record<RuleId, RuleStats>>;
}

// Nombres humanos de cada regla (para el "punto débil" del final de sesión).
export const RULE_NAMES: Record<RuleId, string> = {
    OD_AGREEMENT: 'concordancia lo/la/los/las',
    REFLEXIVE: 'pronombre reflexivo',
    CLITIC_ORDER: 'orden OI + OD',
    SE_TRANSFORM: 'le/les → se',
    POSITION_PROCLISIS: 'pronombre delante del verbo',
    POSITION_ENCLISIS: 'pronombre unido al verbo',
    POSITION_PERIPHRASIS: 'posición en perífrasis',
    PERSON_FLIP: 'cambio de persona (me → te)',
};

const readJSON = <T,>(key: string): T | null => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
};

const writeJSON = (key: string, value: unknown): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* ignore */
    }
};

export const loadSettings = (): Settings => {
    const raw = readJSON<Partial<Settings>>(SETTINGS_KEY);
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
    return {
        difficulty: raw.difficulty === 1 || raw.difficulty === 2 || raw.difficulty === 3 ? raw.difficulty : DEFAULT_SETTINGS.difficulty,
        timerEnabled: typeof raw.timerEnabled === 'boolean' ? raw.timerEnabled : DEFAULT_SETTINGS.timerEnabled,
        infinite: typeof raw.infinite === 'boolean' ? raw.infinite : DEFAULT_SETTINGS.infinite,
    };
};

export const saveSettings = (settings: Settings): void => writeJSON(SETTINGS_KEY, settings);

export const loadStats = (): Stats => {
    const raw = readJSON<Stats>(STATS_KEY);
    if (!raw || typeof raw !== 'object' || raw.version !== 1 || typeof raw.rules !== 'object' || raw.rules === null) {
        return { version: 1, rules: {} };
    }
    return raw;
};

export const recordResult = (ruleId: RuleId, correct: boolean): void => {
    const stats = loadStats();
    const entry: RuleStats = stats.rules[ruleId] ?? { correct: 0, total: 0, recent: [] };
    entry.total += 1;
    if (correct) entry.correct += 1;
    entry.recent = [...(Array.isArray(entry.recent) ? entry.recent : []), correct ? 1 : 0].slice(-RECENT_WINDOW);
    stats.rules[ruleId] = entry;
    writeJSON(STATS_KEY, stats);
};

const recentAccuracy = (entry: RuleStats): number => {
    if (!entry.recent.length) return 1;
    return entry.recent.reduce((a, b) => a + b, 0) / entry.recent.length;
};

// Reglas con suficiente historial reciente y precisión por debajo del umbral.
export const getWeakRules = (): RuleId[] => {
    const stats = loadStats();
    return (Object.keys(stats.rules) as RuleId[]).filter(ruleId => {
        const entry = stats.rules[ruleId];
        return !!entry && entry.recent.length >= WEAK_MIN_ATTEMPTS && recentAccuracy(entry) < WEAK_ACCURACY;
    });
};

// La regla débil con peor precisión reciente (para el mensaje de fin de sesión).
export const getWeakestRule = (): { ruleId: RuleId; accuracy: number } | null => {
    const stats = loadStats();
    let worst: { ruleId: RuleId; accuracy: number } | null = null;
    for (const ruleId of getWeakRules()) {
        const entry = stats.rules[ruleId];
        if (!entry) continue;
        const accuracy = recentAccuracy(entry);
        if (!worst || accuracy < worst.accuracy) worst = { ruleId, accuracy };
    }
    return worst;
};

// Solo para tests.
export const __testing = { RECENT_WINDOW, WEAK_MIN_ATTEMPTS, WEAK_ACCURACY, SETTINGS_KEY, STATS_KEY };
