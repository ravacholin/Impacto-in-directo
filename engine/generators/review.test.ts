import { describe, it, expect, beforeEach } from 'vitest';
import { generateReviewBatch, RULE_TO_TYPES } from './review';
import { resetHistory } from '../history';
import { ExerciseType, type RuleId, type Difficulty } from '../../types';
import { describeQuestion, normalize } from '../../utils';

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

    it('sin reglas devuelve un lote genérico de Pop-up', () => {
        const items = generateReviewBatch(5, { difficulty: 2, rules: [] });
        expect(items).toHaveLength(5);
        expect(items.every(i => i.type === ExerciseType.POP_UP_PRONOUN)).toBe(true);
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
