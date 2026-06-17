// Fachada del motor de ejercicios.
//
// Reemplaza por completo al antiguo `gemini.ts`: la generación de ejercicios ahora
// es 100% local (sin IA ni red), pero conserva la misma firma async para no tocar
// los `await` de los consumidores (App.tsx, Session.tsx y el modo infinito).

import { ExerciseType, QuestionData } from './types';
import { generateBatch } from './engine/generator';

// Cantidad de preguntas por lote según el tipo de ejercicio.
const BATCH_SIZE: Partial<Record<ExerciseType, number>> = {
    [ExerciseType.BATTLE]: 15,
};
const DEFAULT_BATCH_SIZE = 5;

export const generateExerciseData = async (exerciseType: ExerciseType): Promise<QuestionData[]> => {
    const count = BATCH_SIZE[exerciseType] ?? DEFAULT_BATCH_SIZE;
    return generateBatch(exerciseType, count);
};
