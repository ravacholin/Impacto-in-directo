// Fachada del motor de ejercicios.
//
// Reemplaza por completo al antiguo `gemini.ts`: la generación de ejercicios ahora
// es 100% local (sin IA ni red), pero conserva la misma firma async para no tocar
// los `await` de los consumidores (App.tsx, Session.tsx y el modo infinito).
//
// Aquí se inyectan la dificultad elegida y las reglas a priorizar del estudiante
// (store.ts: vencidas por SRS ∪ débiles por precisión), de modo que los
// consumidores no cambian de firma. Envuelve cada `QuestionData` en un
// `SessionItem` con su tipo, para que la sesión (que ahora es heterogénea)
// sepa qué vista/corrección/timer aplicar por pregunta.

import { ExerciseType, QuestionData, SessionItem } from './types';
import { generateBatch } from './engine/generator';
import { loadSettings, getPriorityRules } from './store';

// Cantidad de preguntas por lote de práctica.
export const DEFAULT_BATCH_SIZE = 5;

const wrap = (type: ExerciseType, questions: QuestionData[]): SessionItem[] =>
    questions.map(question => ({ type, question }));

export const generateExerciseData = async (exerciseType: ExerciseType): Promise<SessionItem[]> => {
    const { difficulty } = loadSettings();
    const questions = generateBatch(exerciseType, DEFAULT_BATCH_SIZE, { difficulty, weakRules: getPriorityRules() });
    return wrap(exerciseType, questions);
};
