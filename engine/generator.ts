// Generador procedural de ejercicios.
//
// A partir de los bancos de palabras y la regla de combinación (`pronouns.ts`),
// construye ejercicios correctos y variados para cada tipo. Todo es local y
// determinista en cuanto a corrección (sin IA, sin red); la variedad proviene del
// muestreo aleatorio sobre el enorme espacio combinatorio verbos × OD × OI × sujetos.
//
// Cada pregunta lleva una `explanation` estructurada (regla + pasos) que la UI
// muestra en el feedback, y cuyo `ruleId` alimenta el seguimiento adaptativo.

import { Difficulty, ExerciseType, Explanation, QuestionData, PositionToken, RuleId } from '../types';
import { normalize, shuffle } from '../utils';
import {
    VERBS,
    SUBJECTS,
    DIRECT_OBJECTS,
    INDIRECT_OBJECTS,
    DIRECT_PRONOUNS,
    INDIRECT_PRONOUNS,
    REFLEXIVE_PRON,
    REFLEXIVE_PRONOUNS,
    REFLEXIVE_VERBS,
    resolverCluster,
    compatibleObjects,
    corefiere,
    attachEnclitic,
    attachEncliticSingle,
    PERIPHRASES,
    type Verb,
    type Subject,
    type DirectObject,
    type IndirectObject,
    type DirectPronoun,
    type IndirectPronoun,
    type EncliticKind,
} from './pronouns';

// --- Utilidades aleatorias ---
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Clave para deduplicar opciones/preguntas (minúsculas, solo letras).
const key = normalize;

const cap = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const ADVERBIALS = [
    'Rápidamente,',
    'Ayer',
    'Esta mañana',
    'Sin dudarlo,',
    'Con mucho cuidado,',
    'Más tarde',
    'Por fin',
    'En la oficina,',
];

// --- Contexto de generación (dificultad + sesgo adaptativo) ---
//
// Nivel 1 (BASE): un SOLO pronombre, directo (lo/la/los/las) o reflexivo
// (me/te/se/nos). Sin indirectos, sin dobles y sin "se". Los módulos de doble
// quedan bloqueados en la UI (ver constants.tsx); Pop-up y Posición usan un
// clítico suelto. Solo los contextos de posición sin imperativos.
// Nivel 2 (DOBLE): comportamiento completo salvo perífrasis.
// Nivel 3 (TOTAL): todo, incluidas perífrasis.
export interface GenOptions {
    difficulty?: Difficulty;
    weakRules?: RuleId[];
}

interface GenContext {
    oiPool: IndirectObject[];
    // Índices permitidos dentro de POSITION_CONTEXTS.
    positionIndices: number[];
    // Proporción de preguntas de un solo pronombre en Pop-up (1 = siempre single).
    singleOdShare: number;
    // Dentro de una pregunta single, probabilidad de que sea reflexiva (vs OD).
    reflexiveShare: number;
    // Si true, Posición coloca un clítico suelto (OD) en vez de un clúster doble.
    singleClitic: boolean;
    // Probabilidad de forzar un OI de 3ª persona (sesgo hacia "se").
    thirdPersonBias: number;
    weakRules: RuleId[];
}

const POSITION_INDICES_BY_LEVEL: Record<Difficulty, number[]> = {
    1: [0, 3, 4],          // conjugado, infinitivo, gerundio
    2: [0, 1, 2, 3, 4],    // + imperativos
    3: [0, 1, 2, 3, 4, 5], // + perífrasis
};

const buildContext = ({ difficulty = 2, weakRules = [] }: GenOptions): GenContext => {
    const isBase = difficulty === 1;
    const oiPool = isBase ? INDIRECT_OBJECTS.filter(o => !o.isThirdPerson) : [...INDIRECT_OBJECTS];
    // BASE: siempre un solo pronombre. Niveles 2/3: mayoría de dobles.
    let singleOdShare = isBase ? 1 : 0.35;
    let thirdPersonBias = 0;
    // Sesgos adaptativos: solo empujan donde ya existe una elección aleatoria.
    if (weakRules.includes('SE_TRANSFORM') && difficulty > 1) thirdPersonBias = 0.6;
    if (weakRules.includes('OD_AGREEMENT') && !isBase) singleOdShare = Math.min(0.9, singleOdShare + 0.2);
    return {
        oiPool,
        positionIndices: POSITION_INDICES_BY_LEVEL[difficulty],
        singleOdShare,
        reflexiveShare: isBase ? 0.4 : 0,
        singleClitic: isBase,
        thirdPersonBias,
        weakRules,
    };
};

