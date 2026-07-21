import { describe, it, expect, beforeEach } from 'vitest';
import {
    loadSettings, saveSettings, recordResult, getWeakRules, getWeakestRule, loadStats,
    recordAttempt, logError, loadErrors, clearErrors, getDueRules, getPriorityRules,
    touchStreak, getStreak,
    type ErrorLogEntry, __testing,
} from './store';
import { ExerciseType } from './types';

const makeError = (overrides: Partial<ErrorLogEntry> = {}): ErrorLogEntry => ({
    id: `${Math.random()}`,
    ts: Date.now(),
    ruleId: 'SE_TRANSFORM',
    exerciseType: ExerciseType.POP_UP_PRONOUN,
    prompt: 'prompt',
    correctAnswer: 'se lo',
    userAnswer: 'le lo',
    timedOut: false,
    ...overrides,
});

// localStorage en memoria para el entorno de test (node, sin DOM).
class MemoryStorage {
    private map = new Map<string, string>();
    getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
    setItem(key: string, value: string) { this.map.set(key, String(value)); }
    removeItem(key: string) { this.map.delete(key); }
    clear() { this.map.clear(); }
}

beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe('settings', () => {
    it('devuelve valores por defecto sin datos guardados', () => {
        expect(loadSettings()).toEqual({ difficulty: 1, timerEnabled: true, infinite: false });
    });

    it('hace round-trip de los ajustes', () => {
        saveSettings({ difficulty: 3, timerEnabled: false, infinite: true });
        expect(loadSettings()).toEqual({ difficulty: 3, timerEnabled: false, infinite: true });
    });

    it('cae a los defaults con JSON corrupto', () => {
        localStorage.setItem(__testing.SETTINGS_KEY, '{nope');
        expect(loadSettings()).toEqual({ difficulty: 1, timerEnabled: true, infinite: false });
    });

    it('sanea valores inválidos campo a campo', () => {
        localStorage.setItem(__testing.SETTINGS_KEY, JSON.stringify({ difficulty: 9, timerEnabled: 'yes', infinite: true }));
        expect(loadSettings()).toEqual({ difficulty: 1, timerEnabled: true, infinite: true });
    });
});

describe('stats', () => {
    it('acumula resultados y limita la ventana reciente', () => {
        for (let i = 0; i < 15; i++) recordResult('SE_TRANSFORM', i % 2 === 0);
        const entry = loadStats().rules.SE_TRANSFORM;
        expect(entry?.total).toBe(15);
        expect(entry?.correct).toBe(8);
        expect(entry?.recent).toHaveLength(__testing.RECENT_WINDOW);
    });

    it('marca una regla como débil con historial suficiente y baja precisión', () => {
        for (let i = 0; i < 5; i++) recordResult('SE_TRANSFORM', false);
        expect(getWeakRules()).toContain('SE_TRANSFORM');
    });

    it('no marca reglas con pocos intentos o buena precisión', () => {
        recordResult('CLITIC_ORDER', false); // solo 1 intento
        for (let i = 0; i < 10; i++) recordResult('OD_AGREEMENT', true);
        expect(getWeakRules()).not.toContain('CLITIC_ORDER');
        expect(getWeakRules()).not.toContain('OD_AGREEMENT');
    });

    it('elige la regla débil con peor precisión reciente', () => {
        for (let i = 0; i < 10; i++) recordResult('SE_TRANSFORM', i < 6); // 60%
        for (let i = 0; i < 10; i++) recordResult('CLITIC_ORDER', i < 3); // 30%
        expect(getWeakestRule()?.ruleId).toBe('CLITIC_ORDER');
    });

    it('sobrevive a stats corruptas', () => {
        localStorage.setItem(__testing.STATS_KEY, 'garbage');
        expect(loadStats()).toEqual({ version: 1, rules: {} });
        recordResult('SE_TRANSFORM', true);
        expect(loadStats().rules.SE_TRANSFORM?.total).toBe(1);
    });
});

describe('registro de errores', () => {
    it('empieza vacío y sobrevive a datos corruptos', () => {
        expect(loadErrors()).toEqual([]);
        localStorage.setItem(__testing.ERRORS_KEY, '{nope');
        expect(loadErrors()).toEqual([]);
    });

    it('guarda el error más reciente primero', () => {
        logError(makeError({ prompt: 'primero' }));
        logError(makeError({ prompt: 'segundo' }));
        const errors = loadErrors();
        expect(errors).toHaveLength(2);
        expect(errors[0].prompt).toBe('segundo');
    });

    it('recorta al tope MAX_ERRORS conservando los más recientes', () => {
        for (let i = 0; i < __testing.MAX_ERRORS + 5; i++) logError(makeError({ prompt: `p${i}` }));
        const errors = loadErrors();
        expect(errors).toHaveLength(__testing.MAX_ERRORS);
        expect(errors[0].prompt).toBe(`p${__testing.MAX_ERRORS + 4}`);
    });

    it('clearErrors vacía el registro', () => {
        logError(makeError());
        clearErrors();
        expect(loadErrors()).toEqual([]);
    });
});

