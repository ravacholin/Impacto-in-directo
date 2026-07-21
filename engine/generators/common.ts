// Infraestructura compartida de los generadores.
//
// Reúne todo lo que usan varios tipos de ejercicio: el contexto de generación
// (dificultad + sesgo adaptativo), los pools de vocabulario filtrados por nivel,
// las utilidades aleatorias, las explicaciones didácticas, los constructores de
// distractores y los helpers de combinación verbo/OD/OI. Cada generador vive en
// su propio archivo e importa desde aquí; `generator.ts` es solo la fachada
// (dispatch + dedup) que ata todo.
//
// Nada de esto importa `store.ts`: la inyección de dificultad y reglas
// prioritarias ocurre en la fachada async (`engine.ts`).

import { Difficulty, Explanation, RuleId } from '../../types';
import { normalize, shuffle } from '../../utils';
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
    SUBJECT_PRONOUN_VARIANTS,
    REFLEXIVE_LEADS,
    resolverCluster,
    compatibleObjects,
    corefiere,
    oiCompatible,
    type Verb,
    type SubjectKey,
    type DirectObject,
    type IndirectObject,
    type DirectPronoun,
    type IndirectPronoun,
    type ReflexiveVerb,
    type ReflexivePronoun,
    type Subject,
} from '../pronouns';
import type { PopUpPronounQuestion } from '../../types';

