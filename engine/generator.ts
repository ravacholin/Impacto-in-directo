// Fachada del generador procedural de ejercicios.
//
// La infraestructura compartida vive en `generators/common.ts` (contexto,
// pools, explicaciones, distractores) y cada tipo de ejercicio en su propio
// archivo bajo `generators/`. Este módulo solo ata todo: el mapa de generadores
// por tipo, el dedup por lote/historial (`generateBatch`) y los re-exports que
// mantienen estables los imports existentes (tests incluidos).

import { ExerciseType, QuestionData } from '../types';
import { describeQuestion } from '../utils';
import { hasBeenSeen, remember } from './history';
import { type GenContext, type GenOptions, buildContext, buildPools, key } from './generators/common';
import { generatePopUp } from './generators/popup';
import { generateInterference } from './generators/interference';
import { generateShortCircuit } from './generators/shortCircuit';
import { generateInstantSwitch } from './generators/instantSwitch';
import { generateDetector } from './generators/detector';
import { generatePronounPosition } from './generators/position';
import { generateQuickResponse } from './generators/quickResponse';
import { generateDecoder } from './generators/decoder';

// Re-exports de compatibilidad (tests y otros módulos importan desde aquí).
export { buildPools, buildContext };
export type { GenOptions, GenContext };

// Exportado para que el generador de repaso produzca una pregunta suelta de un
// tipo dado con el mismo sesgo por regla, sin duplicar el mapa.
export const GENERATORS: Record<ExerciseType, (ctx: GenContext) => QuestionData> = {
    [ExerciseType.POP_UP_PRONOUN]: generatePopUp,
    [ExerciseType.INTERFERENCE]: generateInterference,
    [ExerciseType.SHORT_CIRCUIT]: generateShortCircuit,
    [ExerciseType.INSTANT_SWITCH]: generateInstantSwitch,
    [ExerciseType.DETECTOR]: generateDetector,
    [ExerciseType.PRONOUN_POSITION]: generatePronounPosition,
    [ExerciseType.QUICK_RESPONSE]: generateQuickResponse,
    [ExerciseType.DECODER]: generateDecoder,
};

// Clave de contenido de una pregunta: lo que el alumno realmente LEE (frase +
// respuesta correcta), no el objeto entero. Las opciones de cada pregunta se
// barajan al azar (`shuffle`), así que compararlas haría que la misma frase con
// las opciones en otro orden pareciera "distinta" y se colara como repetición.
const contentKey = (type: ExerciseType, q: QuestionData): string => {
    const { prompt, correctAnswer } = describeQuestion(type, q);
    return `${key(prompt)}#${key(correctAnswer)}`;
};

// Genera un lote de preguntas evitando repetir contenido. Prioridad, de más a
// menos estricta:
//  1. Ni repite dentro del lote ni repite algo visto recientemente en lotes
//     anteriores del mismo tipo (registro en `history.ts`) — así el modo
//     infinito no reencadena la misma frase apenas empezado el lote siguiente.
//  2. Si el pool ya no da más variedad frente al historial, se relaja SOLO esa
//     restricción (se sigue evitando duplicar dentro del propio lote): la
//     repetición aparece recién cuando es inevitable, nunca antes.
//  3. Último recurso (improbable): ni el propio lote da más variedad. Se
//     completa permitiendo repeticiones para no devolver un lote vacío.
export const generateBatch = (type: ExerciseType, count: number, options: GenOptions = {}): QuestionData[] => {
    const generate = GENERATORS[type];
    if (!generate) throw new Error(`Exercise type "${type}" not supported.`);

    const ctx = buildContext(options);
    const questions: QuestionData[] = [];
    const seenInBatch = new Set<string>();
    const maxAttempts = count * 30;

    let attempts = 0;
    while (questions.length < count && attempts < maxAttempts) {
        attempts++;
        const q = generate(ctx);
        const k = contentKey(type, q);
        if (seenInBatch.has(k) || hasBeenSeen(type, k)) continue;
        seenInBatch.add(k);
        questions.push(q);
    }

    attempts = 0;
    while (questions.length < count && attempts < maxAttempts) {
        attempts++;
        const q = generate(ctx);
        const k = contentKey(type, q);
        if (seenInBatch.has(k)) continue;
        seenInBatch.add(k);
        questions.push(q);
    }

    while (questions.length < count) questions.push(generate(ctx));

    for (const k of seenInBatch) remember(type, k);

    return questions;
};

// Re-exportado para que el generador de repaso comparta el mismo dedup.
export { contentKey };
