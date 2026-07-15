// Motor de pronombres de objeto (OD/OI) del español.
//
// Este módulo concentra TODO el conocimiento lingüístico: los bancos de palabras
// curados y la regla de combinación de pronombres. No hay IA ni red: a partir de
// estos datos el generador produce un repertorio prácticamente infinito de
// ejercicios correctos.

// --- Sujetos disponibles para conjugar ---
// El orden importa: se usa como clave en la tabla de conjugación de cada verbo.
export type SubjectKey = 'yo' | 'tu' | 'el' | 'nosotros' | 'ellos';

export interface Subject {
    key: SubjectKey;
    // Pronombre de sujeto explícito (para variantes "Yo se lo doy").
    pronoun: string;
}

export const SUBJECTS: Subject[] = [
    { key: 'yo', pronoun: 'Yo' },
    { key: 'tu', pronoun: 'Tú' },
    { key: 'el', pronoun: 'Él' },
    { key: 'nosotros', pronoun: 'Nosotros' },
    { key: 'ellos', pronoun: 'Ellos' },
];

// --- Verbos transitivos que admiten OD + OI de forma natural ---
// Guardamos la conjugación de presente explícita por sujeto para evitar
// cualquier bug de conjugación (sobre todo con irregulares).
// Etiquetas semánticas de un objeto directo. Sirven para filtrar combinaciones
// verbo+OD implausibles (p.ej. "cantar el coche") sin perder la generación
// combinatoria: un combo es válido si el OD comparte al menos una tag con las que
// el verbo acepta.
export type ODTag = 'fisico' | 'texto' | 'relato' | 'dinero' | 'cancion' | 'imagen' | 'comida';

export interface Verb {
    infinitive: string;
    forms: Record<SubjectKey, string>;
    // Tags de OD que el verbo admite semánticamente (ver `compatibleObjects`).
    accepts: ODTag[];
    // Formas no finitas / imperativas necesarias para la actividad de POSICIÓN.
    // Se guardan explícitas (curadas a mano) para evitar bugs con irregulares.
    gerundio: string;       // p.ej. "dando", "leyendo", "pidiendo"
    // Imperativo afirmativo de "tú" con la TILDE ya colocada lista para clíticos.
    // Como solo combinamos clústeres dobles (p.ej. "se lo"), el enclítico siempre
    // es esdrújula/sobreesdrújula → la tilde es obligatoria. Esta forma NO se usa
    // suelta (sin clíticos no sería ortográficamente válida en monosílabos).
    imperativoTu: string;   // p.ej. "dá", "muéstra", "cómpra"
    // Presente de subjuntivo de "tú" para el imperativo negativo ("no ___ des").
    subjuntivoTu: string;   // p.ej. "des", "muestres", "compres"
}

