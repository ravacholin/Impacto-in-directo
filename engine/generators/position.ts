// POSICIÓN: colocar el clúster de pronombres en el hueco correcto según el
// disparador verbal. El pronombre correcto es FIJO en todos los huecos; lo único
// que se evalúa es DÓNDE va (proclisis vs. enclisis).

import { type QuestionData, type PositionToken, type RuleId, type Explanation } from '../../types';
import {
    resolverCluster,
    REFLEXIVE_PRON,
    VOCATIVOS,
    APELATIVOS_ORDEN,
    INF_LEADS,
    GER_LEADS,
    REFL_INF_LEADS,
    REFL_GER_LEADS,
    attachEnclitic,
    attachEncliticSingle,
    attachReflexiveEnclitic,
    bareReflexiveInfinitive,
    PERIPHRASES,
    type Verb,
    type EncliticKind,
} from '../pronouns';
import { type GenContext, pick, cap, pickVariedSubject, pickOI } from './common';

const word = (text: string): PositionToken => ({ kind: 'word', text });
const slot = (id: string, valid: boolean, result: string, display: string): PositionToken => ({ kind: 'slot', id, valid, result, display });

const positionExplanation = (ruleId: RuleId, title: string, rule: string): Explanation => ({
    ruleId,
    title,
    steps: [rule],
});

const RULES = {
    conjugado: 'Con un verbo conjugado, el pronombre va DELANTE del verbo.',
    impNeg: 'En el imperativo negativo, el pronombre va DELANTE del verbo.',
    impAff: 'En el imperativo afirmativo, el pronombre se UNE al final del verbo (con tilde).',
    inf: 'Con un infinitivo, el pronombre se UNE al final del verbo.',
    ger: 'Con un gerundio, el pronombre se UNE al final del verbo (con tilde).',
    periph: 'En las perífrasis hay DOS posiciones válidas: delante del verbo conjugado o pegado al infinitivo/gerundio.',
};

// Pronombre a colocar en la actividad de Posición. En BASE (singleClitic) es un
// clítico de OD suelto (lo/la/los/las) con su enclisis simple; en niveles 2/3 es
// el clúster doble OI + OD con la regla "se". `chip` es la forma con espacio que
// se muestra proclítica; `clitics` la forma pegada; `attach` resuelve la enclisis.
interface CliticChoice {
    chip: string;
    clitics: string;
    attach: (kind: EncliticKind, verb: Verb) => string;
}

const pickCliticChoice = (ctx: GenContext): CliticChoice => {
    if (ctx.singleClitic) {
        const od = pick(ctx.odPool);
        return {
            chip: od.pron,
            clitics: od.pron,
            attach: (kind, verb) => attachEncliticSingle(kind, verb, od.pron),
        };
    }
    const od = pick(ctx.odPool);
    const oi = pickOI(ctx);
    const cluster = resolverCluster(oi.pron, od.pron);
    return {
        chip: cluster,
        clitics: cluster.replace(/\s+/g, ''),
        attach: (kind, verb) => attachEnclitic(kind, verb, cluster),
    };
};

