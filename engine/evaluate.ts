// Corrección pura por tipo de ejercicio.
//
// Extraída de la lógica inline que vivía en `Session.tsx`. Al ser una función
// pura (sin estado ni DOM) puede testearse sola y reutilizarse en las sesiones
// heterogéneas (Repaso Inteligente), donde cada pregunta se corrige según SU
// tipo, no el del ejercicio contenedor.

import {
    ExerciseType,
    type QuestionData,
    type QuestionWithOptions,
    type InstantSwitchQuestion,
    type DetectorQuestion,
    type PronounPositionQuestion,
} from '../types';
import { normalize } from '../utils';

// INSTANT_SWITCH y DETECTOR normalizan contra la lista de respuestas aceptadas;
// PRONOUN_POSITION compara ids de hueco; el resto compara con correctAnswer
// normalizado.
export const evaluateAnswer = (
    type: ExerciseType,
    question: QuestionData,
    answer: string,
): boolean => {
    if (type === ExerciseType.INSTANT_SWITCH) {
        const q = question as InstantSwitchQuestion;
        const userNorm = normalize(answer);
        const validAnswers = [q.transformedPhrase, ...(q.acceptedAnswers || [])].map(normalize);
        return validAnswers.includes(userNorm);
    }
    if (type === ExerciseType.DETECTOR) {
        const q = question as DetectorQuestion;
        const userNorm = normalize(answer);
        const validAnswers = (q.correctAnswers || []).map(normalize);
        return validAnswers.includes(userNorm);
    }
    if (type === ExerciseType.PRONOUN_POSITION) {
        const q = question as PronounPositionQuestion;
        // 'answer' es el id del hueco elegido; correcto si está entre los válidos.
        return (q.correctSlotIds || []).includes(answer);
    }
    const q = question as QuestionWithOptions;
    return normalize(answer) === normalize(q.correctAnswer);
};
