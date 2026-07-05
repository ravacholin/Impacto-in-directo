import { describe, it, expect, beforeEach } from 'vitest';
import { loadSettings, saveSettings, recordResult, getWeakRules, getWeakestRule, loadStats, __testing } from './store';

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
