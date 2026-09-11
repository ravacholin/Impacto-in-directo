import { describe, it, expect, beforeEach } from 'vitest';
import { generateReviewBatch, RULE_TO_TYPES } from './review';
import { resetHistory } from '../history';
import { recentErrorRules, type ErrorLogEntry } from '../../store';
import { ExerciseType, type RuleId, type Difficulty } from '../../types';
import { describeQuestion, normalize } from '../../utils';

const makeError = (ruleId: RuleId): ErrorLogEntry => ({
    id: `${Math.random()}`, ts: Date.now(), ruleId,
    exerciseType: ExerciseType.POP_UP_PRONOUN, prompt: 'p', correctAnswer: 'a', userAnswer: 'b', timedOut: false,
});

const typesFor = (rules: RuleId[]): Set<ExerciseType> => {
    const set = new Set<ExerciseType>();
    for (const r of rules) for (const t of RULE_TO_TYPES[r]) set.add(t);
    return set;
};

describe('generateReviewBatch', () => {
    beforeEach(() => resetHistory());

    it('respeta el tamaño pedido', () => {
        const items = generateReviewBatch(5, { difficulty: 2, rules: ['SE_TRANSFORM', 'CLITIC_ORDER'] });
        expect(items).toHaveLength(5);
    });

    it('todos los ítems entrenan las reglas pedidas (por ruleId o tipo compatible)', () => {
        const rules: RuleId[] = ['SE_TRANSFORM', 'CLITIC_ORDER', 'POSITION_ENCLISIS'];
        const allowedTypes = typesFor(rules);
        const items = generateReviewBatch(20, { difficulty: 3, rules });
        for (const item of items) {
            const byRule = rules.includes(item.question.explanation.ruleId);
            const byType = allowedTypes.has(item.type);
            expect(byRule || byType).toBe(true);
        }
    });

    it('mezcla tipos cuando las reglas admiten varios formatos', () => {
        const items = generateReviewBatch(20, { difficulty: 3, rules: ['SE_TRANSFORM'] });
        const types = new Set(items.map(i => i.type));
        // SE_TRANSFORM admite 4 tipos: el lote no debería ser mono-tipo.
        expect(types.size).toBeGreaterThan(1);
    });

    it('con POSITION_PERIPHRASIS en dificultad 1 no explota (degrada al fallback)', () => {
        const run = () => generateReviewBatch(5, { difficulty: 1, rules: ['POSITION_PERIPHRASIS'] });
        expect(run).not.toThrow();
        expect(run()).toHaveLength(5);
    });

    it('SE_TRANSFORM/CLITIC_ORDER en dificultad 1 degradan (sin reglas entrenables → Pop-up mixto)', () => {
        const items = generateReviewBatch(5, { difficulty: 1 as Difficulty, rules: ['SE_TRANSFORM', 'CLITIC_ORDER'] });
        expect(items).toHaveLength(5);
        // Todos caen al fallback Pop-up.
        expect(items.every(i => i.type === ExerciseType.POP_UP_PRONOUN)).toBe(true);
    });

    it('las reglas reflexivas en dificultad 2/3 degradan (contenido de BASE → Pop-up mixto)', () => {
        const reflexiveRules: RuleId[] = ['REFLEXIVE', 'REFLEXIVE_CONTRAST', 'REFLEXIVE_BODY'];
        for (const difficulty of [2, 3] as Difficulty[]) {
            const items = generateReviewBatch(5, { difficulty, rules: reflexiveRules });
            expect(items).toHaveLength(5);
            // Sin reglas entrenables en el nivel, cae al fallback Pop-up (que en
            // 2/3 es siempre clúster, nunca reflexivo).
            expect(items.every(i => i.type === ExerciseType.POP_UP_PRONOUN)).toBe(true);
            expect(items.every(i => !reflexiveRules.includes(i.question.explanation.ruleId))).toBe(true);
        }
    });

    it('sin reglas devuelve un lote genérico de Pop-up', () => {
        const items = generateReviewBatch(5, { difficulty: 2, rules: [] });
        expect(items).toHaveLength(5);
        expect(items.every(i => i.type === ExerciseType.POP_UP_PRONOUN)).toBe(true);
    });

    it('repaso de errores: las reglas derivadas del log alimentan un lote compatible', () => {
        // Emula generateMistakeReviewData: log → recentErrorRules → generateReviewBatch.
        const errors = [makeError('SE_TRANSFORM'), makeError('CLITIC_ORDER'), makeError('SE_TRANSFORM')];
        const rules = recentErrorRules(errors);
        expect(rules).toEqual(['SE_TRANSFORM', 'CLITIC_ORDER']);

        const allowedTypes = typesFor(rules);
        const items = generateReviewBatch(5, { difficulty: 2, rules });
        expect(items).toHaveLength(5);
        for (const item of items) {
            const byRule = rules.includes(item.question.explanation.ruleId);
            const byType = allowedTypes.has(item.type);
            expect(byRule || byType).toBe(true);
        }
    });

    it('no repite contenido dentro del lote', () => {
        const items = generateReviewBatch(5, { difficulty: 3, rules: ['SE_TRANSFORM', 'POSITION_ENCLISIS', 'PERSON_FLIP'] });
        const keys = items.map(i => {
            const { prompt, correctAnswer } = describeQuestion(i.type, i.question);
            return `${i.type}#${normalize(prompt)}#${normalize(correctAnswer)}`;
        });
        expect(new Set(keys).size).toBe(keys.length);
    });
});