// OI muestreado del pool del contexto, aplicando el sesgo hacia 3ª persona.
const pickOI = (ctx: GenContext, pool: IndirectObject[] = ctx.oiPool): IndirectObject => {
    if (ctx.thirdPersonBias > 0 && Math.random() < ctx.thirdPersonBias) {
        const third = pool.filter(o => o.isThirdPerson);
        if (third.length) return pick(third);
    }
    return pick(pool);
};

// --- Explicaciones didácticas ---

const OD_LABELS: Record<DirectPronoun, string> = {
    lo: 'masc. singular',
    la: 'fem. singular',
    los: 'masc. plural',
    las: 'fem. plural',
};

const odStep = (od: DirectObject): string => `${od.phrase} → ${od.pron} (${OD_LABELS[od.pron]})`;

// Explicación de un clúster doble OI + OD. Es la explicación base de casi todas
// las actividades; la regla principal depende de si se dispara "le/les → se".
const explainCluster = (oi: IndirectObject, od: DirectObject): Explanation => {
    const cluster = resolverCluster(oi.pron, od.pron);
    if (oi.isThirdPerson) {
        return {
            ruleId: 'SE_TRANSFORM',
            title: 'Regla: le/les → se',
            steps: [
                odStep(od),
                `${oi.phrase} → ${oi.pron} → se (delante de ${od.pron})`,
                `Orden: OI + OD → ${cluster}`,
            ],
            detail: `"${oi.pron} ${od.pron}" suena mal: cuando le/les va seguido de lo/la/los/las, se convierte en "se".`,
        };
    }
    return {
        ruleId: 'CLITIC_ORDER',
        title: 'Regla: OI antes de OD',
        steps: [
            odStep(od),
            `${oi.phrase} → ${oi.pron}`,
            `Orden: OI + OD → ${cluster}`,
        ],
        detail: 'El pronombre de persona (OI) siempre va antes que el de cosa (OD).',
    };
};

const explainSingleOd = (od: DirectObject): Explanation => ({
    ruleId: 'OD_AGREEMENT',
    title: 'Regla: concordancia del OD',
    steps: [odStep(od)],
    detail: 'El pronombre concuerda en género y número con el objeto que reemplaza.',
});

const explainReflexive = (subject: Subject, pron: string): Explanation => ({
    ruleId: 'REFLEXIVE',
    title: 'Regla: pronombre reflexivo',
    steps: [`${subject.pronoun} → ${pron}`],
    detail: 'En los verbos reflexivos la acción recae sobre el mismo sujeto: cada persona lleva su pronombre (me, te, se, nos).',
});

// --- Construcción de distractores ---

// Distractores para un clúster de DOS pronombres (OI + OD), p.ej. "se lo".
// Garantiza opciones del mismo número de palabras (homogéneas) e incluye el error
// clásico "le lo" cuando aplica. Trabaja sobre pronombres sueltos para poder
// reutilizarse con pronombres "volteados" (Respuesta Rápida).
const buildClusterOptions = (oiPron: IndirectPronoun, isThirdPerson: boolean, odPron: DirectPronoun): string[] => {
    const correct = resolverCluster(oiPron, odPron);
    const oiResolved = isThirdPerson ? 'se' : oiPron;

    const candidates: string[] = [];
    // Variar el OD manteniendo el OI.
    for (const odAlt of DIRECT_PRONOUNS) candidates.push(`${oiResolved} ${odAlt}`);
    // Variar el OI manteniendo el OD.
    for (const oiAlt of INDIRECT_PRONOUNS) {
        const r = oiAlt === 'le' || oiAlt === 'les' ? 'se' : oiAlt;
        candidates.push(`${r} ${odPron}`);
    }
    // Error clásico de cacofonía: "le lo" / "les lo" sin aplicar la regla "se".
    if (isThirdPerson) candidates.push(`${oiPron} ${odPron}`);

    const correctKey = key(correct);
    const seen = new Set<string>([correctKey]);
    const distractors: string[] = [];
    for (const c of shuffle(candidates)) {
        const k = key(c);
        if (seen.has(k)) continue;
        seen.add(k);
        distractors.push(c);
        if (distractors.length === 3) break;
    }

    return shuffle([correct, ...distractors]);
};