const POSITION_CONTEXTS: Array<(ctx: GenContext) => QuestionData> = [
    // 1. Verbo conjugado → proclisis.
    (ctx) => {
        const verb = pick(ctx.verbPool);
        const subject = pickVariedSubject();
        const c = pickCliticChoice(ctx);
        const vf = verb.forms[subject.key];
        return {
            contextLabel: 'VERBO CONJUGADO',
            chip: c.chip,
            tokens: [
                word(subject.pronoun),
                slot('s1', true, `${subject.pronoun} ${c.chip} ${vf}.`, c.chip),
                word(vf),
                slot('s2', false, `${subject.pronoun} ${vf}${c.clitics}.`, c.clitics),
            ],
            correctSlotIds: ['s1'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_PROCLISIS', 'Regla: delante del verbo', RULES.conjugado),
        };
    },
    // 2. Imperativo negativo → proclisis.
    (ctx) => {
        const verb = pick(ctx.verbPool);
        const c = pickCliticChoice(ctx);
        const sj = verb.subjuntivoTu;
        return {
            contextLabel: 'IMPERATIVO NEGATIVO',
            chip: c.chip,
            tokens: [
                word('No'),
                slot('s1', true, `No ${c.chip} ${sj}.`, c.chip),
                word(sj),
                slot('s2', false, `No ${sj}${c.clitics}.`, c.clitics),
            ],
            correctSlotIds: ['s1'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_PROCLISIS', 'Regla: delante del verbo', RULES.impNeg),
        };
    },
    // 3. Imperativo afirmativo → enclisis.
    (ctx) => {
        const verb = pick(ctx.verbPool);
        const c = pickCliticChoice(ctx);
        const voc = pick(VOCATIVOS);
        const ape = pick(APELATIVOS_ORDEN);
        // Imperativo suelto curado a mano: en irregulares NO coincide con la
        // 3ª persona del presente ("di" ≠ "dice"), por eso es dato, no `forms.el`.
        const loose = verb.imperativoTuSolo;
        const enc = c.attach('imp', verb); // enclisis "dáselo"
        return {
            contextLabel: 'IMPERATIVO AFIRMATIVO',
            chip: c.chip,
            tokens: [
                word(`¡${voc},`),
                slot('s1', false, `¡${voc}, ${c.chip} ${loose}, ${ape}!`, c.chip),
                word(loose),
                slot('s2', true, `¡${voc}, ${enc}, ${ape}!`, c.clitics),
                word(`${ape}!`),
            ],
            correctSlotIds: ['s2'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_ENCLISIS', 'Regla: unido al verbo', RULES.impAff),
        };
    },
    // 4. Infinitivo (tras preposición) → enclisis.
    (ctx) => {
        const verb = pick(ctx.verbPool);
        const c = pickCliticChoice(ctx);
        const lead = pick(INF_LEADS);
        const enc = c.attach('inf', verb);
        return {
            contextLabel: 'INFINITIVO',
            chip: c.chip,
            tokens: [
                word(lead),
                slot('s1', false, `${lead} ${c.chip} ${verb.infinitive}.`, c.chip),
                word(verb.infinitive),
                slot('s2', true, `${lead} ${enc}.`, c.clitics),
            ],
            correctSlotIds: ['s2'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_ENCLISIS', 'Regla: unido al verbo', RULES.inf),
        };
    },
    // 5. Gerundio (adverbial) → enclisis.
    (ctx) => {
        const verb = pick(ctx.verbPool);
        const c = pickCliticChoice(ctx);
        const lead = pick(GER_LEADS);
        const enc = c.attach('ger', verb);
        return {
            contextLabel: 'GERUNDIO',
            chip: c.chip,
            tokens: [
                word(lead),
                slot('s1', false, `${lead} ${c.chip} ${verb.gerundio}.`, c.chip),
                word(verb.gerundio),
                slot('s2', true, `${lead} ${enc}.`, c.clitics),
            ],
            correctSlotIds: ['s2'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_ENCLISIS', 'Regla: unido al verbo', RULES.ger),
        };
    },
    // 6. Perífrasis → DOS posiciones válidas.
    (ctx) => {
        const verb = pick(ctx.verbPool);
        const c = pickCliticChoice(ctx);
        const p = pick(PERIPHRASES);
        const nf = p.kind === 'ger' ? verb.gerundio : verb.infinitive;
        const preCap = cap(p.pre);
        const enc = c.attach(p.kind, verb);
        return {
            contextLabel: 'PERÍFRASIS',
            chip: c.chip,
            tokens: [
                slot('s1', true, `${cap(c.chip)} ${p.pre} ${nf}.`, c.chip),
                word(preCap),
                slot('s2', false, `${preCap} ${c.chip} ${nf}.`, c.chip),
                word(nf),
                slot('s3', true, `${preCap} ${enc}.`, c.clitics),
            ],
            correctSlotIds: ['s1', 's3'],
            acceptsMultiple: true,
            explanation: positionExplanation('POSITION_PERIPHRASIS', 'Regla: dos posiciones válidas', RULES.periph),
        };
    },
];

// Variantes REFLEXIVAS de los contextos de POSICIÓN que practica BASE (0/3/4:
// verbo conjugado, infinitivo y gerundio). El clítico es un reflexivo suelto
// (me/te/se/nos) en vez de un OD; lo que se evalúa sigue siendo la COLOCACIÓN
// (proclisis vs. enclisis), por eso reutilizan las mismas reglas POSITION_*.
// Los reflexivos son contenido EXCLUSIVO de BASE (ver `reflexivePositionShare`
// en common.ts), y BASE no incluye imperativos ni perífrasis, así que esas
// variantes reflexivas no existen: no se practican reflexivos en niveles 2/3.
const REFLEXIVE_POSITION_CONTEXTS: Record<number, (ctx: GenContext) => QuestionData> = {
    // 0. Verbo conjugado → proclisis. El pronombre concuerda con el sujeto.
    0: (ctx) => {
        const verb = pick(ctx.bareReflexivePool);
        const subject = pickVariedSubject();
        const pron = REFLEXIVE_PRON[subject.key];
        const vf = verb.forms[subject.key];
        return {
            contextLabel: 'VERBO CONJUGADO',
            chip: pron,
            tokens: [
                word(subject.pronoun),
                slot('s1', true, `${subject.pronoun} ${pron} ${vf}.`, pron),
                word(vf),
                slot('s2', false, `${subject.pronoun} ${vf}${pron}.`, pron),
            ],
            correctSlotIds: ['s1'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_PROCLISIS', 'Regla: delante del verbo', RULES.conjugado),
        };
    },
    // 3. Infinitivo (tras preposición) → enclisis. El lead implica 3ª persona → "se".
    3: (ctx) => {
        const verb = pick(ctx.bareReflexivePool);
        const pron = REFLEXIVE_PRON.el; // "se"
        const lead = pick(REFL_INF_LEADS);
        const bare = bareReflexiveInfinitive(verb.infinitive);
        const enc = attachReflexiveEnclitic('inf', verb, pron); // "levantarse"
        return {
            contextLabel: 'INFINITIVO',
            chip: pron,
            tokens: [
                word(lead),
                slot('s1', false, `${lead} ${pron} ${bare}.`, pron),
                word(bare),
                slot('s2', true, `${lead} ${enc}.`, pron),
            ],
            correctSlotIds: ['s2'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_ENCLISIS', 'Regla: unido al verbo', RULES.inf),
        };
    },
    // 4. Gerundio (adverbial) → enclisis. El lead implica 3ª persona → "se".
    4: (ctx) => {
        const verb = pick(ctx.bareReflexivePool);
        const pron = REFLEXIVE_PRON.el; // "se"
        const lead = pick(REFL_GER_LEADS);
        const enc = attachReflexiveEnclitic('ger', verb, pron); // "levantándose"
        return {
            contextLabel: 'GERUNDIO',
            chip: pron,
            tokens: [
                word(lead),
                slot('s1', false, `${lead} ${pron} ${verb.gerundio}.`, pron),
                word(verb.gerundio),
                slot('s2', true, `${lead} ${enc}.`, pron),
            ],
            correctSlotIds: ['s2'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_ENCLISIS', 'Regla: unido al verbo', RULES.ger),
        };
    },
};

// Regla asociada a cada contexto de posición (para el sesgo adaptativo).
const POSITION_CONTEXT_RULES: RuleId[] = [
    'POSITION_PROCLISIS',
    'POSITION_PROCLISIS',
    'POSITION_ENCLISIS',
    'POSITION_ENCLISIS',
    'POSITION_ENCLISIS',
    'POSITION_PERIPHRASIS',
];

export const generatePronounPosition = (ctx: GenContext): QuestionData => {
    // Lotería ponderada: los contextos cuya regla está débil pesan 3:1, siempre
    // dentro de los contextos que permite la dificultad.
    const weighted: number[] = [];
    for (const idx of ctx.positionIndices) {
        const weight = ctx.weakRules.includes(POSITION_CONTEXT_RULES[idx]) ? 3 : 1;
        for (let i = 0; i < weight; i++) weighted.push(idx);
    }
    const idx = pick(weighted);
    // Una parte de las preguntas practica reflexivos en el mismo contexto
    // sintáctico (clítico reflexivo suelto). Ocurre en TODOS los niveles: los
    // índices permitidos ya restringen imperativos (nivel 2) y perífrasis (3).
    const reflexiveContext = REFLEXIVE_POSITION_CONTEXTS[idx];
    if (reflexiveContext && Math.random() < ctx.reflexivePositionShare) {
        return reflexiveContext(ctx);
    }
    return POSITION_CONTEXTS[idx](ctx);
};
