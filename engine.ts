// Fachada del motor de ejercicios.
//
// Reemplaza por completo al antiguo `gemini.ts`: la generación de ejercicios ahora
// es 100% local (sin IA ni red), pero conserva la misma firma async para no tocar
// los `await` de los consumidores (App.tsx, Session.tsx y el modo infinito).
//
// Aquí se inyectan la dificultad elegida y las reglas a priorizar del estudiante
// (store.ts: vencidas por SRS ∪ débiles por precisión), de modo que los
// consumidores no cambian de firma.

import { ExerciseType, QuestionData } from './types';
import { generateBatch } from './engine/generator';
import { loadSettings, getPriorityRules } from './store';

// Cantidad de preguntas por lote de práctica.
export const DEFAULT_BATCH_SIZE = 5;

export const generateExerciseData = async (exerciseType: ExerciseType): Promise<QuestionData[]> => {
    const { difficulty } = loadSettings();
    return generateBatch(exerciseType, DEFAULT_BATCH_SIZE, { difficulty, weakRules: getPriorityRules() });
};