const buildDoubleOptions = (oi: IndirectObject, od: DirectObject): string[] =>
    buildClusterOptions(oi.pron, oi.isThirdPerson, od.pron);

// Distractores para UN solo pronombre de OD: las cuatro formas lo/la/los/las.
const buildSingleOptions = (): string[] => shuffle([...DIRECT_PRONOUNS]);

// Distractores para un pronombre reflexivo: las cuatro formas me/te/se/nos.
const buildReflexiveOptions = (): string[] => shuffle([...REFLEXIVE_PRONOUNS]);

// --- Generadores por tipo ---

// Elige un sujeto y decide si mostrarlo explícito (más variedad de frases).
const pickSubject = (): { subject: Subject; showPronoun: boolean } => {
    const subject = pick(SUBJECTS);
    const showPronoun = subject.key !== 'yo' && subject.key !== 'tu' && Math.random() < 0.5;
    return { subject, showPronoun };
};

interface DoubleCombo {
    verb: Verb;
    subject: Subject;
    showPronoun: boolean;
    od: DirectObject;
    oi: IndirectObject;
    verbForm: string;
}

const pickDoubleCombo = (ctx: GenContext, thirdPersonOnly = false): DoubleCombo => {
    const verb = pick(VERBS);
    const { subject, showPronoun } = pickSubject();
    // OD compatible con el verbo (evita "cantar el coche").
    const od = pick(compatibleObjects(verb));
    // OI que no correfiera con el sujeto (evita "Él … a él"). El Detector exige
    // 3ª persona siempre (su foco ES la regla "le → se"), sin importar el nivel.
    const basePool = thirdPersonOnly ? INDIRECT_OBJECTS.filter(o => o.isThirdPerson) : ctx.oiPool;
    const oiPool = basePool.filter(o => !corefiere(subject.key, o));
    const oi = pickOI(ctx, oiPool.length ? oiPool : basePool);
    return { verb, subject, showPronoun, od, oi, verbForm: verb.forms[subject.key] };
};

// Frase con verbo + OD + OI: "Doy el libro a Juan" / "Él da el libro a Juan".
const buildSentence = (c: DoubleCombo): string => {
    const head = c.showPronoun ? `${c.subject.pronoun} ${c.verbForm}` : cap(c.verbForm);
    return `${head} ${c.od.phrase} ${c.oi.phrase}`;
};

// Reflejo temporal para ambientar la frase reflexiva ("Todas las mañanas…").
const REFLEXIVE_LEADS = ['Todas las mañanas', 'Cada día', 'Por la noche', 'Los domingos', 'Antes de salir'];

// POP-UP reflexivo: reconocer el pronombre que corresponde al sujeto.
const generateReflexivePopUp = (): QuestionData => {
    const verb = pick(REFLEXIVE_VERBS);
    const subject = pick(SUBJECTS);
    const pron = REFLEXIVE_PRON[subject.key];
    const lead = pick(REFLEXIVE_LEADS);
    return {
        phrase: `${lead}, ${subject.pronoun.toLowerCase()} ___ ${verb.forms[subject.key]}.`,
        correctAnswer: pron,
        options: buildReflexiveOptions(),
        explanation: explainReflexive(subject, pron),
    };
};

// POP-UP: mezcla de preguntas de uno y dos objetos (single directo o reflexivo).
const generatePopUp = (ctx: GenContext): QuestionData => {
    const isDouble = Math.random() >= ctx.singleOdShare;
    if (isDouble) {
        const c = pickDoubleCombo(ctx);
        return {
            phrase: buildSentence(c),
            correctAnswer: resolverCluster(c.oi.pron, c.od.pron),
            options: buildDoubleOptions(c.oi, c.od),
            explanation: explainCluster(c.oi, c.od),
        };
    }
    // Single reflexivo.
    if (Math.random() < ctx.reflexiveShare) return generateReflexivePopUp();
    // Single OD.
    const verb = pick(VERBS);
    const { subject, showPronoun } = pickSubject();
    const od = pick(compatibleObjects(verb));
    const verbForm = verb.forms[subject.key];
    const head = showPronoun ? `${subject.pronoun} ${verbForm}` : cap(verbForm);
    return {
        phrase: `${head} ${od.phrase}`,
        correctAnswer: od.pron,
        options: buildSingleOptions(),
        explanation: explainSingleOd(od),
    };
};