describe('recordAttempt', () => {
    it('registra el error solo cuando se falla y actualiza stats', () => {
        recordAttempt({ ruleId: 'SE_TRANSFORM', exerciseType: ExerciseType.POP_UP_PRONOUN, correct: true, prompt: 'ok', correctAnswer: 'se lo', userAnswer: 'se lo' });
        expect(loadErrors()).toHaveLength(0);
        expect(loadStats().rules.SE_TRANSFORM?.total).toBe(1);

        recordAttempt({ ruleId: 'SE_TRANSFORM', exerciseType: ExerciseType.POP_UP_PRONOUN, correct: false, prompt: 'mal', correctAnswer: 'se lo', userAnswer: 'le lo' });
        const errors = loadErrors();
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ ruleId: 'SE_TRANSFORM', prompt: 'mal', userAnswer: 'le lo' });
        expect(loadStats().rules.SE_TRANSFORM?.total).toBe(2);
    });
});

describe('SRS', () => {
    it('deja la regla vencida tras un fallo y la programa al futuro tras aciertos', () => {
        recordResult('SE_TRANSFORM', false);
        expect(getDueRules()).toContain('SE_TRANSFORM'); // dueAt = ahora → vencida

        recordResult('SE_TRANSFORM', true); // sube de caja → dueAt en el futuro
        expect(getDueRules()).not.toContain('SE_TRANSFORM');
    });

    it('no marca como vencidas reglas nunca practicadas', () => {
        expect(getDueRules()).toEqual([]);
    });

    it('getPriorityRules une vencidas (SRS) y débiles (precisión) sin duplicados', () => {
        // SE_TRANSFORM: débil y, tras el último fallo, vencida a la vez → una sola entrada.
        for (let i = 0; i < 5; i++) recordResult('SE_TRANSFORM', false);
        // CLITIC_ORDER: un único fallo → vencida por SRS pero aún no "débil" (pocos intentos).
        recordResult('CLITIC_ORDER', false);

        const priority = getPriorityRules();
        expect(priority).toContain('SE_TRANSFORM');
        expect(priority).toContain('CLITIC_ORDER');
        expect(priority.filter(r => r === 'SE_TRANSFORM')).toHaveLength(1);
    });
});

describe('racha diaria', () => {
    const d = (s: string) => new Date(`${s}T12:00:00`);

    it('el primer día arranca la racha en 1', () => {
        touchStreak(d('2026-07-21'));
        expect(getStreak(d('2026-07-21'))).toBe(1);
    });

    it('el mismo día es idempotente', () => {
        touchStreak(d('2026-07-21'));
        touchStreak(d('2026-07-21'));
        touchStreak(d('2026-07-21'));
        expect(getStreak(d('2026-07-21'))).toBe(1);
    });

    it('un día consecutivo incrementa la racha', () => {
        touchStreak(d('2026-07-21'));
        touchStreak(d('2026-07-22'));
        touchStreak(d('2026-07-23'));
        expect(getStreak(d('2026-07-23'))).toBe(3);
    });

    it('un hueco de más de un día reinicia la racha a 1', () => {
        touchStreak(d('2026-07-21'));
        touchStreak(d('2026-07-22'));
        touchStreak(d('2026-07-25')); // se saltó 23 y 24
        expect(getStreak(d('2026-07-25'))).toBe(1);
    });

    it('getStreak devuelve 0 si el último día no es hoy ni ayer', () => {
        touchStreak(d('2026-07-21'));
        expect(getStreak(d('2026-07-21'))).toBe(1); // hoy
        expect(getStreak(d('2026-07-22'))).toBe(1); // ayer (aún cuenta)
        expect(getStreak(d('2026-07-23'))).toBe(0); // anteayer → cortada
    });

    it('cruza fin de mes correctamente', () => {
        touchStreak(d('2026-07-31'));
        touchStreak(d('2026-08-01'));
        expect(getStreak(d('2026-08-01'))).toBe(2);
    });

    it('cruza fin de año correctamente', () => {
        touchStreak(d('2026-12-31'));
        touchStreak(d('2027-01-01'));
        expect(getStreak(d('2027-01-01'))).toBe(2);
    });

    it('un reloj hacia atrás (día anterior) reinicia a 1', () => {
        touchStreak(d('2026-07-21'));
        touchStreak(d('2026-07-20'));
        expect(getStreak(d('2026-07-20'))).toBe(1);
    });

    it('sin datos la racha es 0', () => {
        expect(getStreak(d('2026-07-21'))).toBe(0);
        void __testing.STREAK_KEY;
    });
});
