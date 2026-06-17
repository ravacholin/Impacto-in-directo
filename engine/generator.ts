// Generador procedural de ejercicios.
//
// A partir de los bancos de palabras y la regla de combinación (`pronouns.ts`),
// construye ejercicios correctos y variados para cada tipo. Todo es local y
// determinista en cuanto a corrección (sin IA, sin red); la variedad proviene del
// muestreo aleatorio sobre el enorme espacio combinatorio verbos × OD × OI × sujetos.

import { ExerciseType, QuestionData } from '../types';
import {
    VERBS,
    SUBJECTS,
    DIRECT_OBJECTS,
    INDIRECT_OBJECTS,
    DIRECT_PRONOUNS,
    INDIRECT_PRONOUNS,
    resolverCluster,
    type Verb,
    type Subject,
    type DirectObject,
    type IndirectObject,
    type DirectPronoun,
} from './pronouns';

// --- Utilidades aleatorias ---
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

// Clave para deduplicar opciones/preguntas (minúsculas, solo letras).
const key = (str: string) => str.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');

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

// --- Construcción de distractores ---

// Distractores para un clúster de DOS pronombres (OI + OD), p.ej. "se lo".
// Garantiza opciones del mismo número de palabras (homogéneas) e incluye el error
// clásico "le lo" cuando aplica.
const buildDoubleOptions = (oi: IndirectObject, od: DirectObject): string[] => {
    const correct = resolverCluster(oi.pron, od.pron);
    const oiResolved = oi.isThirdPerson ? 'se' : oi.pron;

    const candidates: string[] = [];
    // Variar el OD manteniendo el OI.
    for (const odAlt of DIRECT_PRONOUNS) candidates.push(`${oiResolved} ${odAlt}`);
    // Variar el OI manteniendo el OD.
    for (const oiAlt of INDIRECT_PRONOUNS) {
        const r = oiAlt === 'le' || oiAlt === 'les' ? 'se' : oiAlt;
        candidates.push(`${r} ${od.pron}`);
    }
    // Error clásico de cacofonía: "le lo" / "les lo" sin aplicar la regla "se".
    if (oi.isThirdPerson) candidates.push(`${oi.pron} ${od.pron}`);

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

// Distractores para UN solo pronombre de OD: las cuatro formas lo/la/los/las.
const buildSingleOptions = (): string[] => shuffle([...DIRECT_PRONOUNS]);

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

const pickDoubleCombo = (thirdPersonOnly = false): DoubleCombo => {
    const verb = pick(VERBS);
    const { subject, showPronoun } = pickSubject();
    const od = pick(DIRECT_OBJECTS);
    const oiPool = thirdPersonOnly ? INDIRECT_OBJECTS.filter(o => o.isThirdPerson) : INDIRECT_OBJECTS;
    const oi = pick(oiPool);
    return { verb, subject, showPronoun, od, oi, verbForm: verb.forms[subject.key] };
};

// Frase con verbo + OD + OI: "Doy el libro a Juan" / "Él da el libro a Juan".
const buildSentence = (c: DoubleCombo): string => {
    const head = c.showPronoun ? `${c.subject.pronoun} ${c.verbForm}` : cap(c.verbForm);
    return `${head} ${c.od.phrase} ${c.oi.phrase}`;
};

// POP-UP / BATTLE: mezcla de preguntas de uno y dos objetos.
const generatePopUp = (): QuestionData => {
    const isDouble = Math.random() < 0.65;
    if (isDouble) {
        const c = pickDoubleCombo();
        return {
            phrase: buildSentence(c),
            correctAnswer: resolverCluster(c.oi.pron, c.od.pron),
            options: buildDoubleOptions(c.oi, c.od),
        };
    }
    // Solo OD.
    const verb = pick(VERBS);
    const { subject, showPronoun } = pickSubject();
    const od = pick(DIRECT_OBJECTS);
    const verbForm = verb.forms[subject.key];
    const head = showPronoun ? `${subject.pronoun} ${verbForm}` : cap(verbForm);
    return {
        phrase: `${head} ${od.phrase}`,
        correctAnswer: od.pron,
        options: buildSingleOptions(),
    };
};

// INTERFERENCIA: siempre doble objeto + un distractor textual (adverbio/contexto).
const generateInterference = (): QuestionData => {
    const c = pickDoubleCombo();
    const adverbial = pick(ADVERBIALS);
    const sentence = buildSentence(c);
    // El adverbial va al frente; el resto de la frase en minúscula inicial.
    const phrase = `${adverbial} ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
    return {
        phrase,
        correctAnswer: resolverCluster(c.oi.pron, c.od.pron),
        options: buildDoubleOptions(c.oi, c.od),
    };
};

// CORTO CIRCUITO: dos entradas (persona + objeto) → clúster.
const generateShortCircuit = (): QuestionData => {
    const od = pick(DIRECT_OBJECTS);
    const oi = pick(INDIRECT_OBJECTS);
    return {
        person: oi.phrase,
        object: od.phrase,
        correctAnswer: resolverCluster(oi.pron, od.pron),
        options: buildDoubleOptions(oi, od),
    };
};

// SWITCH INSTANTÁNEO: transformar la frase completa a su versión con pronombres.
const generateInstantSwitch = (): QuestionData => {
    const c = pickDoubleCombo();
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
    };
};

// DETECTOR: elegir la forma pronominal correcta entre errores clásicos.
// Se restringe a OI de 3ª persona para que el foco sea la regla "le → se".
const generateDetector = (): QuestionData => {
    const c = pickDoubleCombo(true);
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

    return {
        prompt: `${buildSentence(c)}.`,
        options: shuffle(Array.from(options)),
        correctAnswers: [correct],
    };
};

const GENERATORS: Record<ExerciseType, () => QuestionData> = {
    [ExerciseType.POP_UP_PRONOUN]: generatePopUp,
    [ExerciseType.BATTLE]: generatePopUp,
    [ExerciseType.INTERFERENCE]: generateInterference,
    [ExerciseType.SHORT_CIRCUIT]: generateShortCircuit,
    [ExerciseType.INSTANT_SWITCH]: generateInstantSwitch,
    [ExerciseType.DETECTOR]: generateDetector,
};

// Genera un lote de preguntas únicas (evita repetir el mismo enunciado).
export const generateBatch = (type: ExerciseType, count: number): QuestionData[] => {
    const generate = GENERATORS[type];
    if (!generate) throw new Error(`Exercise type "${type}" not supported.`);

    const questions: QuestionData[] = [];
    const seen = new Set<string>();
    let attempts = 0;
    const maxAttempts = count * 30;

    while (questions.length < count && attempts < maxAttempts) {
        attempts++;
        const q = generate();
        const k = key(JSON.stringify(q));
        if (seen.has(k)) continue;
        seen.add(k);
        questions.push(q);
    }

    // En el caso (improbable) de que no se alcance el cupo único, se completa
    // permitiendo repeticiones para no devolver un lote vacío.
    while (questions.length < count) questions.push(generate());

    return questions;
};
