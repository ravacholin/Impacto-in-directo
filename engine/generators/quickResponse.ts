// RESPUESTA RÁPIDA: pregunta dirigida a "tú", respuesta en primera persona.
// Ejercita el clúster completo MÁS el cambio de persona: "¿Me traes las llaves?"
// → "Sí, te las traigo".

import type { QuestionData, RuleId } from '../../types';
import { shuffle } from '../../utils';
import {
    resolverCluster,
    oiCompatible,
    REFLEXIVE_PRON,
    DIRECT_PRONOUNS,
    type IndirectObject,
    type IndirectPronoun,
} from '../pronouns';
import {
    type GenContext,
    pick,
    cap,
    pickCompatibleOD,
    pickOI,
    buildReflexiveOptions,
    buildSingleOptions,
    buildClusterOptions,
    odStep,
    explainSingleOd,
    explainCluster,
} from './common';

// Se excluyen "a ti" y "a nosotros" del pool porque su volteo es ambiguo; quedan
// "a mí" (→ te) y las terceras personas (→ se).
const flipOI = (oi: IndirectObject): { pron: IndirectPronoun; isThirdPerson: boolean } =>
    oi.pron === 'me' ? { pron: 'te', isThirdPerson: false } : { pron: oi.pron, isThirdPerson: oi.isThirdPerson };

// RESPUESTA RÁPIDA reflexiva (BASE). Cuatro variantes de diálogo (25% cada
// una), repartidas entre el registro informal ("tú") y el formal ("usted"/
// "ustedes") para no concentrar siempre la pregunta en la misma persona:
//  - te → me: "¿Te duchas?" → "Sí, me ducho" (el volteo clásico, informal).
//  - se (usted) → me: "¿Se ducha usted?" → "Sí, me ducho" (volteo formal).
//  - se (ustedes) → nos: "¿Ustedes se duchan?" → "Sí, nos duchamos".
//  - Contraste: la pregunta lleva un OD animado ("¿Despiertas a tu hermano?",
//    a veces en formal: "¿Despierta usted a su hermano?") y la trampa es
//    responder con el reflexivo ("Sí, me despierto") en vez del OD ("Sí, lo
//    despierto").
const generateQuickResponseReflexive = (ctx: GenContext): QuestionData => {
    const r = Math.random();
    if (r < 0.25) {
        const verb = pick(ctx.bareReflexivePool);
        const nosForm = verb.forms.nosotros;
        return {
            questionPhrase: `¿Ustedes se ${verb.forms.ellos}?`,
            correctAnswer: `Sí, nos ${nosForm}`,
            options: buildReflexiveOptions().map(p => `Sí, ${p} ${nosForm}`),
            explanation: {
                ruleId: 'PERSON_FLIP',
                title: 'Regla: cambio de persona',
                steps: [
                    'se (ustedes) → nos (respondemos por nosotros)',
                    `Ustedes se ${verb.forms.ellos} → Nosotros nos ${nosForm}`,
                ],
                detail: 'La pregunta habla de ustedes; la respuesta habla de nosotros → nos.',
            },
        };
    }
    if (r < 0.5) {
        const verb = pick(ctx.contrastQrReflexivePool);
        const plain = pick(verb.contrast!.plain.filter(p => p.pron));
        const yoForm = verb.forms.yo;
        const odPron = plain.pron!;
        const odAlt = pick(DIRECT_PRONOUNS.filter(p => p !== odPron));
        const formal = Math.random() < 0.5;
        const options = shuffle([
            `Sí, ${odPron} ${yoForm}`,
            `Sí, me ${yoForm}`,
            `Sí, ${odAlt} ${yoForm}`,
            `Sí, se ${yoForm}`,
        ]);
        return {
            questionPhrase: formal
                ? `¿${cap(verb.forms.el)} usted ${plain.phrase}?`
                : `¿${cap(verb.forms.tu)} ${plain.phrase}?`,
            correctAnswer: `Sí, ${odPron} ${yoForm}`,
            options,
            explanation: {
                ruleId: 'REFLEXIVE_CONTRAST',
                title: 'Regla: la acción cae sobre otro',
                steps: [
                    `${plain.phrase} → ${odPron} (objeto directo)`,
                    'La acción no vuelve al sujeto → OD, no reflexivo',
                ],
                detail: verb.contrast?.note,
            },
        };
    }
    if (r < 0.75) {
        const verb = pick(ctx.bareReflexivePool);
        const yoForm = verb.forms.yo;
        return {
            questionPhrase: `¿Se ${verb.forms.el} usted?`,
            correctAnswer: `Sí, ${REFLEXIVE_PRON.yo} ${yoForm}`,
            options: buildReflexiveOptions().map(p => `Sí, ${p} ${yoForm}`),
            explanation: {
                ruleId: 'PERSON_FLIP',
                title: 'Regla: cambio de persona',
                steps: [
                    'se (usted) → me (respondés por vos mismo)',
                    `Usted se ${verb.forms.el} → Yo me ${yoForm}`,
                ],
                detail: 'La pregunta habla de usted (formal); tu respuesta habla de vos mismo → me.',
            },
        };
    }
    const verb = pick(ctx.bareReflexivePool);
    const yoForm = verb.forms.yo;
    return {
        questionPhrase: `¿Te ${verb.forms.tu}?`,
        correctAnswer: `Sí, ${REFLEXIVE_PRON.yo} ${yoForm}`,
        options: buildReflexiveOptions().map(p => `Sí, ${p} ${yoForm}`),
        explanation: {
            ruleId: 'PERSON_FLIP',
            title: 'Regla: cambio de persona',
            steps: [
                'te (vos) → me (respondés por vos mismo)',
                `Tú te ${verb.forms.tu} → Yo me ${yoForm}`,
            ],
            detail: 'La pregunta habla de vos; tu respuesta habla de vos mismo → me.',
        },
    };
};

