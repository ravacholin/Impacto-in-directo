// DECODIFICADOR: comprensión inversa. Se muestra la frase YA pronominalizada
// ("Se las llevo mañana.") y se pregunta por el referente de un clítico
// ("¿Qué es «las»?"). Es la habilidad de decodificar clíticos al escuchar
// español real, que ningún otro ejercicio entrena (todos van frase → pronombre).

import type { QuestionData, DecoderQuestion, Explanation } from '../../types';
import {
    resolverCluster,
    compatibleObjects,
    oiCompatible,
    DIRECT_PRONOUNS,
    type DirectObject,
    type DirectPronoun,
    type IndirectObject,
    type Verb,
} from '../pronouns';
import { type GenContext, pick, cap, OD_LABELS } from './common';

// Colas temporales (presente/futuro próximo) para ambientar la frase sin exigir
// pasado. Aparecen la mitad de las veces.
const TAILS = ['', ' hoy', ' mañana', ' esta tarde', ' ahora', ' enseguida'];
const tail = (): string => (Math.random() < 0.5 ? pick(TAILS) : '');

// Agrupa los ODs compatibles con el verbo por pronombre (lo/la/los/las).
const groupByPron = (compat: DirectObject[]): Map<DirectPronoun, DirectObject[]> => {
    const map = new Map<DirectPronoun, DirectObject[]>();
    for (const od of compat) {
        const list = map.get(od.pron);
        if (list) list.push(od);
        else map.set(od.pron, [od]);
    }
    return map;
};

// Elige un verbo cuyo pool compatible cubra los CUATRO pronombres (lo/la/los/las),
// para poder ofrecer 4 opciones de OD con pronombre distinto entre sí y todas
// compatibles con el verbo: así solo la concordancia desambigua, nunca la
// semántica. Cascada de fallback para no fallar nunca.
const pickVerbWithAllProns = (ctx: GenContext): { verb: Verb; byPron: Map<DirectPronoun, DirectObject[]> } => {
    let best: { verb: Verb; byPron: Map<DirectPronoun, DirectObject[]> } | null = null;
    for (let i = 0; i < 40; i++) {
        const verb = pick(ctx.verbPool);
        const compat = ctx.compatByVerb.get(verb.infinitive) ?? compatibleObjects(verb, ctx.odPool);
        const byPron = groupByPron(compat);
        if (DIRECT_PRONOUNS.every(p => byPron.has(p))) return { verb, byPron };
        if (!best || byPron.size > best.byPron.size) best = { verb, byPron };
    }
    return best!;
};

// Mezcla local (evita depender del shuffle global para el orden de opciones aquí).
const shuffle4 = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

// Modo REFERENTE OD (todas las dificultades). Diff 1: un solo clítico
// ("La compro esta tarde."). Diff 2-3: clúster doble ("Se las llevo mañana."),
// preguntando por el OD.
const generateDecoderOD = (ctx: GenContext): DecoderQuestion => {
    const { verb, byPron } = pickVerbWithAllProns(ctx);
    // Pronombres que el verbo puede ejemplificar (idealmente los 4).
    const availableProns = DIRECT_PRONOUNS.filter(p => byPron.has(p));
    const correctPron = pick(availableProns);
    const correct = pick(byPron.get(correctPron)!);
    // Una opción por pronombre disponible (todas compatibles con el verbo).
    const options = availableProns.map(p => (p === correctPron ? correct : pick(byPron.get(p)!)));

    const yoForm = verb.forms.yo;
    let phrase: string;
    let clitic: string;
    if (ctx.singleClitic) {
        clitic = correctPron;
        phrase = `${cap(correctPron)} ${yoForm}${tail()}.`;
    } else {
        // Clúster doble: OI de 3ª persona (→ se) o 1ª/2ª; el OD sigue siendo el foco.
        const oi = pick(ctx.oiPool);
        const cluster = resolverCluster(oi.pron, correctPron);
        clitic = correctPron;
        phrase = `${cap(cluster)} ${yoForm}${tail()}.`;
    }

    const distractor = options.find(o => o.pron !== correctPron) ?? correct;
    const explanation: Explanation = {
        ruleId: 'OD_AGREEMENT',
        title: `Regla: «${clitic}» concuerda con el objeto`,
        steps: [
            `«${clitic}» = ${OD_LABELS[correctPron]}`,
            `${correct.phrase} ✓`,
            `${distractor.phrase} ✗ (${OD_LABELS[distractor.pron]})`,
        ],
        detail: 'El clítico de objeto directo concuerda en género y número con el sintagma al que reemplaza.',
    };

    return {
        phrase,
        prompt: `¿Qué es «${clitic}»?`,
        options: shuffle4(options.map(o => o.phrase)),
        correctAnswer: correct.phrase,
        explanation,
    };
};

