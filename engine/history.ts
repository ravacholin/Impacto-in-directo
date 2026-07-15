// Registro de "lo que ya salió" para evitar repeticiones evitables.
//
// Cada tipo de ejercicio tiene su propia ventana deslizante de claves recientes
// (frase + respuesta correcta, ver `contentKey` en generator.ts). `generateBatch`
// la consulta ANTES de aceptar una pregunta nueva, tanto dentro del lote actual
// como entre lotes sucesivos (modo infinito): mientras el pool todavía tenga
// variedad, se descarta cualquier clave ya vista recientemente. Solo cuando el
// pool se agota se permite repetir — la repetición es el último recurso, nunca
// la primera opción.

import { ExerciseType } from '../types';

// Claves recientes recordadas por tipo de ejercicio. Suficiente para cubrir
// varios lotes de práctica seguidos sin acumular memoria sin límite; al
// superarlo se olvida la más antigua (FIFO).
const HISTORY_SIZE = 300;

const histories = new Map<ExerciseType, Map<string, true>>();

const getHistory = (type: ExerciseType): Map<string, true> => {
    let h = histories.get(type);
    if (!h) {
        h = new Map();
        histories.set(type, h);
    }
    return h;
};

export const hasBeenSeen = (type: ExerciseType, key: string): boolean => getHistory(type).has(key);

export const remember = (type: ExerciseType, key: string): void => {
    const h = getHistory(type);
    h.delete(key); // reinserta al final (más reciente) si ya estaba.
    h.set(key, true);
    if (h.size > HISTORY_SIZE) {
        const oldest = h.keys().next().value;
        if (oldest !== undefined) h.delete(oldest);
    }
};

// Solo para tests.
export const __testing = { HISTORY_SIZE, histories };

export const resetHistory = (type?: ExerciseType): void => {
    if (type) histories.delete(type);
    else histories.clear();
};
