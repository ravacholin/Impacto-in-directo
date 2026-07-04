import { describe, it, expect } from 'vitest';
import { resolverCluster, attachEnclitic, VERBS } from './pronouns';
import { generateBatch } from './generator';
import { ExerciseType, QuestionWithOptions, PronounPositionQuestion } from '../types';
import { normalize } from '../utils';

const verbByInfinitive = (inf: string) => {
    const v = VERBS.find(x => x.infinitive === inf);
    if (!v) throw new Error(`Test verb "${inf}" not found`);
    return v;
};

describe('resolverCluster', () => {
    it('applies the le/les + lo/la/los/las -> se rule', () => {
        expect(resolverCluster('le', 'lo')).toBe('se lo');
        expect(resolverCluster('le', 'la')).toBe('se la');
        expect(resolverCluster('les', 'los')).toBe('se los');
        expect(resolverCluster('les', 'las')).toBe('se las');
    });

    it('keeps non-third-person indirect pronouns unchanged', () => {
        expect(resolverCluster('me', 'lo')).toBe('me lo');
        expect(resolverCluster('te', 'los')).toBe('te los');
        expect(resolverCluster('nos', 'la')).toBe('nos la');
    });
});

describe('attachEnclitic', () => {
    it('accents infinitives with a double clitic (esdrújula)', () => {
        expect(attachEnclitic('inf', verbByInfinitive('dar'), 'se lo')).toBe('dárselo');
        expect(attachEnclitic('inf', verbByInfinitive('vender'), 'se la')).toBe('vendérsela');
        expect(attachEnclitic('inf', verbByInfinitive('escribir'), 'se lo')).toBe('escribírselo');
    });

    it('accents gerunds with a double clitic', () => {
        expect(attachEnclitic('ger', verbByInfinitive('dar'), 'se lo')).toBe('dándoselo');
        expect(attachEnclitic('ger', verbByInfinitive('leer'), 'se lo')).toBe('leyéndoselo');
        expect(attachEnclitic('ger', verbByInfinitive('pedir'), 'se la')).toBe('pidiéndosela');
    });

    it('attaches clitics to the affirmative imperative form', () => {
        expect(attachEnclitic('imp', verbByInfinitive('dar'), 'se lo')).toBe('dáselo');
    });
});

const ALL_TYPES = Object.values(ExerciseType);

describe('generateBatch', () => {
    it('returns exactly the requested count for every exercise type', () => {
        for (const type of ALL_TYPES) {
            const batch = generateBatch(type, 5);
            expect(batch).toHaveLength(5);
        }
    });

    it('produces multiple-choice questions whose options include the correct answer', () => {
        const optionTypes = [
            ExerciseType.POP_UP_PRONOUN,
            ExerciseType.SHORT_CIRCUIT,
            ExerciseType.INTERFERENCE,
        ];
        for (const type of optionTypes) {
            for (const q of generateBatch(type, 20) as QuestionWithOptions[]) {
                const norms = q.options.map(normalize);
                expect(norms).toContain(normalize(q.correctAnswer));
                // Options are homogeneous and de-duplicated.
                expect(new Set(norms).size).toBe(q.options.length);
            }
        }
    });

    it('marks at least one valid slot for every position question', () => {
        for (const q of generateBatch(ExerciseType.PRONOUN_POSITION, 20) as PronounPositionQuestion[]) {
            expect(q.correctSlotIds.length).toBeGreaterThan(0);
            const validSlotIds = q.tokens
                .filter((t): t is Extract<typeof t, { kind: 'slot' }> => t.kind === 'slot' && t.valid)
                .map(t => t.id);
            expect([...validSlotIds].sort()).toEqual([...q.correctSlotIds].sort());
        }
    });

    it('throws for an unsupported exercise type', () => {
        expect(() => generateBatch('NOPE' as ExerciseType, 3)).toThrow();
    });
});