export const VERBS: Verb[] = [
    { infinitive: 'dar', accepts: ['fisico', 'texto', 'relato', 'dinero', 'cancion', 'imagen'], forms: { yo: 'doy', tu: 'das', el: 'da', nosotros: 'damos', ellos: 'dan' }, gerundio: 'dando', imperativoTu: 'dá', subjuntivoTu: 'des' },
    { infinitive: 'mostrar', accepts: ['fisico', 'texto', 'relato', 'imagen'], forms: { yo: 'muestro', tu: 'muestras', el: 'muestra', nosotros: 'mostramos', ellos: 'muestran' }, gerundio: 'mostrando', imperativoTu: 'muéstra', subjuntivoTu: 'muestres' },
    { infinitive: 'enviar', accepts: ['fisico', 'texto', 'dinero'], forms: { yo: 'envío', tu: 'envías', el: 'envía', nosotros: 'enviamos', ellos: 'envían' }, gerundio: 'enviando', imperativoTu: 'envía', subjuntivoTu: 'envíes' },
    { infinitive: 'prestar', accepts: ['fisico', 'texto', 'dinero'], forms: { yo: 'presto', tu: 'prestas', el: 'presta', nosotros: 'prestamos', ellos: 'prestan' }, gerundio: 'prestando', imperativoTu: 'présta', subjuntivoTu: 'prestes' },
    { infinitive: 'comprar', accepts: ['fisico', 'dinero'], forms: { yo: 'compro', tu: 'compras', el: 'compra', nosotros: 'compramos', ellos: 'compran' }, gerundio: 'comprando', imperativoTu: 'cómpra', subjuntivoTu: 'compres' },
    { infinitive: 'traer', accepts: ['fisico', 'texto', 'dinero'], forms: { yo: 'traigo', tu: 'traes', el: 'trae', nosotros: 'traemos', ellos: 'traen' }, gerundio: 'trayendo', imperativoTu: 'tráe', subjuntivoTu: 'traigas' },
    { infinitive: 'explicar', accepts: ['relato', 'texto'], forms: { yo: 'explico', tu: 'explicas', el: 'explica', nosotros: 'explicamos', ellos: 'explican' }, gerundio: 'explicando', imperativoTu: 'explíca', subjuntivoTu: 'expliques' },
    { infinitive: 'contar', accepts: ['relato'], forms: { yo: 'cuento', tu: 'cuentas', el: 'cuenta', nosotros: 'contamos', ellos: 'cuentan' }, gerundio: 'contando', imperativoTu: 'cuénta', subjuntivoTu: 'cuentes' },
    { infinitive: 'vender', accepts: ['fisico', 'dinero'], forms: { yo: 'vendo', tu: 'vendes', el: 'vende', nosotros: 'vendemos', ellos: 'venden' }, gerundio: 'vendiendo', imperativoTu: 'vénde', subjuntivoTu: 'vendas' },
    { infinitive: 'regalar', accepts: ['fisico'], forms: { yo: 'regalo', tu: 'regalas', el: 'regala', nosotros: 'regalamos', ellos: 'regalan' }, gerundio: 'regalando', imperativoTu: 'regála', subjuntivoTu: 'regales' },
    { infinitive: 'escribir', accepts: ['texto'], forms: { yo: 'escribo', tu: 'escribes', el: 'escribe', nosotros: 'escribimos', ellos: 'escriben' }, gerundio: 'escribiendo', imperativoTu: 'escríbe', subjuntivoTu: 'escribas' },
    { infinitive: 'leer', accepts: ['texto'], forms: { yo: 'leo', tu: 'lees', el: 'lee', nosotros: 'leemos', ellos: 'leen' }, gerundio: 'leyendo', imperativoTu: 'lée', subjuntivoTu: 'leas' },
    { infinitive: 'mandar', accepts: ['fisico', 'texto', 'dinero'], forms: { yo: 'mando', tu: 'mandas', el: 'manda', nosotros: 'mandamos', ellos: 'mandan' }, gerundio: 'mandando', imperativoTu: 'mánda', subjuntivoTu: 'mandes' },
    { infinitive: 'entregar', accepts: ['fisico', 'texto', 'dinero'], forms: { yo: 'entrego', tu: 'entregas', el: 'entrega', nosotros: 'entregamos', ellos: 'entregan' }, gerundio: 'entregando', imperativoTu: 'entréga', subjuntivoTu: 'entregues' },
    { infinitive: 'ofrecer', accepts: ['fisico', 'dinero'], forms: { yo: 'ofrezco', tu: 'ofreces', el: 'ofrece', nosotros: 'ofrecemos', ellos: 'ofrecen' }, gerundio: 'ofreciendo', imperativoTu: 'ofréce', subjuntivoTu: 'ofrezcas' },
    { infinitive: 'devolver', accepts: ['fisico', 'texto', 'dinero'], forms: { yo: 'devuelvo', tu: 'devuelves', el: 'devuelve', nosotros: 'devolvemos', ellos: 'devuelven' }, gerundio: 'devolviendo', imperativoTu: 'devuélve', subjuntivoTu: 'devuelvas' },
    { infinitive: 'recomendar', accepts: ['texto', 'cancion'], forms: { yo: 'recomiendo', tu: 'recomiendas', el: 'recomienda', nosotros: 'recomendamos', ellos: 'recomiendan' }, gerundio: 'recomendando', imperativoTu: 'recomiénda', subjuntivoTu: 'recomiendes' },
    { infinitive: 'enseñar', accepts: ['texto', 'relato', 'imagen'], forms: { yo: 'enseño', tu: 'enseñas', el: 'enseña', nosotros: 'enseñamos', ellos: 'enseñan' }, gerundio: 'enseñando', imperativoTu: 'enséña', subjuntivoTu: 'enseñes' },
    { infinitive: 'dejar', accepts: ['fisico', 'texto', 'dinero'], forms: { yo: 'dejo', tu: 'dejas', el: 'deja', nosotros: 'dejamos', ellos: 'dejan' }, gerundio: 'dejando', imperativoTu: 'déja', subjuntivoTu: 'dejes' },
    { infinitive: 'llevar', accepts: ['fisico', 'texto', 'dinero'], forms: { yo: 'llevo', tu: 'llevas', el: 'lleva', nosotros: 'llevamos', ellos: 'llevan' }, gerundio: 'llevando', imperativoTu: 'lléva', subjuntivoTu: 'lleves' },
    { infinitive: 'presentar', accepts: ['texto', 'relato', 'cancion', 'imagen'], forms: { yo: 'presento', tu: 'presentas', el: 'presenta', nosotros: 'presentamos', ellos: 'presentan' }, gerundio: 'presentando', imperativoTu: 'presénta', subjuntivoTu: 'presentes' },
    { infinitive: 'describir', accepts: ['relato', 'imagen'], forms: { yo: 'describo', tu: 'describes', el: 'describe', nosotros: 'describimos', ellos: 'describen' }, gerundio: 'describiendo', imperativoTu: 'descríbe', subjuntivoTu: 'describas' },
    { infinitive: 'repetir', accepts: ['relato'], forms: { yo: 'repito', tu: 'repites', el: 'repite', nosotros: 'repetimos', ellos: 'repiten' }, gerundio: 'repitiendo', imperativoTu: 'repíte', subjuntivoTu: 'repitas' },
    { infinitive: 'preparar', accepts: ['fisico', 'texto'], forms: { yo: 'preparo', tu: 'preparas', el: 'prepara', nosotros: 'preparamos', ellos: 'preparan' }, gerundio: 'preparando', imperativoTu: 'prepára', subjuntivoTu: 'prepares' },
    { infinitive: 'pedir', accepts: ['fisico', 'texto', 'dinero', 'relato'], forms: { yo: 'pido', tu: 'pides', el: 'pide', nosotros: 'pedimos', ellos: 'piden' }, gerundio: 'pidiendo', imperativoTu: 'píde', subjuntivoTu: 'pidas' },
    { infinitive: 'dedicar', accepts: ['cancion', 'imagen'], forms: { yo: 'dedico', tu: 'dedicas', el: 'dedica', nosotros: 'dedicamos', ellos: 'dedican' }, gerundio: 'dedicando', imperativoTu: 'dedíca', subjuntivoTu: 'dediques' },
    { infinitive: 'cantar', accepts: ['cancion'], forms: { yo: 'canto', tu: 'cantas', el: 'canta', nosotros: 'cantamos', ellos: 'cantan' }, gerundio: 'cantando', imperativoTu: 'cánta', subjuntivoTu: 'cantes' },
    { infinitive: 'pasar', accepts: ['fisico', 'texto', 'relato'], forms: { yo: 'paso', tu: 'pasas', el: 'pasa', nosotros: 'pasamos', ellos: 'pasan' }, gerundio: 'pasando', imperativoTu: 'pása', subjuntivoTu: 'pases' },
    { infinitive: 'comunicar', accepts: ['relato'], forms: { yo: 'comunico', tu: 'comunicas', el: 'comunica', nosotros: 'comunicamos', ellos: 'comunican' }, gerundio: 'comunicando', imperativoTu: 'comuníca', subjuntivoTu: 'comuniques' },
    { infinitive: 'servir', accepts: ['comida'], forms: { yo: 'sirvo', tu: 'sirves', el: 'sirve', nosotros: 'servimos', ellos: 'sirven' }, gerundio: 'sirviendo', imperativoTu: 'sírve', subjuntivoTu: 'sirvas' },
    { infinitive: 'cocinar', accepts: ['comida'], forms: { yo: 'cocino', tu: 'cocinas', el: 'cocina', nosotros: 'cocinamos', ellos: 'cocinan' }, gerundio: 'cocinando', imperativoTu: 'cocína', subjuntivoTu: 'cocines' },
    { infinitive: 'pagar', accepts: ['dinero', 'comida'], forms: { yo: 'pago', tu: 'pagas', el: 'paga', nosotros: 'pagamos', ellos: 'pagan' }, gerundio: 'pagando', imperativoTu: 'pága', subjuntivoTu: 'pagues' },
    { infinitive: 'deber', accepts: ['dinero'], forms: { yo: 'debo', tu: 'debes', el: 'debe', nosotros: 'debemos', ellos: 'deben' }, gerundio: 'debiendo', imperativoTu: 'débe', subjuntivoTu: 'debas' },
    { infinitive: 'confesar', accepts: ['relato'], forms: { yo: 'confieso', tu: 'confiesas', el: 'confiesa', nosotros: 'confesamos', ellos: 'confiesan' }, gerundio: 'confesando', imperativoTu: 'confiésa', subjuntivoTu: 'confieses' },
    { infinitive: 'recordar', accepts: ['relato'], forms: { yo: 'recuerdo', tu: 'recuerdas', el: 'recuerda', nosotros: 'recordamos', ellos: 'recuerdan' }, gerundio: 'recordando', imperativoTu: 'recuérda', subjuntivoTu: 'recuerdes' },
    { infinitive: 'prometer', accepts: ['fisico', 'relato'], forms: { yo: 'prometo', tu: 'prometes', el: 'promete', nosotros: 'prometemos', ellos: 'prometen' }, gerundio: 'prometiendo', imperativoTu: 'prométe', subjuntivoTu: 'prometas' },
];

