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
import { generateReviewBatch } from './engine/generators/review';
import { loadSettings, getPriorityRules, loadErrors, recentErrorRules } from './store';

// Cantidad de preguntas por lote de práctica.
export const DEFAULT_BATCH_SIZE = 5;

const wrap = (type: ExerciseType, questions: QuestionData[]): SessionItem[] =>
    questions.map(question => ({ type, question }));

export const generateExerciseData = async (exerciseType: ExerciseType): Promise<SessionItem[]> => {
    const { difficulty } = loadSettings();
    const questions = generateBatch(exerciseType, DEFAULT_BATCH_SIZE, { difficulty, weakRules: getPriorityRules() });
    return wrap(exerciseType, questions);
};

// Repaso Inteligente: lote mixto dirigido por las reglas prioritarias del
// estudiante. La inyección de dificultad y reglas vive en la fachada (los
// generadores no importan store.ts).
export const generateReviewData = async (): Promise<SessionItem[]> => {
    const { difficulty } = loadSettings();
    return generateReviewBatch(DEFAULT_BATCH_SIZE, { difficulty, rules: getPriorityRules() });
};

// Repaso de errores: lote dirigido a las reglas de tus últimos fallos (log local
// `ii_errors_v1`). Apunta a las REGLAS que fallaste, no al ítem textual exacto, y
// respeta el nivel actual. Si no hay reglas entrenables en el nivel,
// `generateReviewBatch` ya cae en su lote genérico, así que nunca sale vacío.
export const generateMistakeReviewData = async (): Promise<SessionItem[]> => {
    const { difficulty } = loadSettings();
    const rules = recentErrorRules(loadErrors());
    return generateReviewBatch(DEFAULT_BATCH_SIZE, { difficulty, rules });
};
