import {
    ExerciseType,
    type QuestionData,
    type PopUpPronounQuestion,
    type InterferenceQuestion,
    type ShortCircuitQuestion,
    type InstantSwitchQuestion,
    type DetectorQuestion,
    type PronounPositionQuestion,
    type QuickResponseQuestion,
    type DecoderQuestion,
} from './types';

// Deriva un enunciado legible y la respuesta correcta (en texto) de una pregunta,
// para registrar los errores en el log local. Ramifica por tipo reutilizando las
// formas de `QuestionData` (cada tipo guarda la frase en un campo distinto).
export const describeQuestion = (
    exerciseType: ExerciseType,
    question: QuestionData,
): { prompt: string; correctAnswer: string } => {
    switch (exerciseType) {
        case ExerciseType.POP_UP_PRONOUN: {
            const q = question as PopUpPronounQuestion;
            return { prompt: q.phrase, correctAnswer: q.correctAnswer };
        }
        case ExerciseType.INTERFERENCE: {
            const q = question as InterferenceQuestion;
            return { prompt: q.phrase, correctAnswer: q.correctAnswer };
        }
        case ExerciseType.SHORT_CIRCUIT: {
            const q = question as ShortCircuitQuestion;
            return { prompt: `${q.person} · ${q.object}`, correctAnswer: q.correctAnswer };
        }
        case ExerciseType.INSTANT_SWITCH: {
            const q = question as InstantSwitchQuestion;
            return { prompt: q.initialPhrase, correctAnswer: q.transformedPhrase };
        }
        case ExerciseType.DETECTOR: {
            const q = question as DetectorQuestion;
            return { prompt: q.prompt, correctAnswer: (q.correctAnswers || []).join(', ') };
        }
        case ExerciseType.PRONOUN_POSITION: {
            const q = question as PronounPositionQuestion;
            const correct = q.tokens.find(t => t.kind === 'slot' && q.correctSlotIds.includes(t.id));
            const result = correct && correct.kind === 'slot' ? correct.result : q.chip;
            return { prompt: `${q.contextLabel} · «${q.chip}»`, correctAnswer: result };
        }
        case ExerciseType.QUICK_RESPONSE: {
            const q = question as QuickResponseQuestion;
            return { prompt: q.questionPhrase, correctAnswer: q.correctAnswer };
        }
        case ExerciseType.DECODER: {
            const q = question as DecoderQuestion;
            return { prompt: `${q.phrase} ${q.prompt}`, correctAnswer: q.correctAnswer };
        }
        default:
            return { prompt: '', correctAnswer: '' };
    }
};

// Loose text normalization shared across the engine (dedup keys) and the UI
// (answer comparison): lowercase and strip everything except Spanish letters,
// so spaces, punctuation and casing are ignored.
export const normalize = (str: string): string =>
    (str ?? '').toLowerCase().replace(/[^a-záéíóúüñ]/g, '');

// Fisher–Yates. Única implementación de barajado de la app (un `sort` con
// comparador aleatorio produce permutaciones sesgadas).
export const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};