// --- Objetos directos (OD) con su pronombre según género y número ---
export type DirectPronoun = 'lo' | 'la' | 'los' | 'las';

export interface DirectObject {
    phrase: string; // "el libro"
    pron: DirectPronoun;
    // Rasgos semánticos para filtrar combinaciones verbo+OD implausibles.
    tags: ODTag[];
}

export const DIRECT_OBJECTS: DirectObject[] = [
    { phrase: 'el libro', pron: 'lo', tags: ['fisico', 'texto'] },
    { phrase: 'el regalo', pron: 'lo', tags: ['fisico'] },
    { phrase: 'el dinero', pron: 'lo', tags: ['fisico', 'dinero'] },
    { phrase: 'el informe', pron: 'lo', tags: ['fisico', 'texto', 'relato'] },
    { phrase: 'el coche', pron: 'lo', tags: ['fisico'] },
    { phrase: 'el mensaje', pron: 'lo', tags: ['texto', 'relato'] },
    { phrase: 'el paquete', pron: 'lo', tags: ['fisico'] },
    { phrase: 'el secreto', pron: 'lo', tags: ['relato'] },
    { phrase: 'el cuaderno', pron: 'lo', tags: ['fisico', 'texto'] },
    { phrase: 'el teléfono', pron: 'lo', tags: ['fisico'] },
    { phrase: 'el poema', pron: 'lo', tags: ['texto'] },
    { phrase: 'el contrato', pron: 'lo', tags: ['fisico', 'texto'] },
    { phrase: 'el chiste', pron: 'lo', tags: ['relato'] },
    { phrase: 'el consejo', pron: 'lo', tags: ['relato'] },
    { phrase: 'el café', pron: 'lo', tags: ['fisico', 'comida'] },
    { phrase: 'el pastel', pron: 'lo', tags: ['fisico', 'comida'] },
    { phrase: 'el reloj', pron: 'lo', tags: ['fisico'] },
    { phrase: 'el ordenador', pron: 'lo', tags: ['fisico'] },
    { phrase: 'la carta', pron: 'la', tags: ['fisico', 'texto'] },
    { phrase: 'la noticia', pron: 'la', tags: ['relato', 'texto'] },
    { phrase: 'la verdad', pron: 'la', tags: ['relato'] },
    { phrase: 'la receta', pron: 'la', tags: ['texto', 'relato'] },
    { phrase: 'la foto', pron: 'la', tags: ['fisico', 'imagen'] },
    { phrase: 'la canción', pron: 'la', tags: ['cancion'] },
    { phrase: 'la dirección', pron: 'la', tags: ['relato', 'texto'] },
    { phrase: 'la maleta', pron: 'la', tags: ['fisico'] },
    { phrase: 'la historia', pron: 'la', tags: ['relato'] },
    { phrase: 'la factura', pron: 'la', tags: ['texto', 'dinero'] },
    { phrase: 'la propuesta', pron: 'la', tags: ['texto', 'relato'] },
    { phrase: 'la película', pron: 'la', tags: ['relato'] },
    { phrase: 'la comida', pron: 'la', tags: ['fisico', 'comida'] },
    { phrase: 'la cena', pron: 'la', tags: ['fisico', 'comida'] },
    { phrase: 'la ropa', pron: 'la', tags: ['fisico'] },
    { phrase: 'la bicicleta', pron: 'la', tags: ['fisico'] },
    { phrase: 'los documentos', pron: 'los', tags: ['fisico', 'texto'] },
    { phrase: 'los libros', pron: 'los', tags: ['fisico', 'texto'] },
    { phrase: 'los regalos', pron: 'los', tags: ['fisico'] },
    { phrase: 'los billetes', pron: 'los', tags: ['fisico', 'dinero'] },
    { phrase: 'los apuntes', pron: 'los', tags: ['fisico', 'texto'] },
    { phrase: 'los resultados', pron: 'los', tags: ['relato', 'texto'] },
    { phrase: 'las llaves', pron: 'las', tags: ['fisico'] },
    { phrase: 'las flores', pron: 'las', tags: ['fisico'] },
    { phrase: 'las fotos', pron: 'las', tags: ['fisico', 'imagen'] },
    { phrase: 'las cartas', pron: 'las', tags: ['fisico', 'texto'] },
    { phrase: 'las noticias', pron: 'las', tags: ['relato', 'texto'] },
    { phrase: 'las instrucciones', pron: 'las', tags: ['texto', 'relato'] },
];