// --- Utilidades aleatorias ---
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Sortea un sujeto y LUEGO una variante de pronombre para esa clave ("el" →
// "Él"/"Ella"/"Usted", "ellos" → "Ellos"/"Ellas"/"Ustedes"). El reparto de
// claves sigue siendo uniforme (1/5 por defecto); solo cambia el texto, así
// que la conjugación y el pronombre reflexivo (que dependen de `key`) no se
// ven afectados. Da más variedad de personas visibles sin sesgar el pool.
export const pickVariedSubject = (pool: Subject[] = SUBJECTS): Subject => {
    const base = pick(pool);
    return { key: base.key, pronoun: pick(SUBJECT_PRONOUN_VARIANTS[base.key]) };
};

// Clave para deduplicar opciones/preguntas (minúsculas, solo letras).
export const key = normalize;

export const cap = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

// --- Contexto de generación (dificultad + sesgo adaptativo) ---
//
// Nivel 1 (BASE): un SOLO pronombre, directo (lo/la/los/las) o reflexivo
// (me/te/se/nos). Sin indirectos, sin dobles y sin "se". Pop-up y Posición usan un
// clítico suelto. Solo los contextos de posición sin imperativos.
// Nivel 2 (INTERMEDIO): siempre clúster doble (OI+OD), salvo perífrasis.
// Nivel 3 (AVANZADO): siempre clúster doble, incluidas perífrasis.
// El pronombre único es un ejercicio exclusivo de BASE: en Intermedio/Avanzado nunca
// se genera una pregunta de un solo pronombre, ni siquiera por sesgo adaptativo.
export interface GenOptions {
    difficulty?: Difficulty;
    weakRules?: RuleId[];
}

// Pools de palabras filtrados por nivel (léxico acumulativo: level <= difficulty).
// Se calculan UNA vez por lote; toda elección aleatoria muestrea de aquí, nunca
// de los bancos globales.
export interface GenPools {
    // Verbos del nivel que tienen al menos un OD compatible dentro del nivel.
    verbPool: Verb[];
    odPool: DirectObject[];
    // ODs compatibles por verbo, precomputados contra `odPool`.
    compatByVerb: Map<string, DirectObject[]>;
    // OIs del nivel (antes del filtro de 3ª persona del nivel BASE).
    oiLevelPool: IndirectObject[];
    reflexivePool: ReflexiveVerb[];
    bareReflexivePool: ReflexiveVerb[];
    bodyReflexivePool: ReflexiveVerb[];
    contrastQrReflexivePool: ReflexiveVerb[];
}

// Exportado para que los tests verifiquen los invariantes de nivel de los pools.
export const buildPools = (difficulty: Difficulty): GenPools => {
    const odPool = DIRECT_OBJECTS.filter(o => o.level <= difficulty);
    const compatByVerb = new Map<string, DirectObject[]>();
    let verbPool = VERBS.filter(v => v.level <= difficulty).filter(v => {
        const compat = compatibleObjects(v, odPool);
        if (!compat.length) return false;
        compatByVerb.set(v.infinitive, compat);
        return true;
    });
    // Fallback defensivo: nunca dejar un pool vacío aunque la curación fallara
    // (los tests de datos garantizan que esta rama no se ejecuta en la práctica).
    if (!verbPool.length) {
        verbPool = [...VERBS];
        for (const v of verbPool) compatByVerb.set(v.infinitive, compatibleObjects(v));
    }
    const oiLevelPool = INDIRECT_OBJECTS.filter(o => o.level <= difficulty);
    const reflexivePool = REFLEXIVE_VERBS.filter(v => v.level <= difficulty);
    return {
        verbPool,
        odPool,
        compatByVerb,
        oiLevelPool: oiLevelPool.length ? oiLevelPool : [...INDIRECT_OBJECTS],
        reflexivePool,
        bareReflexivePool: reflexivePool.filter(v => !v.needsComplement),
        bodyReflexivePool: reflexivePool.filter(v => v.bodyParts?.length),
        contrastQrReflexivePool: reflexivePool.filter(v => v.contrast?.plain.some(p => p.pron)),
    };
};

export interface GenContext extends GenPools {
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

export const POSITION_INDICES_BY_LEVEL: Record<Difficulty, number[]> = {
    1: [0, 3, 4],          // conjugado, infinitivo, gerundio
    2: [0, 1, 2, 3, 4],    // + imperativos
    3: [0, 1, 2, 3, 4, 5], // + perífrasis
};

// Sub-habilidades reflexivas rastreadas por el SRS: si alguna está débil, el
// generador sube la cuota de preguntas reflexivas donde ya existe esa elección.
const REFLEXIVE_RULES: RuleId[] = ['REFLEXIVE', 'REFLEXIVE_CONTRAST', 'REFLEXIVE_BODY'];

export const buildContext = ({ difficulty = 2, weakRules = [] }: GenOptions): GenContext => {
    const isBase = difficulty === 1;
    const pools = buildPools(difficulty);
    const oiPool = isBase ? pools.oiLevelPool.filter(o => !o.isThirdPerson) : [...pools.oiLevelPool];
    // BASE: siempre un solo pronombre. Niveles 2/3: siempre doble (el pronombre
    // único queda reservado a BASE, sin excepciones ni sesgo adaptativo).
    const singleOdShare = isBase ? 1 : 0;
    let thirdPersonBias = 0;
    // Sesgos adaptativos: solo empujan donde ya existe una elección aleatoria.
    if (weakRules.includes('SE_TRANSFORM') && difficulty > 1) thirdPersonBias = 0.6;
    const reflexiveWeak = weakRules.some(r => REFLEXIVE_RULES.includes(r));
    return {
        ...pools,
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
export const pickOI = (ctx: GenContext, pool: IndirectObject[] = ctx.oiPool): IndirectObject => {
    if (ctx.thirdPersonBias > 0 && Math.random() < ctx.thirdPersonBias) {
        const third = pool.filter(o => o.isThirdPerson);
        if (third.length) return pick(third);
    }
    return pick(pool);
};

// OD compatible con el verbo dentro del pool del nivel (precomputado).
export const pickCompatibleOD = (ctx: GenContext, verb: Verb): DirectObject =>
    pick(ctx.compatByVerb.get(verb.infinitive) ?? compatibleObjects(verb));

// --- Explicaciones didácticas ---

export const OD_LABELS: Record<DirectPronoun, string> = {
    lo: 'masc. singular',
    la: 'fem. singular',
    los: 'masc. plural',
    las: 'fem. plural',
};

export const odStep = (od: DirectObject): string => `${od.phrase} → ${od.pron} (${OD_LABELS[od.pron]})`;

// Explicación de un clúster doble OI + OD. Es la explicación base de casi todas
// las actividades; la regla principal depende de si se dispara "le/les → se".
export const explainCluster = (oi: IndirectObject, od: DirectObject): Explanation => {
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

export const explainSingleOd = (od: DirectObject): Explanation => ({
    ruleId: 'OD_AGREEMENT',
    title: 'Regla: concordancia del OD',
    steps: [odStep(od)],
    detail: 'El pronombre concuerda en género y número con el objeto que reemplaza.',
});

export const explainReflexive = (subject: Subject, verb: ReflexiveVerb, pron: ReflexivePronoun): Explanation => ({
    ruleId: 'REFLEXIVE',
    title: 'Regla: pronombre reflexivo',
    steps: [
        `${verb.infinitive}: la acción recae sobre el propio sujeto`,
        `El pronombre copia la persona del sujeto: ${subject.pronoun} → ${pron}`,
        'yo → me · tú → te · él/ella/ellos → se · nosotros → nos',
    ],
    detail: 'El error clásico es usar «se» para todo: solo él/ella/ellos llevan «se»; cada persona tiene SU pronombre.',
});

export const explainReflexiveBody = (verb: ReflexiveVerb, subject: Subject, bodyPart: string, possessive: string): Explanation => {
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
export const buildClusterOptions = (oiPron: IndirectPronoun, isThirdPerson: boolean, odPron: DirectPronoun): string[] => {
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

export const buildDoubleOptions = (oi: IndirectObject, od: DirectObject): string[] =>
    buildClusterOptions(oi.pron, oi.isThirdPerson, od.pron);

// Distractores para UN solo pronombre de OD: las cuatro formas lo/la/los/las.
export const buildSingleOptions = (): string[] => shuffle([...DIRECT_PRONOUNS]);

// Distractores para un pronombre reflexivo: las cuatro formas me/te/se/nos.
export const buildReflexiveOptions = (): string[] => shuffle([...REFLEXIVE_PRONOUNS]);

// --- Combinación de sujeto/verbo/OD/OI ---

// Elige un sujeto y decide si mostrarlo explícito (más variedad de frases).
export const pickSubject = (): { subject: Subject; showPronoun: boolean } => {
    const subject = pickVariedSubject();
    const showPronoun = subject.key !== 'yo' && subject.key !== 'tu' && Math.random() < 0.5;
    return { subject, showPronoun };
};

export interface DoubleCombo {
    verb: Verb;
    subject: Subject;
    showPronoun: boolean;
    od: DirectObject;
    oi: IndirectObject;
    verbForm: string;
}

export const pickDoubleCombo = (ctx: GenContext, thirdPersonOnly = false): DoubleCombo => {
    const verb = pick(ctx.verbPool);
    const { subject, showPronoun } = pickSubject();
    // OD compatible con el verbo (evita "cantar el coche").
    const od = pickCompatibleOD(ctx, verb);
    // OI que no correfiera con el sujeto (evita "Él … a él") y que el verbo
    // admita semánticamente (evita "Vendo el coche a los niños"). El Detector
    // exige 3ª persona siempre (su foco ES la regla "le → se"), sin importar
    // el nivel. Cascada de fallbacks para no vaciar nunca el pool.
    const basePool = thirdPersonOnly ? ctx.oiPool.filter(o => o.isThirdPerson) : ctx.oiPool;
    const noCoref = basePool.filter(o => !corefiere(subject.key, o));
    const noVeto = noCoref.filter(o => oiCompatible(verb, o));
    const oi = pickOI(ctx, noVeto.length ? noVeto : noCoref.length ? noCoref : basePool);
    return { verb, subject, showPronoun, od, oi, verbForm: verb.forms[subject.key] };
};

// Frase con verbo + OD + OI: "Doy el libro a Juan" / "Él da el libro a Juan".
export const buildSentence = (c: DoubleCombo): string => {
    const head = c.showPronoun ? `${c.subject.pronoun} ${c.verbForm}` : cap(c.verbForm);
    return `${head} ${c.od.phrase} ${c.oi.phrase}`;
};

// --- Reflexivo / OD single (compartidos por Pop-up e Interferencia) ---

// POP-UP reflexivo: reconocer el pronombre que corresponde al sujeto. `leadPrefix`
// es el texto de ambientación antes del sujeto (Pop-up usa un contexto de rutina;
// Interferencia le pasa un adverbial distractor). Termina donde empieza el sujeto.
export const generateReflexivePopUp = (ctx: GenContext, leadPrefix: string = `${pick(REFLEXIVE_LEADS)}, `): PopUpPronounQuestion => {
    const verb = pick(ctx.bareReflexivePool);
    const subject = pickVariedSubject();
    const pron = REFLEXIVE_PRON[subject.key];
    return {
        phrase: `${leadPrefix}${subject.pronoun.toLowerCase()} ___ ${verb.forms[subject.key]}.`,
        correctAnswer: pron,
        options: buildReflexiveOptions(),
        explanation: explainReflexive(subject, verb, pron),
    };
};

// Single reflexivo en BASE (Pop-up / Interferencia): concordancia del pronombre
// con el sujeto ("¿qué pronombre le toca a este sujeto?"). Las opciones son
// siempre pronombres reflexivos (me/te/se/nos); nunca un artículo ni "(nada)".
// El contraste reflexivo (opciones con pronombre) se practica en Respuesta
// Rápida, y el artículo con partes del cuerpo (opciones = frases) en el Detector.
export const generateReflexiveSingle = (ctx: GenContext, leadPrefix?: string): PopUpPronounQuestion =>
    leadPrefix === undefined ? generateReflexivePopUp(ctx) : generateReflexivePopUp(ctx, leadPrefix);

// POP-UP de UN OD suelto: "Yo doy el libro" → lo. Compartido con Interferencia.
export const generateSingleOdPopUp = (ctx: GenContext): PopUpPronounQuestion => {
    const verb = pick(ctx.verbPool);
    const { subject, showPronoun } = pickSubject();
    const od = pickCompatibleOD(ctx, verb);
    const verbForm = verb.forms[subject.key];
    const head = showPronoun ? `${subject.pronoun} ${verbForm}` : cap(verbForm);
    return {
        phrase: `${head} ${od.phrase}`,
        correctAnswer: od.pron,
        options: buildSingleOptions(),
        explanation: explainSingleOd(od),
    };
};

// Posesivos por persona para fabricar el error clásico «me lavo MIS manos».
// "nosotros" queda fuera: su posesivo concuerda en género (nuestras/nuestros) y
// complicaría los distractores sin sumar valor didáctico.
export type PossessiveKey = Exclude<SubjectKey, 'nosotros'>;
export const POSSESSIVES: Record<PossessiveKey, { sing: string; plur: string }> = {
    yo: { sing: 'mi', plur: 'mis' },
    tu: { sing: 'tu', plur: 'tus' },
    el: { sing: 'su', plur: 'sus' },
    ellos: { sing: 'su', plur: 'sus' },
};

export const BODY_SUBJECTS = SUBJECTS.filter(s => s.key !== 'nosotros');
