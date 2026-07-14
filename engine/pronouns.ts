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

// --- Pronombres reflexivos (nivel BASE) ---
//
// El reflexivo depende de la persona del sujeto: la acción recae sobre el mismo
// sujeto ("Yo me ducho", "Ella se levanta"). Solo se usan en el nivel 1, en la
// actividad Pop-up, para reconocer la forma que corresponde a cada sujeto.
export type ReflexivePronoun = 'me' | 'te' | 'se' | 'nos';

export const REFLEXIVE_PRON: Record<SubjectKey, ReflexivePronoun> = {
    yo: 'me',
    tu: 'te',
    el: 'se',
    nosotros: 'nos',
    ellos: 'se',
};

export const REFLEXIVE_PRONOUNS: ReflexivePronoun[] = ['me', 'te', 'se', 'nos'];

// Verbos pronominales (reflexivos). Guardamos el infinitivo pronominal para
// mostrarlo, el presente del verbo desnudo por sujeto (el clítico va aparte) y el
// gerundio (para la enclisis de la actividad de POSICIÓN).
export interface ReflexiveVerb {
    infinitive: string; // forma pronominal, p.ej. "levantarse"
    forms: Record<SubjectKey, string>; // presente sin clítico: "levanto", "levantas"…
    gerundio: string; // p.ej. "levantando", "vistiendo" (el clítico va aparte)
}

export const REFLEXIVE_VERBS: ReflexiveVerb[] = [
    { infinitive: 'levantarse', forms: { yo: 'levanto', tu: 'levantas', el: 'levanta', nosotros: 'levantamos', ellos: 'levantan' }, gerundio: 'levantando' },
    { infinitive: 'ducharse', forms: { yo: 'ducho', tu: 'duchas', el: 'ducha', nosotros: 'duchamos', ellos: 'duchan' }, gerundio: 'duchando' },
    { infinitive: 'despertarse', forms: { yo: 'despierto', tu: 'despiertas', el: 'despierta', nosotros: 'despertamos', ellos: 'despiertan' }, gerundio: 'despertando' },
    { infinitive: 'acostarse', forms: { yo: 'acuesto', tu: 'acuestas', el: 'acuesta', nosotros: 'acostamos', ellos: 'acuestan' }, gerundio: 'acostando' },
    { infinitive: 'vestirse', forms: { yo: 'visto', tu: 'vistes', el: 'viste', nosotros: 'vestimos', ellos: 'visten' }, gerundio: 'vistiendo' },
    { infinitive: 'peinarse', forms: { yo: 'peino', tu: 'peinas', el: 'peina', nosotros: 'peinamos', ellos: 'peinan' }, gerundio: 'peinando' },
    { infinitive: 'sentarse', forms: { yo: 'siento', tu: 'sientas', el: 'sienta', nosotros: 'sentamos', ellos: 'sientan' }, gerundio: 'sentando' },
    { infinitive: 'bañarse', forms: { yo: 'baño', tu: 'bañas', el: 'baña', nosotros: 'bañamos', ellos: 'bañan' }, gerundio: 'bañando' },
    { infinitive: 'lavarse', forms: { yo: 'lavo', tu: 'lavas', el: 'lava', nosotros: 'lavamos', ellos: 'lavan' }, gerundio: 'lavando' },
    { infinitive: 'maquillarse', forms: { yo: 'maquillo', tu: 'maquillas', el: 'maquilla', nosotros: 'maquillamos', ellos: 'maquillan' }, gerundio: 'maquillando' },
    { infinitive: 'afeitarse', forms: { yo: 'afeito', tu: 'afeitas', el: 'afeita', nosotros: 'afeitamos', ellos: 'afeitan' }, gerundio: 'afeitando' },
    { infinitive: 'secarse', forms: { yo: 'seco', tu: 'secas', el: 'seca', nosotros: 'secamos', ellos: 'secan' }, gerundio: 'secando' },
    { infinitive: 'ponerse', forms: { yo: 'pongo', tu: 'pones', el: 'pone', nosotros: 'ponemos', ellos: 'ponen' }, gerundio: 'poniendo' },
    { infinitive: 'quitarse', forms: { yo: 'quito', tu: 'quitas', el: 'quita', nosotros: 'quitamos', ellos: 'quitan' }, gerundio: 'quitando' },
    { infinitive: 'quedarse', forms: { yo: 'quedo', tu: 'quedas', el: 'queda', nosotros: 'quedamos', ellos: 'quedan' }, gerundio: 'quedando' },
    { infinitive: 'prepararse', forms: { yo: 'preparo', tu: 'preparas', el: 'prepara', nosotros: 'preparamos', ellos: 'preparan' }, gerundio: 'preparando' },
    { infinitive: 'relajarse', forms: { yo: 'relajo', tu: 'relajas', el: 'relaja', nosotros: 'relajamos', ellos: 'relajan' }, gerundio: 'relajando' },
];

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

// Enclisis de UN clítico reflexivo (nivel BASE), análoga a `attachEncliticSingle`:
//  - Infinitivo + 1 clítico → palabra LLANA, sin tilde ("levantar"+"se" = "levantarse").
//  - Gerundio + 1 clítico  → palabra ESDRÚJULA, con tilde ("levantando"+"se" = "levantándose").
// El imperativo no se usa con reflexivos en BASE; se cubre con la raíz llana por
// consistencia.
export const attachReflexiveEnclitic = (kind: EncliticKind, verb: ReflexiveVerb, pron: ReflexivePronoun): string => {
    if (kind === 'ger') return `${accentGerund(verb.gerundio)}${pron}`;
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