// Modo REFERENTE OI (dificultad ≥ 2). Se pregunta ¿A quién …?; las 4 opciones
// tienen un clítico resuelto DISTINTO entre sí (se / me / te / nos), de modo que
// solo una encaja con el clítico visible. `ruleId`: SE_TRANSFORM si el clúster
// lleva "se" (3ª persona), si no CLITIC_ORDER.
const findOI = (pool: IndirectObject[], phrase: string): IndirectObject | undefined =>
    pool.find(o => o.phrase === phrase);

const generateDecoderOI = (ctx: GenContext): QuestionData => {
    const { verb, byPron } = pickVerbWithAllProns(ctx);
    const odProns = DIRECT_PRONOUNS.filter(p => byPron.has(p));
    const od = pick(byPron.get(pick(odProns))!);

    // Cuatro referentes con clítico OI resuelto distinto: una 3ª persona (→ se)
    // y las tres personas fijas a mí / a ti / a nosotros. La 3ª persona debe ser
    // compatible con el verbo (no "vender … a los niños").
    const thirdPool = ctx.oiPool.filter(o => o.isThirdPerson && oiCompatible(verb, o));
    const third = thirdPool.length ? pick(thirdPool) : undefined;
    const aMi = findOI(ctx.oiLevelPool, 'a mí');
    const aTi = findOI(ctx.oiLevelPool, 'a ti');
    const aNos = findOI(ctx.oiLevelPool, 'a nosotros');
    const candidates = [third, aMi, aTi, aNos].filter((o): o is IndirectObject => !!o);
    // Sin al menos dos referentes distintos, degrada al modo OD.
    if (candidates.length < 2) return generateDecoderOD(ctx);

    const correct = pick(candidates);
    const cluster = resolverCluster(correct.pron, od.pron);
    const oiClitic = cluster.split(' ')[0]; // "se" | "me" | "te" | "nos"
    const yoForm = verb.forms.yo;
    const phrase = `${cap(cluster)} ${yoForm}${tail()}.`;

    const other = candidates.find(c => c.phrase !== correct.phrase)!;
    const otherClitic = resolverCluster(other.pron, od.pron).split(' ')[0];
    const explanation: Explanation = correct.isThirdPerson
        ? {
            ruleId: 'SE_TRANSFORM',
            title: 'Regla: «se» viene de le/les',
            steps: [
                `«${oiClitic}» = le/les ante lo/la/los/las (3ª persona)`,
                `${correct.phrase} → ${correct.pron} → se ✓`,
                `${other.phrase} → ${otherClitic} ✗`,
            ],
            detail: 'Cuando le/les va delante de lo/la/los/las se convierte en "se": el referente es una 3ª persona.',
        }
        : {
            ruleId: 'CLITIC_ORDER',
            title: `Regla: «${oiClitic}» marca la persona`,
            steps: [
                `«${oiClitic}» = ${correct.phrase}`,
                `${correct.phrase} → ${correct.pron} ✓`,
                `${other.phrase} → ${otherClitic} ✗`,
            ],
            detail: 'El clítico de objeto indirecto (persona) va antes que el de objeto directo (cosa).',
        };

    return {
        phrase,
        prompt: `¿A quién ${cluster} ${yoForm}?`,
        options: shuffle4(candidates.map(c => c.phrase)),
        correctAnswer: correct.phrase,
        explanation,
    };
};

export const generateDecoder = (ctx: GenContext): QuestionData => {
    if (ctx.singleClitic) return generateDecoderOD(ctx);
    return Math.random() < 0.5 ? generateDecoderOD(ctx) : generateDecoderOI(ctx);
};
