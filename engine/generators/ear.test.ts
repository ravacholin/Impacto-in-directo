import { describe, it, expect, beforeEach } from 'vitest';
import { generateBatch } from '../generator';
import { resetHistory } from '../history';
import { ExerciseType, type EarQuestion, type Difficulty } from '../../types';
import { normalize, describeQuestion } from '../../utils';

const gen = (n: number, difficulty: Difficulty): EarQuestion[] => {
    resetHistory();
    return generateBatch(ExerciseType.EAR, n, { difficulty }) as EarQuestion[];
};

describe('generateEar', () => {
    beforeEach(() => resetHistory());

    it('maskedPhrase tapa el clúster con "___" y no lo contiene', () => {
        for (const difficulty of [1, 2, 3] as Difficulty[]) {
            for (const q of gen(20, difficulty)) {
                expect(q.maskedPhrase).toContain('___');
                expect(normalize(q.maskedPhrase)).not.toContain(normalize(q.correctAnswer));
            }
        }
    });

    it('fullPhrase sí contiene el clúster correcto', () => {
        for (const difficulty of [1, 2, 3] as Difficulty[]) {
            for (const q of gen(20, difficulty)) {
                expect(normalize(q.fullPhrase)).toContain(normalize(q.correctAnswer));
            }
        }
    });

    it('las opciones son homogéneas (igual nº de palabras), únicas e incluyen la correcta', () => {
        for (const difficulty of [1, 2, 3] as Difficulty[]) {
            for (const q of gen(20, difficulty)) {
                const wordCounts = new Set(q.options.map(o => o.trim().split(/\s+/).length));
                expect(wordCounts.size).toBe(1);
                expect(new Set(q.options.map(normalize)).size).toBe(q.options.length);
                expect(q.options.map(normalize)).toContain(normalize(q.correctAnswer));
            }
        }
    });

    it('dificultad 1: clítico simple (una palabra); niveles 2/3: clúster doble', () => {
        for (const q of gen(20, 1 as Difficulty)) {
            expect(q.correctAnswer.trim().split(/\s+/)).toHaveLength(1);
        }
        for (const q of gen(20, 2 as Difficulty)) {
            expect(q.correctAnswer.trim().split(/\s+/)).toHaveLength(2);
        }
    });

    it('describeQuestion usa fullPhrase como enunciado', () => {
        const [q] = gen(1, 2 as Difficulty);
        const { prompt } = describeQuestion(ExerciseType.EAR, q);
        expect(prompt).toBe(q.fullPhrase);
    });
});