// --- Objetos indirectos (OI): personas con su pronombre ---
export type IndirectPronoun = 'me' | 'te' | 'le' | 'nos' | 'les';

export interface IndirectObject {
    phrase: string; // "a Juan", "a él", "a mí"
    pron: IndirectPronoun;
    isThirdPerson: boolean; // le / les → activan la regla "se"
}

export const INDIRECT_OBJECTS: IndirectObject[] = [
    { phrase: 'a mí', pron: 'me', isThirdPerson: false },
    { phrase: 'a ti', pron: 'te', isThirdPerson: false },
    { phrase: 'a Juan', pron: 'le', isThirdPerson: true },
    { phrase: 'a María', pron: 'le', isThirdPerson: true },
    { phrase: 'a él', pron: 'le', isThirdPerson: true },
    { phrase: 'a ella', pron: 'le', isThirdPerson: true },
    { phrase: 'a usted', pron: 'le', isThirdPerson: true },
    { phrase: 'a tu hermano', pron: 'le', isThirdPerson: true },
    { phrase: 'a la profesora', pron: 'le', isThirdPerson: true },
    { phrase: 'al cliente', pron: 'le', isThirdPerson: true },
    { phrase: 'a nosotros', pron: 'nos', isThirdPerson: false },
    { phrase: 'a ellos', pron: 'les', isThirdPerson: true },
    { phrase: 'a ellas', pron: 'les', isThirdPerson: true },
    { phrase: 'a ustedes', pron: 'les', isThirdPerson: true },
    { phrase: 'a mis padres', pron: 'les', isThirdPerson: true },
    { phrase: 'a los niños', pron: 'les', isThirdPerson: true },
];

const DIRECT_PRONOUNS: DirectPronoun[] = ['lo', 'la', 'los', 'las'];
const INDIRECT_PRONOUNS: IndirectPronoun[] = ['me', 'te', 'le', 'nos', 'les'];

export { DIRECT_PRONOUNS, INDIRECT_PRONOUNS };

// --- Pronombres reflexivos ---
//
// El reflexivo depende de la persona del sujeto: la acción recae sobre el mismo
// sujeto ("Yo me ducho", "Ella se levanta"). En el nivel BASE se practica la
// concordancia sujeto→pronombre, el contraste reflexivo/no reflexivo y las
// partes del cuerpo con artículo; en los niveles superiores los reflexivos
// reaparecen en el Detector y en la Posición (imperativos y perífrasis).
export type ReflexivePronoun = 'me' | 'te' | 'se' | 'nos';

export const REFLEXIVE_PRON: Record<SubjectKey, ReflexivePronoun> = {
    yo: 'me',
    tu: 'te',
    el: 'se',
    nosotros: 'nos',
    ellos: 'se',
};

export const REFLEXIVE_PRONOUNS: ReflexivePronoun[] = ['me', 'te', 'se', 'nos'];

// Tema semántico de cada verbo pronominal: permite agrupar la práctica más allá
// de la rutina diaria (verbos de emoción y de cambio de estado/significado).
export type ReflexiveTheme = 'rutina' | 'emocion' | 'cambio';

// Contraste reflexivo / no reflexivo del MISMO verbo: el corazón pedagógico del
// tema. "Me despierto" (la acción vuelve al sujeto) vs. "despierto a mi hermano"
// (la acción cae sobre otro → sin reflexivo). Los cues son curados a mano para
// que cada lectura sea inequívoca.
export interface ReflexiveContrast {
    // Completa la lectura reflexiva: "Yo me despierto A LAS SIETE."
    reflexiveCue: string;
    // Complementos que fuerzan la lectura NO reflexiva: "despierto A MI HERMANO".
    // `pron` es el pronombre de OD que reemplaza al complemento (si es sustituible),
    // usado por Respuesta Rápida: "¿Despiertas a tu hermano?" → "Sí, lo despierto".
    plain: Array<{ phrase: string; pron?: DirectPronoun }>;
    // Frase didáctica que explica el contraste (se muestra en el feedback).
    note: string;
}

