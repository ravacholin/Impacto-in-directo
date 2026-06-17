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
export interface Verb {
    infinitive: string;
    forms: Record<SubjectKey, string>;
}

export const VERBS: Verb[] = [
    { infinitive: 'dar', forms: { yo: 'doy', tu: 'das', el: 'da', nosotros: 'damos', ellos: 'dan' } },
    { infinitive: 'mostrar', forms: { yo: 'muestro', tu: 'muestras', el: 'muestra', nosotros: 'mostramos', ellos: 'muestran' } },
    { infinitive: 'enviar', forms: { yo: 'envío', tu: 'envías', el: 'envía', nosotros: 'enviamos', ellos: 'envían' } },
    { infinitive: 'prestar', forms: { yo: 'presto', tu: 'prestas', el: 'presta', nosotros: 'prestamos', ellos: 'prestan' } },
    { infinitive: 'comprar', forms: { yo: 'compro', tu: 'compras', el: 'compra', nosotros: 'compramos', ellos: 'compran' } },
    { infinitive: 'traer', forms: { yo: 'traigo', tu: 'traes', el: 'trae', nosotros: 'traemos', ellos: 'traen' } },
    { infinitive: 'explicar', forms: { yo: 'explico', tu: 'explicas', el: 'explica', nosotros: 'explicamos', ellos: 'explican' } },
    { infinitive: 'contar', forms: { yo: 'cuento', tu: 'cuentas', el: 'cuenta', nosotros: 'contamos', ellos: 'cuentan' } },
    { infinitive: 'vender', forms: { yo: 'vendo', tu: 'vendes', el: 'vende', nosotros: 'vendemos', ellos: 'venden' } },
    { infinitive: 'regalar', forms: { yo: 'regalo', tu: 'regalas', el: 'regala', nosotros: 'regalamos', ellos: 'regalan' } },
    { infinitive: 'escribir', forms: { yo: 'escribo', tu: 'escribes', el: 'escribe', nosotros: 'escribimos', ellos: 'escriben' } },
    { infinitive: 'leer', forms: { yo: 'leo', tu: 'lees', el: 'lee', nosotros: 'leemos', ellos: 'leen' } },
    { infinitive: 'mandar', forms: { yo: 'mando', tu: 'mandas', el: 'manda', nosotros: 'mandamos', ellos: 'mandan' } },
    { infinitive: 'entregar', forms: { yo: 'entrego', tu: 'entregas', el: 'entrega', nosotros: 'entregamos', ellos: 'entregan' } },
    { infinitive: 'ofrecer', forms: { yo: 'ofrezco', tu: 'ofreces', el: 'ofrece', nosotros: 'ofrecemos', ellos: 'ofrecen' } },
    { infinitive: 'devolver', forms: { yo: 'devuelvo', tu: 'devuelves', el: 'devuelve', nosotros: 'devolvemos', ellos: 'devuelven' } },
    { infinitive: 'recomendar', forms: { yo: 'recomiendo', tu: 'recomiendas', el: 'recomienda', nosotros: 'recomendamos', ellos: 'recomiendan' } },
    { infinitive: 'servir', forms: { yo: 'sirvo', tu: 'sirves', el: 'sirve', nosotros: 'servimos', ellos: 'sirven' } },
    { infinitive: 'enseñar', forms: { yo: 'enseño', tu: 'enseñas', el: 'enseña', nosotros: 'enseñamos', ellos: 'enseñan' } },
    { infinitive: 'dejar', forms: { yo: 'dejo', tu: 'dejas', el: 'deja', nosotros: 'dejamos', ellos: 'dejan' } },
    { infinitive: 'llevar', forms: { yo: 'llevo', tu: 'llevas', el: 'lleva', nosotros: 'llevamos', ellos: 'llevan' } },
    { infinitive: 'presentar', forms: { yo: 'presento', tu: 'presentas', el: 'presenta', nosotros: 'presentamos', ellos: 'presentan' } },
    { infinitive: 'describir', forms: { yo: 'describo', tu: 'describes', el: 'describe', nosotros: 'describimos', ellos: 'describen' } },
    { infinitive: 'repetir', forms: { yo: 'repito', tu: 'repites', el: 'repite', nosotros: 'repetimos', ellos: 'repiten' } },
    { infinitive: 'preparar', forms: { yo: 'preparo', tu: 'preparas', el: 'prepara', nosotros: 'preparamos', ellos: 'preparan' } },
    { infinitive: 'pedir', forms: { yo: 'pido', tu: 'pides', el: 'pide', nosotros: 'pedimos', ellos: 'piden' } },
    { infinitive: 'dedicar', forms: { yo: 'dedico', tu: 'dedicas', el: 'dedica', nosotros: 'dedicamos', ellos: 'dedican' } },
    { infinitive: 'cantar', forms: { yo: 'canto', tu: 'cantas', el: 'canta', nosotros: 'cantamos', ellos: 'cantan' } },
    { infinitive: 'pasar', forms: { yo: 'paso', tu: 'pasas', el: 'pasa', nosotros: 'pasamos', ellos: 'pasan' } },
    { infinitive: 'comunicar', forms: { yo: 'comunico', tu: 'comunicas', el: 'comunica', nosotros: 'comunicamos', ellos: 'comunican' } },
];