// RESPUESTA RÁPIDA en BASE (un solo pronombre):
//  - Reflexivo: diálogos con cambio de persona y de contraste (ver arriba).
//  - OD: diálogo con un OD suelto ("¿Compras el pan?" → "Sí, lo compro"); aquí solo
//    cambia la persona del verbo (tú→yo), sin volteo de pronombre.
const generateQuickResponseSingle = (ctx: GenContext): QuestionData => {
    if (Math.random() < ctx.reflexiveShare) return generateQuickResponseReflexive(ctx);
    const verb = pick(ctx.verbPool);
    const od = pickCompatibleOD(ctx, verb);
    const yoForm = verb.forms.yo;
    return {
        questionPhrase: `¿${cap(verb.forms.tu)} ${od.phrase}?`,
        correctAnswer: `Sí, ${od.pron} ${yoForm}`,
        options: buildSingleOptions().map(p => `Sí, ${p} ${yoForm}`),
        explanation: explainSingleOd(od),
    };
};

export const generateQuickResponse = (ctx: GenContext): QuestionData => {
    if (ctx.singleClitic) return generateQuickResponseSingle(ctx);
    const verb = pick(ctx.verbPool);
    const od = pickCompatibleOD(ctx, verb);
    // Sin volteos ambiguos, y sin OIs que el verbo vete semánticamente.
    const basePool = ctx.oiPool.filter(o => o.phrase !== 'a ti' && o.phrase !== 'a nosotros');
    const compatiblePool = basePool.filter(o => oiCompatible(verb, o));
    const pool = compatiblePool.length ? compatiblePool : basePool;
    const oi = pickOI(ctx, pool.length ? pool : ctx.oiPool.filter(o => o.pron === 'me'));

    // Pregunta con el clítico proclítico: "¿Me traes las llaves?" (sin "a mí"
    // redundante) o "¿Le das el libro a María?" (duplicación estándar del OI).
    const tuForm = verb.forms.tu;
    const questionPhrase = oi.pron === 'me'
        ? `¿Me ${tuForm} ${od.phrase}?`
        : `¿${cap(oi.pron)} ${tuForm} ${od.phrase} ${oi.phrase}?`;

    const flipped = flipOI(oi);
    const cluster = resolverCluster(flipped.pron, od.pron);
    const yoForm = verb.forms.yo;
    const correctAnswer = `Sí, ${cluster} ${yoForm}`;
    const options = buildClusterOptions(flipped.pron, flipped.isThirdPerson, od.pron)
        .map(c => `Sí, ${c} ${yoForm}`);

    const base = oi.pron === 'me'
        ? {
            ruleId: 'PERSON_FLIP' as RuleId,
            title: 'Regla: cambio de persona',
            steps: [
                'me (a mí) → te (ahora respondés vos)',
                odStep(od),
                `Orden: OI + OD → ${cluster}`,
            ],
            detail: 'La pregunta habla de "mí"; tu respuesta habla de la otra persona → te.',
        }
        : explainCluster(oi, od);

    return {
        questionPhrase,
        correctAnswer,
        options,
        explanation: base,
    };
};