// Verbos pronominales (reflexivos). Guardamos el infinitivo pronominal para
// mostrarlo, el presente del verbo desnudo por sujeto (el clítico va aparte), el
// gerundio (enclisis de POSICIÓN) y las formas de imperativo/subjuntivo para los
// contextos de imperativo. Las formas con tilde se curan a mano: la acentuación
// del imperativo reflexivo es irregular ("levántate" lleva tilde, "ponte" y
// "vete" no), así que es dato, no código.
export interface ReflexiveVerb {
    infinitive: string; // forma pronominal, p.ej. "levantarse"
    forms: Record<SubjectKey, string>; // presente sin clítico: "levanto", "levantas"…
    gerundio: string; // p.ej. "levantando", "vistiendo" (el clítico va aparte)
    theme: ReflexiveTheme;
    // Imperativo afirmativo de "tú" SIN clítico, con ortografía autónoma correcta:
    // "levanta", "pon", "ve". Se usa como palabra visible en la actividad de Posición.
    imperativoTu: string;
    // Imperativo afirmativo de "tú" YA con clítico y tilde curados:
    // "levántate", "ponte", "vete".
    imperativoTuRefl: string;
    // Presente de subjuntivo de "tú" para el imperativo negativo: "no te levantes".
    subjuntivoTu: string;
    contrast?: ReflexiveContrast;
    // Partes del cuerpo con las que el verbo se combina: "me lavo las manos".
    // Siempre con artículo (nunca posesivo): el reflexivo ya marca el poseedor.
    bodyParts?: string[];
    // True si el verbo suena incompleto sin complemento ("él se pone." ✗): se
    // excluye de las plantillas que usan el verbo desnudo (concordancia, posición,
    // volteos) y se practica solo donde lleva complemento (contraste, cuerpo).
    needsComplement?: boolean;
}

