// REPASO INTELIGENTE: lote heterogéneo dirigido por las reglas prioritarias del
// estudiante (vencidas por SRS ∪ débiles por precisión). Mezcla tipos de
// ejercicio: cada regla se entrena con el formato que mejor la ejercita.
//
// El sesgo por regla ya existe en los generadores (`weakRules`); aquí solo se
// recorren las reglas en round-robin, se elige un tipo compatible y se genera
// una pregunta con esa regla marcada como débil. Reutiliza el ring de dedup de
// `history.ts`, igual que `generateBatch`.

import { ExerciseType, type SessionItem, type RuleId, type Difficulty } from '../../types';
import { hasBeenSeen, remember } from '../history';
import { GENERATORS, contentKey } from '../generator';
import { type GenContext, buildContext, pick } from './common';

const {
    POP_UP_PRONOUN,
    SHORT_CIRCUIT,
    INSTANT_SWITCH,
    DETECTOR,
    PRONOUN_POSITION,
    QUICK_RESPONSE,
} = ExerciseType;

// Qué tipos de ejercicio entrenan cada regla. Los POSITION_* solo existen en
// el ejercicio de posición; el resto admite varios formatos.
export const RULE_TO_TYPES: Record<RuleId, ExerciseType[]> = {
    OD_AGREEMENT: [POP_UP_PRONOUN, SHORT_CIRCUIT, INSTANT_SWITCH],
    REFLEXIVE: [POP_UP_PRONOUN, SHORT_CIRCUIT, DETECTOR],
    REFLEXIVE_CONTRAST: [POP_UP_PRONOUN, DETECTOR],
    REFLEXIVE_BODY: [DETECTOR],
    CLITIC_ORDER: [POP_UP_PRONOUN, SHORT_CIRCUIT, QUICK_RESPONSE],
    SE_TRANSFORM: [POP_UP_PRONOUN, SHORT_CIRCUIT, QUICK_RESPONSE, DETECTOR],
    POSITION_PROCLISIS: [PRONOUN_POSITION],
    POSITION_ENCLISIS: [PRONOUN_POSITION],
    POSITION_PERIPHRASIS: [PRONOUN_POSITION],
    PERSON_FLIP: [QUICK_RESPONSE],
};

// ¿Se puede entrenar la regla en este nivel? Respeta los gates del generador:
// el clúster doble (le/les → se, orden OI+OD) solo existe desde el nivel 2, y la
// perífrasis solo desde el nivel 3. Los reflexivos son al revés: contenido
// EXCLUSIVO de BASE, no aparecen una vez que entra el doble reemplazo. Las demás
// reglas (incluido PERSON_FLIP, que en 2/3 es el volteo del clúster) se ejercitan
// en todos los niveles.
const ruleFeasible = (rule: RuleId, difficulty: Difficulty): boolean => {
    if (rule === 'SE_TRANSFORM' || rule === 'CLITIC_ORDER') return difficulty >= 2;
    if (rule === 'POSITION_PERIPHRASIS') return difficulty === 3;
    if (rule === 'REFLEXIVE' || rule === 'REFLEXIVE_CONTRAST' || rule === 'REFLEXIVE_BODY') return difficulty === 1;
    return true;
};

// Un contexto de generación por regla (con esa regla marcada como débil), para
// no reconstruir los pools en cada pregunta.
const contextFor = (cache: Map<RuleId, GenContext>, rule: RuleId, difficulty: Difficulty): GenContext => {
    let ctx = cache.get(rule);
    if (!ctx) {
        ctx = buildContext({ difficulty, weakRules: [rule] });
        cache.set(rule, ctx);
    }
    return ctx;
};

const genericContext = (difficulty: Difficulty): GenContext => buildContext({ difficulty });

export const generateReviewBatch = (
    size: number,
    opts: { difficulty: Difficulty; rules: RuleId[] },
): SessionItem[] => {
    const { difficulty } = opts;
    const feasible = opts.rules.filter(r => ruleFeasible(r, difficulty) && RULE_TO_TYPES[r]?.length);

    const items: SessionItem[] = [];
    const seenInBatch = new Set<string>();
    const remembered: Array<{ type: ExerciseType; key: string }> = [];

    // Fallback: sin reglas entrenables, un Pop-up mixto estándar del nivel.
    if (!feasible.length) {
        const ctx = genericContext(difficulty);
        let attempts = 0;
        const maxAttempts = size * 30;
        while (items.length < size && attempts < maxAttempts) {
            attempts++;
            const q = GENERATORS[POP_UP_PRONOUN](ctx);
            const k = contentKey(POP_UP_PRONOUN, q);
            if (seenInBatch.has(`${POP_UP_PRONOUN}:${k}`)) continue;
            seenInBatch.add(`${POP_UP_PRONOUN}:${k}`);
            remembered.push({ type: POP_UP_PRONOUN, key: k });
            items.push({ type: POP_UP_PRONOUN, question: q });
        }
        while (items.length < size) {
            const q = GENERATORS[POP_UP_PRONOUN](ctx);
            items.push({ type: POP_UP_PRONOUN, question: q });
        }
        for (const r of remembered) remember(r.type, r.key);
        return items;
    }

    const ctxCache = new Map<RuleId, GenContext>();
    let rr = 0; // índice de round-robin sobre las reglas entrenables

    const tryGenerate = (allowHistory: boolean): boolean => {
        const rule = feasible[rr % feasible.length];
        const type = pick(RULE_TO_TYPES[rule]);
        const ctx = contextFor(ctxCache, rule, difficulty);
        const q = GENERATORS[type](ctx);
        const k = contentKey(type, q);
        const batchKey = `${type}:${k}`;
        if (seenInBatch.has(batchKey)) return false;
        if (allowHistory && hasBeenSeen(type, k)) return false;
        seenInBatch.add(batchKey);
        remembered.push({ type, key: k });
        items.push({ type, question: q });
        rr++;
        return true;
    };

    // Pasada 1: evita repetir dentro del lote y contra el historial reciente.
    let attempts = 0;
    const maxAttempts = size * 30;
    while (items.length < size && attempts < maxAttempts) {
        attempts++;
        tryGenerate(true);
    }
    // Pasada 2: relaja el historial (sigue evitando duplicar dentro del lote).
    attempts = 0;
    while (items.length < size && attempts < maxAttempts) {
        attempts++;
        tryGenerate(false);
    }
    // Último recurso: completa aunque repita, para no devolver un lote corto.
    while (items.length < size) {
        const rule = feasible[rr % feasible.length];
        const type = pick(RULE_TO_TYPES[rule]);
        const ctx = contextFor(ctxCache, rule, difficulty);
        items.push({ type, question: GENERATORS[type](ctx) });
        rr++;
    }

    for (const r of remembered) remember(r.type, r.key);
    return items;
};
