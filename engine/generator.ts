// Generador procedural de ejercicios.
//
// A partir de los bancos de palabras y la regla de combinación (`pronouns.ts`),
// construye ejercicios correctos y variados para cada tipo. Todo es local y
// determinista en cuanto a corrección (sin IA, sin red); la variedad proviene del
// muestreo aleatorio sobre el enorme espacio combinatorio verbos × OD × OI × sujetos.
//
// Cada pregunta lleva una `explanation` estructurada (regla + pasos) que la UI
// muestra en el feedback, y cuyo `ruleId` alimenta el seguimiento adaptativo.

import { Difficulty, ExerciseType, Explanation, QuestionData, PositionToken, RuleId, PopUpPronounQuestion } from '../types';
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
    BARE_REFLEXIVE_VERBS,
    resolverCluster,
    compatibleObjects,
    corefiere,
    attachEnclitic,
    attachEncliticSingle,
    attachReflexiveEnclitic,
    bareReflexiveInfinitive,
    PERIPHRASES,
    type Verb,
    type Subject,
    type SubjectKey,
    type DirectObject,
    type IndirectObject,
    type DirectPronoun,
    type IndirectPronoun,
    type EncliticKind,
    type ReflexiveVerb,
    type ReflexivePronoun,
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
// Nivel 2 (INTERMEDIO): siempre clúster doble (OI+OD), salvo perífrasis.
// Nivel 3 (AVANZADO): siempre clúster doble, incluidas perífrasis.
// El pronombre único es un ejercicio exclusivo de BASE: en Intermedio/Avanzado nunca
// se genera una pregunta de un solo pronombre, ni siquiera por sesgo adaptativo.
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
    // Probabilidad de que una pregunta de Posición use la variante reflexiva del
    // contexto elegido (los reflexivos se practican en TODOS los niveles aquí).
    reflexivePositionShare: number;
    // Probabilidad de que el Detector genere errores reflexivos en vez de "le → se".
    reflexiveDetectorShare: number;
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

// Sub-habilidades reflexivas rastreadas por el SRS: si alguna está débil, el
// generador sube la cuota de preguntas reflexivas donde ya existe esa elección.
const REFLEXIVE_RULES: RuleId[] = ['REFLEXIVE', 'REFLEXIVE_CONTRAST', 'REFLEXIVE_BODY'];