export const REFLEXIVE_VERBS: ReflexiveVerb[] = [
    {
        infinitive: 'levantarse', theme: 'rutina',
        forms: { yo: 'levanto', tu: 'levantas', el: 'levanta', nosotros: 'levantamos', ellos: 'levantan' },
        gerundio: 'levantando', imperativoTu: 'levanta', imperativoTuRefl: 'levántate', subjuntivoTu: 'levantes',
        contrast: {
            reflexiveCue: 'muy temprano',
            plain: [{ phrase: 'al bebé de la cuna', pron: 'lo' }, { phrase: 'la caja del suelo', pron: 'la' }],
            note: '«Me levanto» = salgo de la cama; «levanto la caja» = la acción cae sobre otra cosa: sin reflexivo.',
        },
    },
    {
        infinitive: 'ducharse', theme: 'rutina',
        forms: { yo: 'ducho', tu: 'duchas', el: 'ducha', nosotros: 'duchamos', ellos: 'duchan' },
        gerundio: 'duchando', imperativoTu: 'ducha', imperativoTuRefl: 'dúchate', subjuntivoTu: 'duches',
        contrast: {
            reflexiveCue: 'con agua fría',
            plain: [{ phrase: 'al perro en el patio', pron: 'lo' }, { phrase: 'al bebé con cuidado', pron: 'lo' }],
            note: '«Me ducho» = el agua cae sobre mí; «ducho al perro» = otro recibe la ducha: sin reflexivo.',
        },
    },
    {
        infinitive: 'despertarse', theme: 'rutina',
        forms: { yo: 'despierto', tu: 'despiertas', el: 'despierta', nosotros: 'despertamos', ellos: 'despiertan' },
        gerundio: 'despertando', imperativoTu: 'despierta', imperativoTuRefl: 'despiértate', subjuntivoTu: 'despiertes',
        contrast: {
            reflexiveCue: 'a las siete',
            plain: [{ phrase: 'a tu hermano', pron: 'lo' }, { phrase: 'a la niña', pron: 'la' }, { phrase: 'a los vecinos', pron: 'los' }],
            note: '«Me despierto» = yo abro los ojos; «despierto a mi hermano» = la acción cae sobre OTRA persona: sin reflexivo.',
        },
    },
    {
        infinitive: 'acostarse', theme: 'rutina',
        forms: { yo: 'acuesto', tu: 'acuestas', el: 'acuesta', nosotros: 'acostamos', ellos: 'acuestan' },
        gerundio: 'acostando', imperativoTu: 'acuesta', imperativoTuRefl: 'acuéstate', subjuntivoTu: 'acuestes',
        contrast: {
            reflexiveCue: 'antes de medianoche',
            plain: [{ phrase: 'al bebé en la cuna', pron: 'lo' }, { phrase: 'a los niños temprano', pron: 'los' }],
            note: '«Me acuesto» = voy a mi cama; «acuesto al bebé» = pongo a OTRO en la cama: sin reflexivo.',
        },
    },
    {
        infinitive: 'vestirse', theme: 'rutina',
        forms: { yo: 'visto', tu: 'vistes', el: 'viste', nosotros: 'vestimos', ellos: 'visten' },
        gerundio: 'vistiendo', imperativoTu: 'viste', imperativoTuRefl: 'vístete', subjuntivoTu: 'vistas',
        contrast: {
            reflexiveCue: 'en cinco minutos',
            plain: [{ phrase: 'al niño para la escuela', pron: 'lo' }, { phrase: 'a las gemelas', pron: 'las' }],
            note: '«Me visto» = pongo ropa sobre mi cuerpo; «visto al niño» = la ropa va sobre OTRO: sin reflexivo.',
        },
    },
    {
        infinitive: 'peinarse', theme: 'rutina',
        forms: { yo: 'peino', tu: 'peinas', el: 'peina', nosotros: 'peinamos', ellos: 'peinan' },
        gerundio: 'peinando', imperativoTu: 'peina', imperativoTuRefl: 'péinate', subjuntivoTu: 'peines',
        contrast: {
            reflexiveCue: 'frente al espejo',
            plain: [{ phrase: 'a tu hija antes de salir', pron: 'la' }, { phrase: 'al cliente', pron: 'lo' }],
            note: '«Me peino» = mi propio pelo; «peino a mi hija» = el pelo de OTRA persona: sin reflexivo.',
        },
    },
    {
        infinitive: 'sentarse', theme: 'cambio',
        forms: { yo: 'siento', tu: 'sientas', el: 'sienta', nosotros: 'sentamos', ellos: 'sientan' },
        gerundio: 'sentando', imperativoTu: 'sienta', imperativoTuRefl: 'siéntate', subjuntivoTu: 'sientes',
    },
    {
        infinitive: 'bañarse', theme: 'rutina',
        forms: { yo: 'baño', tu: 'bañas', el: 'baña', nosotros: 'bañamos', ellos: 'bañan' },
        gerundio: 'bañando', imperativoTu: 'baña', imperativoTuRefl: 'báñate', subjuntivoTu: 'bañes',
        contrast: {
            reflexiveCue: 'en el mar',
            plain: [{ phrase: 'al perro los domingos', pron: 'lo' }, { phrase: 'al bebé por la noche', pron: 'lo' }],
            note: '«Me baño» = yo entro al agua; «baño al perro» = otro recibe el baño: sin reflexivo.',
        },
    },
    {
        infinitive: 'lavarse', theme: 'rutina',
        forms: { yo: 'lavo', tu: 'lavas', el: 'lava', nosotros: 'lavamos', ellos: 'lavan' },
        gerundio: 'lavando', imperativoTu: 'lava', imperativoTuRefl: 'lávate', subjuntivoTu: 'laves',
        contrast: {
            reflexiveCue: 'con agua fría',
            plain: [{ phrase: 'al perro', pron: 'lo' }, { phrase: 'el coche los sábados', pron: 'lo' }, { phrase: 'los platos', pron: 'los' }],
            note: 'Con pronombre, la acción recae sobre uno mismo («me lavo»); sin pronombre, sobre otra cosa («lavo el coche»).',
        },
        bodyParts: ['las manos', 'la cara', 'el pelo'],
    },
    {
        infinitive: 'maquillarse', theme: 'rutina',
        forms: { yo: 'maquillo', tu: 'maquillas', el: 'maquilla', nosotros: 'maquillamos', ellos: 'maquillan' },
        gerundio: 'maquillando', imperativoTu: 'maquilla', imperativoTuRefl: 'maquíllate', subjuntivoTu: 'maquilles',
    },
    {
        infinitive: 'afeitarse', theme: 'rutina',
        forms: { yo: 'afeito', tu: 'afeitas', el: 'afeita', nosotros: 'afeitamos', ellos: 'afeitan' },
        gerundio: 'afeitando', imperativoTu: 'afeita', imperativoTuRefl: 'aféitate', subjuntivoTu: 'afeites',
        bodyParts: ['la barba', 'la cabeza'],
    },
    {
        infinitive: 'secarse', theme: 'rutina',
        forms: { yo: 'seco', tu: 'secas', el: 'seca', nosotros: 'secamos', ellos: 'secan' },
        gerundio: 'secando', imperativoTu: 'seca', imperativoTuRefl: 'sécate', subjuntivoTu: 'seques',
        contrast: {
            reflexiveCue: 'con la toalla',
            plain: [{ phrase: 'los platos después de comer', pron: 'los' }, { phrase: 'la ropa al sol', pron: 'la' }],
            note: '«Me seco» = quito el agua de mi cuerpo; «seco los platos» = el agua está en otra cosa: sin reflexivo.',
        },
        bodyParts: ['el pelo', 'las manos'],
    },
    {
        infinitive: 'ponerse', theme: 'rutina',
        forms: { yo: 'pongo', tu: 'pones', el: 'pone', nosotros: 'ponemos', ellos: 'ponen' },
        gerundio: 'poniendo', imperativoTu: 'pon', imperativoTuRefl: 'ponte', subjuntivoTu: 'pongas',
        needsComplement: true,
        contrast: {
            reflexiveCue: 'la chaqueta para salir',
            plain: [{ phrase: 'la mesa para la cena', pron: 'la' }, { phrase: 'las llaves en el cajón', pron: 'las' }],
            note: '«Me pongo la chaqueta» = la ropa va sobre mi cuerpo; «pongo la mesa» = coloco algo fuera de mí: sin reflexivo.',
        },
    },
    {
        infinitive: 'quitarse', theme: 'rutina',
        forms: { yo: 'quito', tu: 'quitas', el: 'quita', nosotros: 'quitamos', ellos: 'quitan' },
        gerundio: 'quitando', imperativoTu: 'quita', imperativoTuRefl: 'quítate', subjuntivoTu: 'quites',
        needsComplement: true,
        contrast: {
            reflexiveCue: 'los zapatos al entrar',
            plain: [{ phrase: 'los platos de la mesa', pron: 'los' }, { phrase: 'el cartel de la pared', pron: 'lo' }],
            note: '«Me quito los zapatos» = ropa que sale de mi cuerpo; «quito los platos» = algo fuera de mí: sin reflexivo.',
        },
    },
    {
        infinitive: 'quedarse', theme: 'cambio',
        forms: { yo: 'quedo', tu: 'quedas', el: 'queda', nosotros: 'quedamos', ellos: 'quedan' },
        gerundio: 'quedando', imperativoTu: 'queda', imperativoTuRefl: 'quédate', subjuntivoTu: 'quedes',
    },
    {
        infinitive: 'prepararse', theme: 'rutina',
        forms: { yo: 'preparo', tu: 'preparas', el: 'prepara', nosotros: 'preparamos', ellos: 'preparan' },
        gerundio: 'preparando', imperativoTu: 'prepara', imperativoTuRefl: 'prepárate', subjuntivoTu: 'prepares',
        contrast: {
            reflexiveCue: 'para el examen',
            plain: [{ phrase: 'a los alumnos para la prueba', pron: 'los' }, { phrase: 'al equipo para la final', pron: 'lo' }],
            note: '«Me preparo» = yo mismo; «preparo a los alumnos» = la acción cae sobre OTROS: sin reflexivo.',
        },
    },
    {
        infinitive: 'relajarse', theme: 'emocion',
        forms: { yo: 'relajo', tu: 'relajas', el: 'relaja', nosotros: 'relajamos', ellos: 'relajan' },
        gerundio: 'relajando', imperativoTu: 'relaja', imperativoTuRefl: 'relájate', subjuntivoTu: 'relajes',
    },
    {
        infinitive: 'cepillarse', theme: 'rutina',
        forms: { yo: 'cepillo', tu: 'cepillas', el: 'cepilla', nosotros: 'cepillamos', ellos: 'cepillan' },
        gerundio: 'cepillando', imperativoTu: 'cepilla', imperativoTuRefl: 'cepíllate', subjuntivoTu: 'cepilles',
        needsComplement: true,
        bodyParts: ['los dientes', 'el pelo'],
    },
    {
        infinitive: 'dormirse', theme: 'cambio',
        forms: { yo: 'duermo', tu: 'duermes', el: 'duerme', nosotros: 'dormimos', ellos: 'duermen' },
        gerundio: 'durmiendo', imperativoTu: 'duerme', imperativoTuRefl: 'duérmete', subjuntivoTu: 'duermas',
        contrast: {
            reflexiveCue: 'en el sofá viendo la tele',
            plain: [{ phrase: 'muy poco entre semana' }, { phrase: 'ocho horas cada noche' }],
            note: '«Dormir» es estar dormido; «dormirse» es EMPEZAR a dormir. El pronombre cambia el significado.',
        },
    },
    {
        infinitive: 'irse', theme: 'cambio',
        forms: { yo: 'voy', tu: 'vas', el: 'va', nosotros: 'vamos', ellos: 'van' },
        gerundio: 'yendo', imperativoTu: 've', imperativoTuRefl: 'vete', subjuntivoTu: 'vayas',
    },
    {
        infinitive: 'enojarse', theme: 'emocion',
        forms: { yo: 'enojo', tu: 'enojas', el: 'enoja', nosotros: 'enojamos', ellos: 'enojan' },
        gerundio: 'enojando', imperativoTu: 'enoja', imperativoTuRefl: 'enójate', subjuntivoTu: 'enojes',
        contrast: {
            reflexiveCue: 'con el tráfico',
            plain: [{ phrase: 'a tu hermana con bromas', pron: 'la' }, { phrase: 'al profesor', pron: 'lo' }],
            note: '«Me enojo» = la emoción es mía; «enojo a mi hermana» = provoco la emoción en OTRA persona: sin reflexivo.',
        },
    },
    {
        infinitive: 'aburrirse', theme: 'emocion',
        forms: { yo: 'aburro', tu: 'aburres', el: 'aburre', nosotros: 'aburrimos', ellos: 'aburren' },
        gerundio: 'aburriendo', imperativoTu: 'aburre', imperativoTuRefl: 'abúrrete', subjuntivoTu: 'aburras',
        contrast: {
            reflexiveCue: 'en las reuniones largas',
            plain: [{ phrase: 'a los alumnos con teoría', pron: 'los' }, { phrase: 'al público', pron: 'lo' }],
            note: '«Me aburro» = el aburrimiento es mío; «aburro a los alumnos» = lo provoco en OTROS: sin reflexivo.',
        },
    },
    {
        infinitive: 'divertirse', theme: 'emocion',
        forms: { yo: 'divierto', tu: 'diviertes', el: 'divierte', nosotros: 'divertimos', ellos: 'divierten' },
        gerundio: 'divirtiendo', imperativoTu: 'divierte', imperativoTuRefl: 'diviértete', subjuntivoTu: 'diviertas',
        contrast: {
            reflexiveCue: 'en la fiesta',
            plain: [{ phrase: 'a los niños con juegos', pron: 'los' }, { phrase: 'a la gente con chistes', pron: 'la' }],
            note: '«Me divierto» = la diversión es mía; «divierto a los niños» = la provoco en OTROS: sin reflexivo.',
        },
    },
];

