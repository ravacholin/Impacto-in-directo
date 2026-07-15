// Persistencia ligera en localStorage: ajustes del usuario y estadísticas por
// regla gramatical. Sin backend y sin librerías: funciones puras + try/catch
// alrededor de todo acceso a localStorage (modo privado, cuotas, SSR…).

import type { Difficulty, ExerciseType, RuleId } from './types';

const SETTINGS_KEY = 'ii_settings_v1';
const STATS_KEY = 'ii_stats_v1';
const SRS_KEY = 'ii_srs_v1';
const ERRORS_KEY = 'ii_errors_v1';

// Ventana de resultados recientes por regla, y umbral de "regla débil".
const RECENT_WINDOW = 10;
const WEAK_MIN_ATTEMPTS = 5;
const WEAK_ACCURACY = 0.7;

// Registro de errores: se conservan los MAX_ERRORS más recientes.
const MAX_ERRORS = 200;

// SRS estilo Leitner por regla: al subir de caja crece el intervalo (en días)
// hasta el próximo repaso; al fallar, la regla baja de caja y vence de inmediato.
const LEITNER_DAYS = [0, 1, 3, 7, 16, 35];
const DAY_MS = 24 * 60 * 60 * 1000;

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

// Un error individual guardado en el registro local (`ii_errors_v1`).
export interface ErrorLogEntry {
    id: string;             // `${ts}-${aleatorio}`
    ts: number;             // Date.now() del fallo
    ruleId: RuleId;
    exerciseType: ExerciseType;
    prompt: string;         // enunciado/frase mostrada
    correctAnswer: string;  // respuesta correcta (texto)
    userAnswer: string;     // lo que respondió el alumno ('' si expiró el tiempo)
    timedOut: boolean;
}

// Estado de repetición espaciada por regla (`ii_srs_v1`).
interface SrsState {
    box: number;        // caja de Leitner (índice en LEITNER_DAYS)
    dueAt: number;      // timestamp en que la regla vuelve a tocar repaso
    lastReview: number; // último intento registrado
    lapses: number;     // cuántas veces se falló tras haber subido de caja
}

interface SrsData {
    version: 1;
    rules: Partial<Record<RuleId, SrsState>>;
}

// Detalle de un intento para `recordAttempt` (registra stats + SRS y, si falla,
// el error en el log local).
export interface AttemptDetail {
    ruleId: RuleId;
    exerciseType: ExerciseType;
    correct: boolean;
    prompt: string;
    correctAnswer: string;
    userAnswer: string;
    timedOut?: boolean;
}

// Nombres humanos de cada regla (para el "punto débil" del final de sesión).
export const RULE_NAMES: Record<RuleId, string> = {
    OD_AGREEMENT: 'concordancia lo/la/los/las',
    REFLEXIVE: 'pronombre reflexivo',
    REFLEXIVE_CONTRAST: 'reflexivo vs. no reflexivo',
    REFLEXIVE_BODY: 'artículo con partes del cuerpo',
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
    updateSrs(ruleId, correct);
};

// --- SRS (repetición espaciada por regla) ---

const loadSrs = (): SrsData => {
    const raw = readJSON<SrsData>(SRS_KEY);
    if (!raw || typeof raw !== 'object' || raw.version !== 1 || typeof raw.rules !== 'object' || raw.rules === null) {
        return { version: 1, rules: {} };
    }
    return raw;
};

const intervalMs = (box: number): number => LEITNER_DAYS[Math.min(box, LEITNER_DAYS.length - 1)] * DAY_MS;

// Sube o baja la regla de caja y reprograma su próximo repaso. Un acierto empuja
// el repaso hacia el futuro (intervalo creciente); un fallo la deja vencida ya,
// de modo que vuelve al sesgo del próximo lote (getPriorityRules → generador).
const updateSrs = (ruleId: RuleId, correct: boolean, now: number = Date.now()): void => {
    const srs = loadSrs();
    const prev: SrsState = srs.rules[ruleId] ?? { box: 0, dueAt: now, lastReview: now, lapses: 0 };
    const maxBox = LEITNER_DAYS.length - 1;
    const box = correct ? Math.min(prev.box + 1, maxBox) : Math.max(0, prev.box - 1);
    srs.rules[ruleId] = {
        box,
        dueAt: correct ? now + intervalMs(box) : now,
        lastReview: now,
        lapses: prev.lapses + (correct ? 0 : 1),
    };
    writeJSON(SRS_KEY, srs);
};

// Reglas cuyo repaso está vencido según el SRS (dueAt <= now).
export const getDueRules = (now: number = Date.now()): RuleId[] => {
    const srs = loadSrs();
    return (Object.keys(srs.rules) as RuleId[]).filter(ruleId => {
        const state = srs.rules[ruleId];
        return !!state && state.dueAt <= now;
    });
};

// --- Registro local de errores ---

export const loadErrors = (): ErrorLogEntry[] => {
    const raw = readJSON<ErrorLogEntry[]>(ERRORS_KEY);
    return Array.isArray(raw) ? raw : [];
};

// Antepone el error (más reciente primero) y recorta al tope MAX_ERRORS.
export const logError = (entry: ErrorLogEntry): void => {
    const errors = loadErrors();
    writeJSON(ERRORS_KEY, [entry, ...errors].slice(0, MAX_ERRORS));
};

export const clearErrors = (): void => writeJSON(ERRORS_KEY, []);

// Punto único que usa la sesión: actualiza stats + SRS y, si se falló, guarda el
// error individual en el registro local.
export const recordAttempt = (detail: AttemptDetail): void => {
    recordResult(detail.ruleId, detail.correct);
    if (detail.correct) return;
    logError({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        ruleId: detail.ruleId,
        exerciseType: detail.exerciseType,
        prompt: detail.prompt,
        correctAnswer: detail.correctAnswer,
        userAnswer: detail.userAnswer,
        timedOut: !!detail.timedOut,
    });
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

// Reglas a priorizar en el próximo lote: unión (sin duplicados) de las vencidas
// según el SRS (programación entre sesiones) y las débiles por precisión reciente
// (ajuste intra-sesión). Alimenta el sesgo del generador vía engine.ts.
export const getPriorityRules = (now: number = Date.now()): RuleId[] => {
    return [...new Set([...getDueRules(now), ...getWeakRules()])];
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
export const __testing = {
    RECENT_WINDOW, WEAK_MIN_ATTEMPTS, WEAK_ACCURACY, MAX_ERRORS, LEITNER_DAYS, DAY_MS,
    SETTINGS_KEY, STATS_KEY, SRS_KEY, ERRORS_KEY,
};
