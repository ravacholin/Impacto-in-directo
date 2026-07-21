import { describe, it, expect, beforeEach } from 'vitest';
import { generateBatch } from '../generator';
import { resetHistory } from '../history';
import { VERBS, DIRECT_OBJECTS, INDIRECT_OBJECTS } from '../pronouns';
import { ExerciseType, type DecoderQuestion, type Difficulty } from '../../types';
import { describeQuestion, normalize } from '../../utils';

const odByPhrase = (phrase: string) => DIRECT_OBJECTS.find(o => o.phrase === phrase);
const oiByPhrase = (phrase: string) => INDIRECT_OBJECTS.find(o => o.phrase === phrase);

const isOdMode = (q: DecoderQuestion) => q.prompt.startsWith('¿Qué es');

const gen = (n: number, difficulty: Difficulty): DecoderQuestion[] => {
    resetHistory();
    return generateBatch(ExerciseType.DECODER, n, { difficulty }) as DecoderQuestion[];
};

describe('generateDecoder', () => {
    beforeEach(() => resetHistory());

    it('modo OD: las 4 opciones tienen pronombre distinto entre sí', () => {
        const qs = gen(30, 3).filter(isOdMode);
        expect(qs.length).toBeGreaterThan(0);
        for (const q of qs) {
            const prons = q.options.map(p => odByPhrase(p)?.pron);
            expect(prons.every(Boolean)).toBe(true);
            expect(new Set(prons).size).toBe(prons.length);
        }
    });

    it('modo OD: todas las opciones son compatibles con un mismo verbo (anti-trampa)', () => {
        const qs = gen(30, 3).filter(isOdMode);
        for (const q of qs) {
            const ods = q.options.map(odByPhrase);
            const commonVerbExists = VERBS.some(v => ods.every(od => !!od && od.tags.some(t => v.accepts.includes(t))));
            expect(commonVerbExists).toBe(true);
        }
    });

    it('modo OD: la respuesta correcta coincide con el clítico mostrado', () => {
        const qs = gen(30, 3).filter(isOdMode);
        for (const q of qs) {
            const correct = odByPhrase(q.correctAnswer);
            expect(correct).toBeTruthy();
            // El pronombre de la respuesta correcta aparece en el prompt («X»).
            expect(q.prompt).toContain(`«${correct!.pron}»`);
        }
    });

    it('dificultad 1: solo un clítico (sin clúster doble)', () => {
        const qs = gen(30, 1 as Difficulty);
        expect(qs.every(isOdMode)).toBe(true);
        for (const q of qs) {
            const first = q.phrase.split(' ')[0].toLowerCase();
            expect(['lo', 'la', 'los', 'las']).toContain(first);
        }
    });

    it('modo OI: exactamente una opción resuelve al clítico OI visible', () => {
        const qs = gen(40, 3).filter(q => q.prompt.startsWith('¿A quién'));
        // El modo OI aparece parte de las veces en niveles altos.
        expect(qs.length).toBeGreaterThan(0);
        for (const q of qs) {
            const visible = q.phrase.split(' ')[0].toLowerCase(); // se / me / te / nos
            const resolved = q.options.map(p => {
                const oi = oiByPhrase(p);
                return oi ? (oi.isThirdPerson ? 'se' : oi.pron) : '?';
            });
            const matches = resolved.filter(r => r === visible);
            expect(matches).toHaveLength(1);
            const correct = oiByPhrase(q.correctAnswer)!;
            expect(correct.isThirdPerson ? 'se' : correct.pron).toBe(visible);
        }
    });

    it('el lote no repite contenido', () => {
        const qs = gen(5, 3);
        const keys = qs.map(q => {
            const { prompt, correctAnswer } = describeQuestion(ExerciseType.DECODER, q);
            return `${normalize(prompt)}#${normalize(correctAnswer)}`;
        });
        expect(new Set(keys).size).toBe(keys.length);
    });
});