// Verbos aptos para las plantillas que usan el verbo desnudo, sin complemento
// ("Yo me levanto.", "¡Ana, dúchate!"). Los que exigen complemento (ponerse,
// quitarse, cepillarse) se practican en contraste, cuerpo y sus perífrasis.
export const BARE_REFLEXIVE_VERBS: ReflexiveVerb[] = REFLEXIVE_VERBS.filter(v => !v.needsComplement);

// --- REGLA DE COMBINACIÓN (única fuente de verdad) ---
//
// Combina el pronombre de OI con el de OD respetando el orden OI + OD y la regla
// "le/les + lo/la/los/las" → "se + lo/la/los/las".
export const resolverCluster = (oiPron: IndirectPronoun, odPron: DirectPronoun): string => {
    const oi = oiPron === 'le' || oiPron === 'les' ? 'se' : oiPron;
    return `${oi} ${odPron}`;
};

// --- CAPA SEMÁNTICA (evita frases absurdas sin perder generación infinita) ---
//
// El generador combina verbo/OD/OI al azar; sin criterio salen frases sin sentido
// ("cantar el coche", "repetir la factura"). Estas dos reglas podan solo el rincón
// implausible: el espacio combinatorio válido sigue siendo de miles de frases.

// Objetos directos que el verbo admite semánticamente: basta compartir una tag.
export const compatibleObjects = (verb: Verb): DirectObject[] =>
    DIRECT_OBJECTS.filter(od => od.tags.some(t => verb.accepts.includes(t)));