const buildContext = ({ difficulty = 2, weakRules = [] }: GenOptions): GenContext => {
    const isBase = difficulty === 1;
    const oiPool = isBase ? INDIRECT_OBJECTS.filter(o => !o.isThirdPerson) : [...INDIRECT_OBJECTS];
    // BASE: siempre un solo pronombre. Niveles 2/3: siempre doble (el pronombre
    // único queda reservado a BASE, sin excepciones ni sesgo adaptativo).
    const singleOdShare = isBase ? 1 : 0;
    let thirdPersonBias = 0;
    // Sesgos adaptativos: solo empujan donde ya existe una elección aleatoria.
    if (weakRules.includes('SE_TRANSFORM') && difficulty > 1) thirdPersonBias = 0.6;
    const reflexiveWeak = weakRules.some(r => REFLEXIVE_RULES.includes(r));
    return {
        oiPool,
        positionIndices: POSITION_INDICES_BY_LEVEL[difficulty],
        singleOdShare,
        reflexiveShare: isBase ? (reflexiveWeak ? 0.55 : 0.4) : 0,
        // Posición y Detector mantienen viva la práctica reflexiva en los niveles
        // 2/3 (imperativos y perífrasis), donde los módulos de clúster son
        // exclusivamente dobles.
        reflexivePositionShare: isBase ? 0.4 : reflexiveWeak ? 0.35 : 0.25,
        reflexiveDetectorShare: isBase ? 1 : reflexiveWeak ? 0.4 : 0.25,
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

const explainReflexive = (subject: Subject, verb: ReflexiveVerb, pron: ReflexivePronoun): Explanation => ({
    ruleId: 'REFLEXIVE',
    title: 'Regla: pronombre reflexivo',
    steps: [
        `${verb.infinitive}: la acción recae sobre el propio sujeto`,
        `El pronombre copia la persona del sujeto: ${subject.pronoun} → ${pron}`,
        'yo → me · tú → te · él/ella/ellos → se · nosotros → nos',
    ],
    detail: 'El error clásico es usar «se» para todo: solo él/ella/ellos llevan «se»; cada persona tiene SU pronombre.',
});

// Contraste reflexivo / no reflexivo del mismo verbo: la explicación depende de
// la polaridad de la frase generada. La nota didáctica curada del verbo cierra
// el feedback con el contraste completo.
const explainReflexiveContrast = (verb: ReflexiveVerb, subject: Subject, isReflexive: boolean, cue: string): Explanation => {
    const pron = REFLEXIVE_PRON[subject.key];
    if (isReflexive) {
        return {
            ruleId: 'REFLEXIVE_CONTRAST',
            title: 'Regla: la acción vuelve al sujeto',
            steps: [
                `${verb.infinitive} ${cue}: el sujeto se lo hace a sí mismo`,
                `${subject.pronoun} → ${pron}`,
            ],
            detail: verb.contrast?.note,
        };
    }
    return {
        ruleId: 'REFLEXIVE_CONTRAST',
        title: 'Regla: la acción cae sobre otro',
        steps: [
            `${bareReflexiveInfinitive(verb.infinitive)} ${cue}: hay OTRO destinatario u objeto`,
            'La acción no vuelve al sujeto → sin pronombre reflexivo',
        ],
        detail: verb.contrast?.note,
    };
};

const explainReflexiveBody = (verb: ReflexiveVerb, subject: Subject, bodyPart: string, possessive: string): Explanation => {
    const pron = REFLEXIVE_PRON[subject.key];
    const article = bodyPart.split(' ')[0];
    return {
        ruleId: 'REFLEXIVE_BODY',
        title: 'Regla: artículo con partes del cuerpo',
        steps: [
            `${verb.infinitive} + ${bodyPart}`,
            'El pronombre reflexivo ya dice de quién es el cuerpo',
            `→ artículo «${article}», nunca posesivo («${possessive}»)`,
        ],
        detail: `Se dice «${pron} ${verb.forms[subject.key]} ${bodyPart}», no «…${possessive} ${bodyPart.split(' ').slice(1).join(' ')}»: con reflexivo, las partes del cuerpo llevan artículo.`,
    };
};

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

// POP-UP reflexivo: reconocer el pronombre que corresponde al sujeto. `leadPrefix`
// es el texto de ambientación antes del sujeto (Pop-up usa un contexto de rutina;
// Interferencia le pasa un adverbial distractor). Termina donde empieza el sujeto.
const generateReflexivePopUp = (leadPrefix: string = `${pick(REFLEXIVE_LEADS)}, `): PopUpPronounQuestion => {
    const verb = pick(BARE_REFLEXIVE_VERBS);
    const subject = pick(SUBJECTS);
    const pron = REFLEXIVE_PRON[subject.key];
    return {
        phrase: `${leadPrefix}${subject.pronoun.toLowerCase()} ___ ${verb.forms[subject.key]}.`,
        correctAnswer: pron,
        options: buildReflexiveOptions(),
        explanation: explainReflexive(subject, verb, pron),
    };
};

// Opción "hueco vacío" del contraste reflexivo/no reflexivo. Sin espacios: las
// respuestas de nivel BASE son siempre de un solo token (invariante testeado), y
// `normalize` la reduce a "nada", que no colisiona con ningún pronombre.
export const NO_PRONOUN = '(nada)';

// Posesivos por persona para fabricar el error clásico «me lavo MIS manos».
// "nosotros" queda fuera: su posesivo concuerda en género (nuestras/nuestros) y
// complicaría los distractores sin sumar valor didáctico.
type PossessiveKey = Exclude<SubjectKey, 'nosotros'>;
const POSSESSIVES: Record<PossessiveKey, { sing: string; plur: string }> = {
    yo: { sing: 'mi', plur: 'mis' },
    tu: { sing: 'tu', plur: 'tus' },
    el: { sing: 'su', plur: 'sus' },
    ellos: { sing: 'su', plur: 'sus' },
};

const BODY_SUBJECTS = SUBJECTS.filter(s => s.key !== 'nosotros');
const ARTICLES = ['el', 'la', 'los', 'las'];

const CONTRAST_VERBS = REFLEXIVE_VERBS.filter(v => v.contrast);
const BODY_VERBS = REFLEXIVE_VERBS.filter(v => v.bodyParts?.length);

// POP-UP de contraste: ¿la acción vuelve al sujeto o cae sobre otro? La misma
// plantilla genera las dos polaridades: "Yo ___ despierto a las siete." → me
// (reflexiva) y "Yo ___ despierto a mi hermano." → (nada) (no reflexiva).
const generateReflexiveContrastPopUp = (leadPrefix: string = ''): PopUpPronounQuestion => {
    const verb = pick(CONTRAST_VERBS);
    const subject = pick(SUBJECTS);
    const isReflexive = Math.random() < 0.5;
    const cue = isReflexive ? verb.contrast!.reflexiveCue : pick(verb.contrast!.plain).phrase;
    const pron = REFLEXIVE_PRON[subject.key];
    // Siempre están (nada) y el reflexivo del sujeto: la decisión es genuina en
    // ambas polaridades; se completan con otros dos reflexivos.
    const others = shuffle(REFLEXIVE_PRONOUNS.filter(p => p !== pron)).slice(0, 2);
    const subjText = leadPrefix ? subject.pronoun.toLowerCase() : subject.pronoun;
    return {
        phrase: `${leadPrefix}${subjText} ___ ${verb.forms[subject.key]} ${cue}.`,
        correctAnswer: isReflexive ? pron : NO_PRONOUN,
        options: shuffle([NO_PRONOUN, pron, ...others]),
        explanation: explainReflexiveContrast(verb, subject, isReflexive, cue),
    };
};

// POP-UP de partes del cuerpo: con reflexivo, la parte lleva ARTÍCULO, no
// posesivo ("Yo me lavo ___ manos." → las, no "mis"). Los distractores son el
// posesivo de la persona (el error clásico) y formas con género/número cambiado.
const generateReflexiveBodyPopUp = (leadPrefix: string = ''): PopUpPronounQuestion => {
    const verb = pick(BODY_VERBS);
    const subject = pick(BODY_SUBJECTS);
    const pron = REFLEXIVE_PRON[subject.key];
    const bodyPart = pick(verb.bodyParts!);
    const [article, ...nounParts] = bodyPart.split(' ');
    const noun = nounParts.join(' ');
    const isPlural = article === 'los' || article === 'las';
    const poss = POSSESSIVES[subject.key as PossessiveKey];
    const rightNumberPoss = isPlural ? poss.plur : poss.sing;
    const wrongNumberPoss = isPlural ? poss.sing : poss.plur;
    const wrongArticle = pick(ARTICLES.filter(a => a !== article));
    const subjText = leadPrefix ? subject.pronoun.toLowerCase() : subject.pronoun;
    return {
        phrase: `${leadPrefix}${subjText} ${pron} ${verb.forms[subject.key]} ___ ${noun}.`,
        correctAnswer: article,
        options: shuffle([article, rightNumberPoss, wrongArticle, wrongNumberPoss]),
        explanation: explainReflexiveBody(verb, subject, bodyPart, rightNumberPoss),
    };
};

// Dispatcher del single reflexivo en BASE: reparte entre concordancia (el
// clásico "¿qué pronombre le toca a este sujeto?"), contraste y partes del
// cuerpo, de modo que el tema se practica en sus tres sub-habilidades.
const generateReflexiveSingle = (leadPrefix?: string): PopUpPronounQuestion => {
    const r = Math.random();
    if (r < 0.3) return generateReflexiveContrastPopUp(leadPrefix);
    if (r < 0.5) return generateReflexiveBodyPopUp(leadPrefix);
    return generateReflexivePopUp(leadPrefix);
};

// POP-UP de UN OD suelto: "Yo doy el libro" → lo. Compartido con Interferencia.
const generateSingleOdPopUp = (): PopUpPronounQuestion => {
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
    // Single reflexivo (concordancia, contraste o cuerpo) o single OD.
    if (Math.random() < ctx.reflexiveShare) return generateReflexiveSingle();
    return generateSingleOdPopUp();
};

// INTERFERENCIA: objeto + un distractor textual (adverbio/contexto).
// En BASE es un solo pronombre (OD o reflexivo) con el mismo distractor adverbial.
const generateInterference = (ctx: GenContext): QuestionData => {
    const adverbial = pick(ADVERBIALS);
    if (ctx.singleClitic) {
        // El adverbial hace de lead: "Ayer él ___ levanta." (reflexivo) o
        // "Ayer él da el libro" (OD, con minúscula inicial tras el adverbial).
        if (Math.random() < ctx.reflexiveShare) return generateReflexiveSingle(`${adverbial} `);
        const c = generateSingleOdPopUp();
        return { ...c, phrase: `${adverbial} ${c.phrase.charAt(0).toLowerCase()}${c.phrase.slice(1)}` };
    }
    const c = pickDoubleCombo(ctx);
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

// CORTO CIRCUITO: dos entradas → pronombre. Nivel 2/3: persona (OI) + objeto (OD)
// → clúster. BASE: la combinación genuina de dos entradas es reflexiva (persona +
// verbo → pronombre reflexivo); para OD se muestra verbo + objeto (la persona no
// interviene en el OD, por eso ese panel se rotula "VERBO", no "PERSONA").
const generateShortCircuit = (ctx: GenContext): QuestionData => {
    if (ctx.singleClitic) {
        if (Math.random() < ctx.reflexiveShare) {
            const verb = pick(BARE_REFLEXIVE_VERBS);
            const subject = pick(SUBJECTS);
            const pron = REFLEXIVE_PRON[subject.key];
            return {
                person: subject.pronoun,
                object: verb.infinitive,
                personLabel: 'PERSONA',
                objectLabel: 'VERBO',
                correctAnswer: pron,
                options: buildReflexiveOptions(),
                explanation: explainReflexive(subject, verb, pron),
            };
        }
        const verb = pick(VERBS);
        const od = pick(compatibleObjects(verb));
        return {
            person: cap(verb.infinitive),
            object: od.phrase,
            personLabel: 'VERBO',
            objectLabel: 'OBJETO',
            correctAnswer: od.pron,
            options: buildSingleOptions(),
            explanation: explainSingleOd(od),
        };
    }
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
// En BASE es solo OD ("Doy el libro." → "Lo doy."): los reflexivos ya son
// pronominales, no hay una frase "sin pronombre" que transformar.
const generateInstantSwitch = (ctx: GenContext): QuestionData => {
    if (ctx.singleClitic) {
        const verb = pick(VERBS);
        const { subject, showPronoun } = pickSubject();
        const od = pick(compatibleObjects(verb));
        const verbForm = verb.forms[subject.key];
        const initialHead = showPronoun ? `${subject.pronoun} ${verbForm}` : cap(verbForm);
        // Proclisis con un OD suelto: el pronombre va DELANTE del verbo conjugado.
        const core = `${od.pron} ${verbForm}`;
        const transformed = showPronoun ? `${subject.pronoun} ${core}.` : `${cap(od.pron)} ${verbForm}.`;
        return {
            initialPhrase: `${initialHead} ${od.phrase}.`,
            transformedPhrase: transformed,
            acceptedAnswers: [core, `${subject.pronoun} ${core}`],
            explanation: explainSingleOd(od),
        };
    }
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

// DETECTOR reflexivo: la frase correcta entre los errores clásicos de
// estudiantes. Dos variantes:
//  - Concordancia: "Yo me ducho." frente a persona equivocada ("Yo se ducho."),
//    pronombre pospuesto ("Yo ducho me.") y pronombre omitido ("Yo ducho.").
//  - Cuerpo: "Me lavo las manos." frente al posesivo redundante ("mis manos"),
//    el calco sin reflexivo ("Lavo mis manos.") y la parte sin artículo.
// El prompt da el material (infinitivo pronominal + sujeto), igual que el
// detector OI/OD da la frase fuente.
const generateReflexiveDetector = (): QuestionData => {
    if (Math.random() < 0.4) {
        const verb = pick(BODY_VERBS);
        const subject = pick(BODY_SUBJECTS);
        const pron = REFLEXIVE_PRON[subject.key];
        const vf = verb.forms[subject.key];
        const bodyPart = pick(verb.bodyParts!);
        const [article, ...nounParts] = bodyPart.split(' ');
        const noun = nounParts.join(' ');
        const isPlural = article === 'los' || article === 'las';
        const poss = POSSESSIVES[subject.key as PossessiveKey];
        const possArt = isPlural ? poss.plur : poss.sing;
        const correct = `${subject.pronoun} ${pron} ${vf} ${bodyPart}.`;
        const options = new Set<string>([correct]);
        // Error A: posesivo redundante ("Yo me lavo mis manos.").
        options.add(`${subject.pronoun} ${pron} ${vf} ${possArt} ${noun}.`);
        // Error B: calco del inglés, sin reflexivo y con posesivo ("Yo lavo mis manos.").
        options.add(`${subject.pronoun} ${vf} ${possArt} ${noun}.`);
        // Error C: parte del cuerpo sin artículo ("Yo me lavo manos.").
        options.add(`${subject.pronoun} ${pron} ${vf} ${noun}.`);
        return {
            prompt: `${verb.infinitive} + ${bodyPart} · ${subject.pronoun}`,
            options: shuffle(Array.from(options)),
            correctAnswers: [correct],
            explanation: explainReflexiveBody(verb, subject, bodyPart, possArt),
        };
    }
    const verb = pick(BARE_REFLEXIVE_VERBS);
    const subject = pick(SUBJECTS);
    const pron = REFLEXIVE_PRON[subject.key];
    const vf = verb.forms[subject.key];
    const wrongPron = pick(REFLEXIVE_PRONOUNS.filter(p => p !== pron));
    const correct = `${subject.pronoun} ${pron} ${vf}.`;
    const options = new Set<string>([correct]);
    // Error A: pronombre de otra persona ("Yo se ducho.").
    options.add(`${subject.pronoun} ${wrongPron} ${vf}.`);
    // Error B: pronombre pospuesto al verbo conjugado ("Yo ducho me.").
    options.add(`${subject.pronoun} ${vf} ${pron}.`);
    // Error C: pronombre omitido ("Yo ducho.").
    options.add(`${subject.pronoun} ${vf}.`);
    const explanation = explainReflexive(subject, verb, pron);
    return {
        prompt: `${verb.infinitive} · ${subject.pronoun}`,
        options: shuffle(Array.from(options)),
        correctAnswers: [correct],
        explanation: {
            ...explanation,
            detail: `«${subject.pronoun} ${wrongPron} ${vf}» copia el pronombre de otra persona, y sin pronombre («${subject.pronoun} ${vf}») el verbo deja de ser reflexivo.`,
        },
    };
};

// DETECTOR: elegir la forma pronominal correcta entre errores clásicos.
// En BASE es siempre reflexivo (la regla "le → se" pertenece a los niveles 2/3);
// en los niveles 2/3 mezcla ambas familias de errores según el contexto.
const generateDetector = (ctx: GenContext): QuestionData => {
    if (Math.random() < ctx.reflexiveDetectorShare) return generateReflexiveDetector();
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

// RESPUESTA RÁPIDA reflexiva (BASE). Tres variantes de diálogo:
//  - te → me: "¿Te duchas?" → "Sí, me ducho" (el volteo clásico).
//  - se (ustedes) → nos: "¿Ustedes se duchan?" → "Sí, nos duchamos".
//  - Contraste: la pregunta lleva un OD animado ("¿Despiertas a tu hermano?") y
//    la trampa es responder con el reflexivo ("Sí, me despierto") en vez del OD
//    ("Sí, lo despierto").
const CONTRAST_QR_VERBS = CONTRAST_VERBS.filter(v => v.contrast!.plain.some(p => p.pron));

const generateQuickResponseReflexive = (): QuestionData => {
    const r = Math.random();
    if (r < 0.3) {
        const verb = pick(BARE_REFLEXIVE_VERBS);
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
    if (r < 0.55) {
        const verb = pick(CONTRAST_QR_VERBS);
        const plain = pick(verb.contrast!.plain.filter(p => p.pron));
        const yoForm = verb.forms.yo;
        const odPron = plain.pron!;
        const odAlt = pick(DIRECT_PRONOUNS.filter(p => p !== odPron));
        const options = shuffle([
            `Sí, ${odPron} ${yoForm}`,
            `Sí, me ${yoForm}`,
            `Sí, ${odAlt} ${yoForm}`,
            `Sí, se ${yoForm}`,
        ]);
        return {
            questionPhrase: `¿${cap(verb.forms.tu)} ${plain.phrase}?`,
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
    const verb = pick(BARE_REFLEXIVE_VERBS);
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
    if (Math.random() < ctx.reflexiveShare) return generateQuickResponseReflexive();
    const verb = pick(VERBS);
    const od = pick(compatibleObjects(verb));
    const yoForm = verb.forms.yo;
    return {
        questionPhrase: `¿${cap(verb.forms.tu)} ${od.phrase}?`,
        correctAnswer: `Sí, ${od.pron} ${yoForm}`,
        options: buildSingleOptions().map(p => `Sí, ${p} ${yoForm}`),
        explanation: explainSingleOd(od),
    };
};

const generateQuickResponse = (ctx: GenContext): QuestionData => {
    if (ctx.singleClitic) return generateQuickResponseSingle(ctx);
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

// Leads para reflexivos en POSICIÓN. Son de 3ª persona (→ pronombre "se") y encajan
// con verbos de rutina. Los de infinitivo son cláusulas de finalidad ("para ___")
// que fuerzan la enclisis; los de gerundio son adverbiales.
const REFL_INF_LEADS = ['Va al baño para', 'Usa el despertador para', 'Entra en el cuarto para', 'Necesita tiempo para', 'Enciende la luz para'];
const REFL_GER_LEADS = ['Empezó la mañana', 'Terminó el día', 'Salió del baño', 'Pasó un rato', 'Llegó a casa'];

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

// Variantes REFLEXIVAS de los SEIS contextos de POSICIÓN. El clítico es un
// reflexivo suelto (me/te/se/nos) en vez de un OD. Lo que se evalúa sigue siendo
// la COLOCACIÓN (proclisis vs. enclisis), por eso reutilizan las mismas reglas
// POSITION_*. Cada nivel restringe los contextos vía POSITION_INDICES_BY_LEVEL:
// BASE practica 0/3/4; los imperativos entran en el nivel 2 y la perífrasis en el 3.
const REFLEXIVE_POSITION_CONTEXTS: Record<number, (ctx: GenContext) => QuestionData> = {
    // 0. Verbo conjugado → proclisis. El pronombre concuerda con el sujeto.
    0: () => {
        const verb = pick(BARE_REFLEXIVE_VERBS);
        const subject = pick(SUBJECTS);
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
    // 1. Imperativo negativo → proclisis. El imperativo de "tú" fija el clítico "te".
    1: () => {
        const verb = pick(BARE_REFLEXIVE_VERBS);
        const pron: ReflexivePronoun = 'te';
        const sj = verb.subjuntivoTu;
        return {
            contextLabel: 'IMPERATIVO NEGATIVO',
            chip: pron,
            tokens: [
                word('No'),
                slot('s1', true, `No ${pron} ${sj}.`, pron),
                word(sj),
                slot('s2', false, `No ${sj}${pron}.`, pron),
            ],
            correctSlotIds: ['s1'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_PROCLISIS', 'Regla: delante del verbo', RULES.impNeg),
        };
    },
    // 2. Imperativo afirmativo → enclisis. La forma unida está curada a mano
    // ("levántate" con tilde, "ponte"/"vete" sin ella): la ortografía es dato.
    2: () => {
        const verb = pick(BARE_REFLEXIVE_VERBS);
        const pron: ReflexivePronoun = 'te';
        const voc = pick(VOCATIVOS);
        const ape = pick(APELATIVOS_ORDEN);
        const loose = verb.imperativoTu;
        const enc = attachReflexiveEnclitic('imp', verb, pron); // "levántate", "ponte"
        return {
            contextLabel: 'IMPERATIVO AFIRMATIVO',
            chip: pron,
            tokens: [
                word(`¡${voc},`),
                slot('s1', false, `¡${voc}, ${pron} ${loose}, ${ape}!`, pron),
                word(loose),
                slot('s2', true, `¡${voc}, ${enc}, ${ape}!`, pron),
                word(`${ape}!`),
            ],
            correctSlotIds: ['s2'],
            acceptsMultiple: false,
            explanation: positionExplanation('POSITION_ENCLISIS', 'Regla: unido al verbo', RULES.impAff),
        };
    },
    // 3. Infinitivo (tras preposición) → enclisis. El lead implica 3ª persona → "se".
    3: () => {
        const verb = pick(BARE_REFLEXIVE_VERBS);
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
    4: () => {
        const verb = pick(BARE_REFLEXIVE_VERBS);
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
    // 5. Perífrasis → DOS posiciones válidas ("Se va a levantar." / "Va a levantarse.").
    // Sujeto de 3ª persona → "se"; la enclisis reflexiva ya acentúa bien inf/ger.
    5: () => {
        const verb = pick(BARE_REFLEXIVE_VERBS);
        const pron = REFLEXIVE_PRON.el; // "se"
        const p = pick(PERIPHRASES);
        const nf = p.kind === 'ger' ? verb.gerundio : bareReflexiveInfinitive(verb.infinitive);
        const preCap = cap(p.pre);
        const enc = attachReflexiveEnclitic(p.kind, verb, pron);
        return {
            contextLabel: 'PERÍFRASIS',
            chip: pron,
            tokens: [
                slot('s1', true, `${cap(pron)} ${p.pre} ${nf}.`, pron),
                word(preCap),
                slot('s2', false, `${preCap} ${pron} ${nf}.`, pron),
                word(nf),
                slot('s3', true, `${preCap} ${enc}.`, pron),
            ],
            correctSlotIds: ['s1', 's3'],
            acceptsMultiple: true,
            explanation: positionExplanation('POSITION_PERIPHRASIS', 'Regla: dos posiciones válidas', RULES.periph),
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

const generatePronounPosition = (ctx: GenContext): QuestionData => {
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
