import { describe, it, expect } from 'vitest';
import { evaluateAnswer } from './evaluate';
import {
    ExerciseType,
    type InstantSwitchQuestion,
    type DetectorQuestion,
    type PronounPositionQuestion,
    type PopUpPronounQuestion,
    type Explanation,
} from '../types';

const dummyExplanation: Explanation = { ruleId: 'OD_AGREEMENT', title: 't', steps: [] };

describe('evaluateAnswer', () => {
    it('POP_UP: compara con correctAnswer ignorando mayúsculas/tildes/puntuación', () => {
        const q: PopUpPronounQuestion = {
            phrase: 'Doy el libro a Juan',
            correctAnswer: 'se lo',
            options: ['se lo', 'le lo', 'me lo', 'te lo'],
            explanation: dummyExplanation,
        };
        expect(evaluateAnswer(ExerciseType.POP_UP_PRONOUN, q, 'se lo')).toBe(true);
        expect(evaluateAnswer(ExerciseType.POP_UP_PRONOUN, q, 'SE LO')).toBe(true);
        expect(evaluateAnswer(ExerciseType.POP_UP_PRONOUN, q, ' se  lo ')).toBe(true);
        expect(evaluateAnswer(ExerciseType.POP_UP_PRONOUN, q, 'le lo')).toBe(false);
    });

    it('INSTANT_SWITCH: acepta transformedPhrase y todas las acceptedAnswers', () => {
        const q: InstantSwitchQuestion = {
            initialPhrase: 'Doy el libro a Juan.',
            transformedPhrase: 'Se lo doy.',
            acceptedAnswers: ['se lo doy', 'yo se lo doy'],
            explanation: dummyExplanation,
        };
        expect(evaluateAnswer(ExerciseType.INSTANT_SWITCH, q, 'Se lo doy.')).toBe(true);
        expect(evaluateAnswer(ExerciseType.INSTANT_SWITCH, q, 'yo se lo doy')).toBe(true);
        expect(evaluateAnswer(ExerciseType.INSTANT_SWITCH, q, 'SE LO DOY')).toBe(true);
        expect(evaluateAnswer(ExerciseType.INSTANT_SWITCH, q, 'le lo doy')).toBe(false);
    });

    it('INSTANT_SWITCH: sin acceptedAnswers solo acepta transformedPhrase', () => {
        const q: InstantSwitchQuestion = {
            initialPhrase: 'Doy el libro.',
            transformedPhrase: 'Lo doy.',
            explanation: dummyExplanation,
        };
        expect(evaluateAnswer(ExerciseType.INSTANT_SWITCH, q, 'lo doy')).toBe(true);
        expect(evaluateAnswer(ExerciseType.INSTANT_SWITCH, q, 'la doy')).toBe(false);
    });

    it('DETECTOR: acepta cualquiera de las correctAnswers normalizadas', () => {
        const q: DetectorQuestion = {
            prompt: 'ducharse · Yo',
            options: ['Yo me ducho.', 'Yo se ducho.', 'Yo ducho me.', 'Yo ducho.'],
            correctAnswers: ['Yo me ducho.'],
            explanation: dummyExplanation,
        };
        expect(evaluateAnswer(ExerciseType.DETECTOR, q, 'Yo me ducho.')).toBe(true);
        expect(evaluateAnswer(ExerciseType.DETECTOR, q, 'yo me ducho')).toBe(true);
        expect(evaluateAnswer(ExerciseType.DETECTOR, q, 'Yo se ducho.')).toBe(false);
    });

    it('PRONOUN_POSITION: correcto si el id del hueco está entre los válidos', () => {
        const q: PronounPositionQuestion = {
            contextLabel: 'VERBO CONJUGADO',
            chip: 'se lo',
            tokens: [
                { kind: 'word', text: 'Él' },
                { kind: 'slot', id: 's1', valid: true, result: 'Él se lo da.', display: 'se lo' },
                { kind: 'word', text: 'da' },
                { kind: 'slot', id: 's2', valid: false, result: 'Él daselo.', display: 'selo' },
            ],
            correctSlotIds: ['s1'],
            acceptsMultiple: false,
            explanation: dummyExplanation,
        };
        expect(evaluateAnswer(ExerciseType.PRONOUN_POSITION, q, 's1')).toBe(true);
        expect(evaluateAnswer(ExerciseType.PRONOUN_POSITION, q, 's2')).toBe(false);
        expect(evaluateAnswer(ExerciseType.PRONOUN_POSITION, q, 'nope')).toBe(false);
    });

    it('PRONOUN_POSITION: perífrasis acepta los dos huecos válidos', () => {
        const q: PronounPositionQuestion = {
            contextLabel: 'PERÍFRASIS',
            chip: 'se lo',
            tokens: [
                { kind: 'slot', id: 's1', valid: true, result: 'Se lo va a dar.', display: 'se lo' },
                { kind: 'word', text: 'Va a' },
                { kind: 'slot', id: 's2', valid: false, result: 'Va a se lo dar.', display: 'se lo' },
                { kind: 'word', text: 'dar' },
                { kind: 'slot', id: 's3', valid: true, result: 'Va a dárselo.', display: 'selo' },
            ],
            correctSlotIds: ['s1', 's3'],
            acceptsMultiple: true,
            explanation: dummyExplanation,
        };
        expect(evaluateAnswer(ExerciseType.PRONOUN_POSITION, q, 's1')).toBe(true);
        expect(evaluateAnswer(ExerciseType.PRONOUN_POSITION, q, 's3')).toBe(true);
        expect(evaluateAnswer(ExerciseType.PRONOUN_POSITION, q, 's2')).toBe(false);
    });
});