// INTERFERENCIA: siempre doble objeto + un distractor textual (adverbio/contexto).
const generateInterference = (ctx: GenContext): QuestionData => {
    const c = pickDoubleCombo(ctx);
    const adverbial = pick(ADVERBIALS);
    const sentence = buildSentence(c);
    // El adverbial va al frente; el resto de la frase en minúscula inicial.
    const phrase = `${adverbial} ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
    return {
        phrase,
        correctAnswer: resolverCluster(c.oi.pron, c.od.pron),
        options: buildDoubleOptions(c.oi, c.od),
        explanation: explainCluster(c.oi, c.od),
    };
};

// CORTO CIRCUITO: dos entradas (persona + objeto) → clúster.
const generateShortCircuit = (ctx: GenContext): QuestionData => {
    const od = pick(DIRECT_OBJECTS);
    const oi = pickOI(ctx);
    return {
        person: oi.phrase,
        object: od.phrase,
        correctAnswer: resolverCluster(oi.pron, od.pron),
        options: buildDoubleOptions(oi, od),
        explanation: explainCluster(oi, od),
    };
};

// SWITCH INSTANTÁNEO: transformar la frase completa a su versión con pronombres.
const generateInstantSwitch = (ctx: GenContext): QuestionData => {
    const c = pickDoubleCombo(ctx);
    const cluster = resolverCluster(c.oi.pron, c.od.pron);
    const transformed = `${cap(cluster)} ${c.verbForm}.`;
    // Variantes válidas: con y sin sujeto explícito (la normalización ignora
    // espacios, mayúsculas y puntuación, así que basta con cubrir el sujeto).
    const accepted = [
        `${cluster} ${c.verbForm}`,
        `${c.subject.pronoun} ${cluster} ${c.verbForm}`,
    ];
    return {
        initialPhrase: `${buildSentence(c)}.`,
        transformedPhrase: transformed,
        acceptedAnswers: accepted,
        explanation: explainCluster(c.oi, c.od),
    };
};

// DETECTOR: elegir la forma pronominal correcta entre errores clásicos.
// Se restringe a OI de 3ª persona para que el foco sea la regla "le → se".
const generateDetector = (ctx: GenContext): QuestionData => {
    const c = pickDoubleCombo(ctx, true);
    const cluster = resolverCluster(c.oi.pron, c.od.pron); // "se lo"
    const correct = `${cap(cluster)} ${c.verbForm}`;

    const options = new Set<string>([correct]);
    // Error A: cacofonía "le/les + lo" sin aplicar "se".
    options.add(`${cap(`${c.oi.pron} ${c.od.pron}`)} ${c.verbForm}`);
    // Error B: concordancia incorrecta del OD.
    const odAlt = pick(DIRECT_PRONOUNS.filter(p => p !== c.od.pron) as DirectPronoun[]);
    options.add(`${cap(`se ${odAlt}`)} ${c.verbForm}`);
    // Error C: orden invertido de los clíticos.
    options.add(`${cap(`${c.od.pron} se`)} ${c.verbForm}`);

    const explanation = explainCluster(c.oi, c.od);
    return {
        prompt: `${buildSentence(c)}.`,
        options: shuffle(Array.from(options)),
        correctAnswers: [correct],
        explanation: {
            ...explanation,
            detail: `"${c.oi.pron} ${c.od.pron}" es el error clásico: le/les nunca va junto a lo/la/los/las — se convierte en "se".`,
        },
    };
};

// RESPUESTA RÁPIDA: pregunta dirigida a "tú", respuesta en primera persona.
// Ejercita el clúster completo MÁS el cambio de persona: "¿Me traes las llaves?"
// → "Sí, te las traigo". Se excluyen "a ti" y "a nosotros" del pool porque su
// volteo es ambiguo; quedan "a mí" (→ te) y las terceras personas (→ se).
const flipOI = (oi: IndirectObject): { pron: IndirectPronoun; isThirdPerson: boolean } =>
    oi.pron === 'me' ? { pron: 'te', isThirdPerson: false } : { pron: oi.pron, isThirdPerson: oi.isThirdPerson };

const generateQuickResponse = (ctx: GenContext): QuestionData => {
    const verb = pick(VERBS);
    const od = pick(compatibleObjects(verb));
    const pool = ctx.oiPool.filter(o => o.phrase !== 'a ti' && o.phrase !== 'a nosotros');
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

// POSICIÓN: colocar el clúster de pronombres en el hueco correcto según el
// disparador verbal. El pronombre correcto es FIJO en todos los huecos; lo único
// que se evalúa es DÓNDE va (proclisis vs. enclisis).
const word = (text: string): PositionToken => ({ kind: 'word', text });
const slot = (id: string, valid: boolean, result: string, display: string): PositionToken => ({ kind: 'slot', id, valid, result, display });

const INF_LEADS = ['Viene para', 'Trabaja para', 'Estudia para', 'Ahorra para', 'Lucha para'];
const GER_LEADS = ['Salió de casa', 'Pasó la tarde', 'Llegó a la oficina', 'Volvió al pueblo'];

// Para el imperativo afirmativo: vocativo (destinatario nombrado) + apelativo de
// orden/ruego. Juntos fuerzan la lectura imperativa y descartan el presente de
// indicativo exclamativo (que comparte la misma forma verbal en verbos regulares).
const VOCATIVOS = ['Ana', 'Pedro', 'Marta', 'Luis', 'Sofía', 'Carlos', 'Lucía'];
const APELATIVOS_ORDEN = ['por favor', 'te lo pido', 'hazme el favor'];

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
        const od = pick(DIRECT_OBJECTS);
        return {
            chip: od.pron,
            clitics: od.pron,
            attach: (kind, verb) => attachEncliticSingle(kind, verb, od.pron),
        };
    }
    const od = pick(DIRECT_OBJECTS);
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
        const verb = pick(VERBS);
        const subject = pick(SUBJECTS);
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
        const verb = pick(VERBS);
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
        const verb = pick(VERBS);
        const c = pickCliticChoice(ctx);
        const voc = pick(VOCATIVOS);
        const ape = pick(APELATIVOS_ORDEN);
        const loose = verb.forms.el; // forma suelta "da" (minúscula, sigue al vocativo)
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
        const verb = pick(VERBS);
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
        const verb = pick(VERBS);
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
        const verb = pick(VERBS);
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

// Regla asociada a cada contexto de posición (para el sesgo adaptativo).
const POSITION_CONTEXT_RULES: RuleId[] = [
    'POSITION_PROCLISIS',
    'POSITION_PROCLISIS',
    'POSITION_ENCLISIS',
    'POSITION_ENCLISIS',
    'POSITION_ENCLISIS',
    'POSITION_PERIPHRASIS',
];

const generatePronounPosition = (ctx: GenContext): QuestionData => {
    // Lotería ponderada: los contextos cuya regla está débil pesan 3:1, siempre
    // dentro de los contextos que permite la dificultad.
    const weighted: number[] = [];
    for (const idx of ctx.positionIndices) {
        const weight = ctx.weakRules.includes(POSITION_CONTEXT_RULES[idx]) ? 3 : 1;
        for (let i = 0; i < weight; i++) weighted.push(idx);
    }
    return POSITION_CONTEXTS[pick(weighted)](ctx);
};

const GENERATORS: Record<ExerciseType, (ctx: GenContext) => QuestionData> = {
    [ExerciseType.POP_UP_PRONOUN]: generatePopUp,
    [ExerciseType.INTERFERENCE]: generateInterference,
    [ExerciseType.SHORT_CIRCUIT]: generateShortCircuit,
    [ExerciseType.INSTANT_SWITCH]: generateInstantSwitch,
    [ExerciseType.DETECTOR]: generateDetector,
    [ExerciseType.PRONOUN_POSITION]: generatePronounPosition,
    [ExerciseType.QUICK_RESPONSE]: generateQuickResponse,
};

// Genera un lote de preguntas únicas (evita repetir el mismo enunciado).
export const generateBatch = (type: ExerciseType, count: number, options: GenOptions = {}): QuestionData[] => {
    const generate = GENERATORS[type];
    if (!generate) throw new Error(`Exercise type "${type}" not supported.`);

    const ctx = buildContext(options);
    const questions: QuestionData[] = [];
    const seen = new Set<string>();
    let attempts = 0;
    const maxAttempts = count * 30;

    while (questions.length < count && attempts < maxAttempts) {
        attempts++;
        const q = generate(ctx);
        const k = key(JSON.stringify(q));
        if (seen.has(k)) continue;
        seen.add(k);
        questions.push(q);
    }

    // En el caso (improbable) de que no se alcance el cupo único, se completa
    // permitiendo repeticiones para no devolver un lote vacío.
    while (questions.length < count) questions.push(generate(ctx));

    return questions;
};