// --- Objetos directos (OD) con su pronombre según género y número ---
export type DirectPronoun = 'lo' | 'la' | 'los' | 'las';

export interface DirectObject {
    phrase: string; // "el libro"
    pron: DirectPronoun;
}

export const DIRECT_OBJECTS: DirectObject[] = [
    { phrase: 'el libro', pron: 'lo' },
    { phrase: 'el regalo', pron: 'lo' },
    { phrase: 'el dinero', pron: 'lo' },
    { phrase: 'el informe', pron: 'lo' },
    { phrase: 'el coche', pron: 'lo' },
    { phrase: 'el mensaje', pron: 'lo' },
    { phrase: 'el paquete', pron: 'lo' },
    { phrase: 'el secreto', pron: 'lo' },
    { phrase: 'el cuaderno', pron: 'lo' },
    { phrase: 'el teléfono', pron: 'lo' },
    { phrase: 'la carta', pron: 'la' },
    { phrase: 'la noticia', pron: 'la' },
    { phrase: 'la verdad', pron: 'la' },
    { phrase: 'la receta', pron: 'la' },
    { phrase: 'la foto', pron: 'la' },
    { phrase: 'la canción', pron: 'la' },
    { phrase: 'la dirección', pron: 'la' },
    { phrase: 'la maleta', pron: 'la' },
    { phrase: 'la historia', pron: 'la' },
    { phrase: 'la factura', pron: 'la' },
    { phrase: 'los documentos', pron: 'los' },
    { phrase: 'los libros', pron: 'los' },
    { phrase: 'los regalos', pron: 'los' },
    { phrase: 'los billetes', pron: 'los' },
    { phrase: 'los apuntes', pron: 'los' },
    { phrase: 'los resultados', pron: 'los' },
    { phrase: 'las llaves', pron: 'las' },
    { phrase: 'las flores', pron: 'las' },
    { phrase: 'las fotos', pron: 'las' },
    { phrase: 'las cartas', pron: 'las' },
    { phrase: 'las noticias', pron: 'las' },
    { phrase: 'las instrucciones', pron: 'las' },
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

// --- REGLA DE COMBINACIÓN (única fuente de verdad) ---
//
// Combina el pronombre de OI con el de OD respetando el orden OI + OD y la regla
// "le/les + lo/la/los/las" → "se + lo/la/los/las".
export const resolverCluster = (oiPron: IndirectPronoun, odPron: DirectPronoun): string => {
    const oi = oiPron === 'le' || oiPron === 'les' ? 'se' : oiPron;
    return `${oi} ${odPron}`;
};