// Objeto indirecto que correfiere con cada sujeto (mismo referente → exigiría un
// reflexivo, no un clítico normal): "Él … a él", "Nosotros … a nosotros".
const COREFERENT_OI: Record<SubjectKey, string> = {
    yo: 'a mí',
    tu: 'a ti',
    el: 'a él',
    nosotros: 'a nosotros',
    ellos: 'a ellos',
};

// True si sujeto y OI refieren a la misma persona. Se compara por `subject.key`
// (no por el pronombre mostrado): aunque el sujeto quede implícito, la conjugación
// ya fija la persona ("Repetimos … a nosotros" también es correferente).
export const corefiere = (subjectKey: SubjectKey, oi: IndirectObject): boolean =>
    COREFERENT_OI[subjectKey] === oi.phrase;

// --- POSICIÓN DE CLÍTICOS (Actividad #6) ---
//
// Enclisis: el pronombre se PEGA al verbo no finito o al imperativo afirmativo.
// Como solo usamos clústeres dobles ("se lo", "me lo"…), la palabra resultante es
// siempre esdrújula o sobreesdrújula → la tilde es OBLIGATORIA. Por eso basta con
// acentuar la vocal tónica de la base y concatenar los clíticos sin espacios.

// Infinitivo: -ar/-er/-ir → -ár/-ér/-ír ("dar"→"dár", "vender"→"vendér").
const accentInfinitive = (inf: string): string =>
    inf.replace(/ar$/, 'ár').replace(/er$/, 'ér').replace(/ir$/, 'ír');

// Gerundio: -ando/-iendo/-yendo → -ándo/-iéndo/-yéndo
// ("dando"→"dándo", "pidiendo"→"pidiéndo", "leyendo"→"leyéndo").
const accentGerund = (ger: string): string =>
    ger.replace(/ando$/, 'ándo').replace(/yendo$/, 'yéndo').replace(/iendo$/, 'iéndo');

export type EncliticKind = 'inf' | 'ger' | 'imp';

// Une una forma verbal con el clúster de clíticos en posición enclítica.
// p.ej. ('inf', dar, 'se lo') → "dárselo"; ('ger', leer, 'se lo') → "leyéndoselo".
export const attachEnclitic = (kind: EncliticKind, verb: Verb, cluster: string): string => {
    const clitics = cluster.replace(/\s+/g, '');
    let base: string;
    if (kind === 'inf') base = accentInfinitive(verb.infinitive);
    else if (kind === 'ger') base = accentGerund(verb.gerundio);
    else base = verb.imperativoTu;
    return `${base}${clitics}`;
};

// Une una forma verbal con UN SOLO clítico (nivel BASE). A diferencia de la
// versión doble, la acentuación cambia según la forma:
//  - Infinitivo + 1 clítico → palabra LLANA, sin tilde ("dar"+"lo" = "darlo").
//  - Gerundio + 1 clítico  → palabra ESDRÚJULA, con tilde ("dando"+"lo" = "dándolo").
// El imperativo no se usa en BASE (queda para niveles superiores), pero se cubre
// con la forma ya acentuada para consistencia.
export const attachEncliticSingle = (kind: EncliticKind, verb: Verb, clitic: string): string => {
    if (kind === 'inf') return `${verb.infinitive}${clitic}`;
    if (kind === 'ger') return `${accentGerund(verb.gerundio)}${clitic}`;
    return `${verb.imperativoTu}${clitic}`;
};

// Infinitivo pronominal ("levantarse") → raíz sin el "se" ("levantar"), para
// reconstruir la enclisis con el clítico que corresponde al sujeto.
export const bareReflexiveInfinitive = (inf: string): string => inf.replace(/se$/, '');

// Enclisis de UN clítico reflexivo, análoga a `attachEncliticSingle`:
//  - Infinitivo + 1 clítico → palabra LLANA, sin tilde ("levantar"+"se" = "levantarse").
//  - Gerundio + 1 clítico  → palabra ESDRÚJULA, con tilde ("levantando"+"se" = "levantándose").
//  - Imperativo afirmativo → forma curada a mano (solo existe para "tú" → "te"):
//    la acentuación es irregular ("levántate" lleva tilde; "ponte" y "vete" no).
export const attachReflexiveEnclitic = (kind: EncliticKind, verb: ReflexiveVerb, pron: ReflexivePronoun): string => {
    if (kind === 'ger') return `${accentGerund(verb.gerundio)}${pron}`;
    if (kind === 'imp') return verb.imperativoTuRefl;
    return `${bareReflexiveInfinitive(verb.infinitive)}${pron}`;
};

// --- Banco de perífrasis verbales (auxiliar finito + verbo no finito) ---
// En estas estructuras la posición es DOBLE: el pronombre puede ir proclítico al
// auxiliar ("se lo quiere dar") o enclítico al no finito ("quiere dárselo").
export interface Periphrasis {
    // Palabra(s) del auxiliar finito (incluye nexo si aplica: "va a", "tiene que").
    pre: string;
    kind: EncliticKind; // 'inf' o 'ger' (el no finito que rige)
}

export const PERIPHRASES: Periphrasis[] = [
    { pre: 'quiere', kind: 'inf' },
    { pre: 'puede', kind: 'inf' },
    { pre: 'va a', kind: 'inf' },
    { pre: 'tiene que', kind: 'inf' },
    { pre: 'acaba de', kind: 'inf' },
    { pre: 'está', kind: 'ger' },
    { pre: 'sigue', kind: 'ger' },
];
