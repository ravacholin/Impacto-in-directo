// Motor de pronombres de objeto (OD/OI) del español.
//
// Este módulo concentra TODO el conocimiento lingüístico: los bancos de palabras
// curados (verbos, objetos, personas, adverbiales y leads) y la regla de
// combinación de pronombres. No hay IA ni red: a partir de estos datos el
// generador produce un repertorio prácticamente infinito de ejercicios correctos.
//
// Cada palabra lleva un `level` (1 BASE / 2 INTERMEDIO / 3 AVANZADO): es el nivel
// MÍNIMO en el que entra al pool de generación. Los pools son ACUMULATIVOS
// (nivel elegido >= level de la palabra), así el vocabulario crece con el nivel
// sin perder las palabras básicas.

import type { Difficulty } from '../types';

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

// --- Capa semántica: tags de objeto directo ---
//
// Cada tag es una CLASE SELECCIONAL: si un verbo acepta el tag T, DEBE formar una
// frase natural con TODOS los objetos etiquetados T (chequeo de columna). Cuando
// un par verbo+objeto de la misma columna suena mal, el tag está demasiado ancho
// y se divide — nunca se estira. Los tags son baratos; las frases absurdas, no.
// Los tests (`engine.test.ts`) verifican una blacklist de pares conocidos.
export type ODTag =
    | 'objeto'     // cosa física prestable/entregable: llaves, maleta, paraguas, cuaderno
    | 'regalo'     // regalable: regalo, flores, bombones, perfume (y juguete, libro…)
    | 'compra'     // comprable/vendible: ropa, entradas, ordenador, teléfono
    | 'vehiculo'   // coche, moto, bicicleta (comprar/vender/prestar/alquilar, NO enviar)
    | 'envio'      // enviable como bulto: paquete, sobre, caja (NO prestar)
    | 'documento'  // papel oficial firmable/revisable: informe, contrato, factura, formulario
    | 'texto'      // escrito personal: carta, mensaje, correo, lista, apuntes
    | 'lectura'    // legible de biblioteca: libro, novela, revista, periódico, diccionario
    | 'obra'       // obra cultural recomendable: novela, película, serie, disco, canción
    | 'cancion'    // cantable/dedicable: la canción, las canciones
    | 'imagen'     // mostrable/describible: foto, dibujo, vídeo, cartel
    | 'comida'     // cocinable/servible: pastel, cena, sopa, pizza, tortilla
    | 'bebida'     // servible/preparable pero NO cocinable: café, té, vino, zumo
    | 'dinero'     // efectivo prestable: el dinero, los euros, el cambio
    | 'pago'       // cobrable entre personas: factura, cuenta, alquiler
    | 'deuda'      // pagable/debible pero no cobrable al OI: sueldo, préstamo, propina
    | 'noticia'    // información anunciable: noticia, resultados, plan, decisión
    | 'dato'       // dato puntual decible: dirección, fecha, número, precio, hora, nombre
    | 'relato'     // narrable: historia, cuento, chiste, anécdota, leyenda
    | 'indicacion' // explicable paso a paso: instrucciones, receta, reglas
    | 'tarea'      // corregible/entregable escolar: tarea, ejercicio, deberes, examen
    | 'secreto'    // confesable y contable: el secreto, la verdad
    | 'culpa'      // solo confesable: el error, la mentira
    | 'consejo'    // dable/pedible: consejo, idea, ayuda
    | 'reserva';   // reservable: mesa, entradas, vuelo, habitación

// Lista runtime de los tags (para los tests de higiene: sin tags huérfanos).
export const OD_TAGS: ODTag[] = [
    'objeto', 'regalo', 'compra', 'vehiculo', 'envio', 'documento', 'texto',
    'lectura', 'obra', 'cancion', 'imagen', 'comida', 'bebida', 'dinero', 'pago',
    'deuda', 'noticia', 'dato', 'relato', 'indicacion', 'tarea', 'secreto',
    'culpa', 'consejo', 'reserva',
];

// Categoría del objeto indirecto, para vetar combinaciones verbo+OI implausibles
// ("Vendo el coche a los niños", "Confieso el secreto al cliente").
export type OICategory = 'adulto' | 'menor' | 'profesional';

// --- Verbos transitivos que admiten OD + OI de forma natural ---
// Guardamos la conjugación de presente explícita por sujeto para evitar
// cualquier bug de conjugación (sobre todo con irregulares).
export interface Verb {
    infinitive: string;
    // Nivel mínimo en el que el verbo entra al pool (léxico acumulativo).
    level: Difficulty;
    forms: Record<SubjectKey, string>;
    // Tags de OD que el verbo admite semánticamente (ver `compatibleObjects`).
    accepts: ODTag[];
    // Categorías de OI con las que el verbo NO combina de forma natural.
    oiVeto?: OICategory[];
    // Formas no finitas / imperativas necesarias para la actividad de POSICIÓN.
    // Se guardan explícitas (curadas a mano) para evitar bugs con irregulares.
    gerundio: string;       // p.ej. "dando", "leyendo", "pidiendo"
    // Imperativo afirmativo de "tú" SUELTO, con ortografía autónoma correcta:
    // "da", "trae", "di". Es la palabra visible en la actividad de Posición
    // (¡nunca `forms.el`!: en irregulares como "decir" difieren: dice ≠ di).
    imperativoTuSolo: string;
    // Imperativo afirmativo de "tú" con la TILDE ya colocada lista para clíticos.
    // Como solo combinamos clústeres dobles (p.ej. "se lo"), el enclítico siempre
    // es esdrújula/sobreesdrújula → la tilde es obligatoria. Esta forma NO se usa
    // suelta (sin clíticos no sería ortográficamente válida en monosílabos).
    imperativoTu: string;   // p.ej. "dá", "muéstra", "cómpra", "dí"
    // Presente de subjuntivo de "tú" para el imperativo negativo ("no ___ des").
    subjuntivoTu: string;   // p.ej. "des", "muestres", "compres"
}

export const VERBS: Verb[] = [
    // ---- Nivel 1 (BASE): verbos A1/A2 de alta frecuencia ----
    { infinitive: 'dar', level: 1, accepts: ['objeto', 'regalo', 'envio', 'dinero', 'dato', 'indicacion', 'consejo'], forms: { yo: 'doy', tu: 'das', el: 'da', nosotros: 'damos', ellos: 'dan' }, gerundio: 'dando', imperativoTuSolo: 'da', imperativoTu: 'dá', subjuntivoTu: 'des' },
    { infinitive: 'decir', level: 1, accepts: ['dato', 'secreto'], forms: { yo: 'digo', tu: 'dices', el: 'dice', nosotros: 'decimos', ellos: 'dicen' }, gerundio: 'diciendo', imperativoTuSolo: 'di', imperativoTu: 'dí', subjuntivoTu: 'digas' },
    { infinitive: 'comprar', level: 1, accepts: ['compra', 'regalo', 'vehiculo', 'comida', 'bebida'], forms: { yo: 'compro', tu: 'compras', el: 'compra', nosotros: 'compramos', ellos: 'compran' }, gerundio: 'comprando', imperativoTuSolo: 'compra', imperativoTu: 'cómpra', subjuntivoTu: 'compres' },
    { infinitive: 'vender', level: 1, accepts: ['compra', 'vehiculo'], oiVeto: ['menor'], forms: { yo: 'vendo', tu: 'vendes', el: 'vende', nosotros: 'vendemos', ellos: 'venden' }, gerundio: 'vendiendo', imperativoTuSolo: 'vende', imperativoTu: 'vénde', subjuntivoTu: 'vendas' },
    { infinitive: 'traer', level: 1, accepts: ['objeto', 'regalo', 'envio', 'documento', 'dinero', 'comida', 'bebida'], forms: { yo: 'traigo', tu: 'traes', el: 'trae', nosotros: 'traemos', ellos: 'traen' }, gerundio: 'trayendo', imperativoTuSolo: 'trae', imperativoTu: 'tráe', subjuntivoTu: 'traigas' },
    { infinitive: 'llevar', level: 1, accepts: ['objeto', 'regalo', 'envio', 'documento', 'dinero', 'comida', 'bebida'], forms: { yo: 'llevo', tu: 'llevas', el: 'lleva', nosotros: 'llevamos', ellos: 'llevan' }, gerundio: 'llevando', imperativoTuSolo: 'lleva', imperativoTu: 'lléva', subjuntivoTu: 'lleves' },
    { infinitive: 'enviar', level: 1, accepts: ['objeto', 'regalo', 'envio', 'documento', 'texto', 'dinero', 'imagen'], forms: { yo: 'envío', tu: 'envías', el: 'envía', nosotros: 'enviamos', ellos: 'envían' }, gerundio: 'enviando', imperativoTuSolo: 'envía', imperativoTu: 'envía', subjuntivoTu: 'envíes' },
    { infinitive: 'mandar', level: 1, accepts: ['objeto', 'regalo', 'envio', 'documento', 'texto', 'dinero', 'imagen'], forms: { yo: 'mando', tu: 'mandas', el: 'manda', nosotros: 'mandamos', ellos: 'mandan' }, gerundio: 'mandando', imperativoTuSolo: 'manda', imperativoTu: 'mánda', subjuntivoTu: 'mandes' },
    { infinitive: 'mostrar', level: 1, accepts: ['objeto', 'regalo', 'vehiculo', 'envio', 'documento', 'texto', 'imagen'], forms: { yo: 'muestro', tu: 'muestras', el: 'muestra', nosotros: 'mostramos', ellos: 'muestran' }, gerundio: 'mostrando', imperativoTuSolo: 'muestra', imperativoTu: 'muéstra', subjuntivoTu: 'muestres' },
    { infinitive: 'regalar', level: 1, accepts: ['regalo'], forms: { yo: 'regalo', tu: 'regalas', el: 'regala', nosotros: 'regalamos', ellos: 'regalan' }, gerundio: 'regalando', imperativoTuSolo: 'regala', imperativoTu: 'regála', subjuntivoTu: 'regales' },
    { infinitive: 'escribir', level: 1, accepts: ['texto'], forms: { yo: 'escribo', tu: 'escribes', el: 'escribe', nosotros: 'escribimos', ellos: 'escriben' }, gerundio: 'escribiendo', imperativoTuSolo: 'escribe', imperativoTu: 'escríbe', subjuntivoTu: 'escribas' },
    { infinitive: 'leer', level: 1, accepts: ['texto', 'documento', 'lectura'], forms: { yo: 'leo', tu: 'lees', el: 'lee', nosotros: 'leemos', ellos: 'leen' }, gerundio: 'leyendo', imperativoTuSolo: 'lee', imperativoTu: 'lée', subjuntivoTu: 'leas' },
    { infinitive: 'pedir', level: 1, accepts: ['objeto', 'dinero', 'comida', 'bebida', 'dato', 'consejo'], forms: { yo: 'pido', tu: 'pides', el: 'pide', nosotros: 'pedimos', ellos: 'piden' }, gerundio: 'pidiendo', imperativoTuSolo: 'pide', imperativoTu: 'píde', subjuntivoTu: 'pidas' },
    { infinitive: 'cantar', level: 1, accepts: ['cancion'], forms: { yo: 'canto', tu: 'cantas', el: 'canta', nosotros: 'cantamos', ellos: 'cantan' }, gerundio: 'cantando', imperativoTuSolo: 'canta', imperativoTu: 'cánta', subjuntivoTu: 'cantes' },
    { infinitive: 'cocinar', level: 1, accepts: ['comida'], forms: { yo: 'cocino', tu: 'cocinas', el: 'cocina', nosotros: 'cocinamos', ellos: 'cocinan' }, gerundio: 'cocinando', imperativoTuSolo: 'cocina', imperativoTu: 'cocína', subjuntivoTu: 'cocines' },
    { infinitive: 'servir', level: 1, accepts: ['comida', 'bebida'], forms: { yo: 'sirvo', tu: 'sirves', el: 'sirve', nosotros: 'servimos', ellos: 'sirven' }, gerundio: 'sirviendo', imperativoTuSolo: 'sirve', imperativoTu: 'sírve', subjuntivoTu: 'sirvas' },
    { infinitive: 'pagar', level: 1, accepts: ['pago', 'deuda', 'compra', 'comida', 'bebida'], forms: { yo: 'pago', tu: 'pagas', el: 'paga', nosotros: 'pagamos', ellos: 'pagan' }, gerundio: 'pagando', imperativoTuSolo: 'paga', imperativoTu: 'pága', subjuntivoTu: 'pagues' },
    { infinitive: 'preparar', level: 1, accepts: ['comida', 'bebida', 'documento', 'tarea'], forms: { yo: 'preparo', tu: 'preparas', el: 'prepara', nosotros: 'preparamos', ellos: 'preparan' }, gerundio: 'preparando', imperativoTuSolo: 'prepara', imperativoTu: 'prepára', subjuntivoTu: 'prepares' },

    // ---- Nivel 2 (INTERMEDIO): verbos B1 ----
    { infinitive: 'explicar', level: 2, accepts: ['noticia', 'indicacion', 'tarea', 'documento'], forms: { yo: 'explico', tu: 'explicas', el: 'explica', nosotros: 'explicamos', ellos: 'explican' }, gerundio: 'explicando', imperativoTuSolo: 'explica', imperativoTu: 'explíca', subjuntivoTu: 'expliques' },
    { infinitive: 'contar', level: 2, accepts: ['relato', 'noticia', 'secreto'], forms: { yo: 'cuento', tu: 'cuentas', el: 'cuenta', nosotros: 'contamos', ellos: 'cuentan' }, gerundio: 'contando', imperativoTuSolo: 'cuenta', imperativoTu: 'cuénta', subjuntivoTu: 'cuentes' },
    { infinitive: 'prestar', level: 2, accepts: ['objeto', 'vehiculo', 'dinero', 'lectura'], forms: { yo: 'presto', tu: 'prestas', el: 'presta', nosotros: 'prestamos', ellos: 'prestan' }, gerundio: 'prestando', imperativoTuSolo: 'presta', imperativoTu: 'présta', subjuntivoTu: 'prestes' },
    { infinitive: 'enseñar', level: 2, accepts: ['documento', 'imagen', 'indicacion', 'cancion'], forms: { yo: 'enseño', tu: 'enseñas', el: 'enseña', nosotros: 'enseñamos', ellos: 'enseñan' }, gerundio: 'enseñando', imperativoTuSolo: 'enseña', imperativoTu: 'enséña', subjuntivoTu: 'enseñes' },
    { infinitive: 'devolver', level: 2, accepts: ['objeto', 'vehiculo', 'documento', 'dinero', 'lectura'], forms: { yo: 'devuelvo', tu: 'devuelves', el: 'devuelve', nosotros: 'devolvemos', ellos: 'devuelven' }, gerundio: 'devolviendo', imperativoTuSolo: 'devuelve', imperativoTu: 'devuélve', subjuntivoTu: 'devuelvas' },
    { infinitive: 'entregar', level: 2, accepts: ['objeto', 'regalo', 'envio', 'documento', 'dinero', 'tarea'], forms: { yo: 'entrego', tu: 'entregas', el: 'entrega', nosotros: 'entregamos', ellos: 'entregan' }, gerundio: 'entregando', imperativoTuSolo: 'entrega', imperativoTu: 'entréga', subjuntivoTu: 'entregues' },
    { infinitive: 'dejar', level: 2, accepts: ['objeto', 'vehiculo', 'envio', 'documento', 'dinero', 'lectura'], forms: { yo: 'dejo', tu: 'dejas', el: 'deja', nosotros: 'dejamos', ellos: 'dejan' }, gerundio: 'dejando', imperativoTuSolo: 'deja', imperativoTu: 'déja', subjuntivoTu: 'dejes' },
    { infinitive: 'recomendar', level: 2, accepts: ['obra'], forms: { yo: 'recomiendo', tu: 'recomiendas', el: 'recomienda', nosotros: 'recomendamos', ellos: 'recomiendan' }, gerundio: 'recomendando', imperativoTuSolo: 'recomienda', imperativoTu: 'recomiénda', subjuntivoTu: 'recomiendes' },
    { infinitive: 'repetir', level: 2, accepts: ['relato', 'noticia', 'dato', 'indicacion', 'tarea'], forms: { yo: 'repito', tu: 'repites', el: 'repite', nosotros: 'repetimos', ellos: 'repiten' }, gerundio: 'repitiendo', imperativoTuSolo: 'repite', imperativoTu: 'repíte', subjuntivoTu: 'repitas' },
    { infinitive: 'pasar', level: 2, accepts: ['objeto', 'texto', 'imagen'], forms: { yo: 'paso', tu: 'pasas', el: 'pasa', nosotros: 'pasamos', ellos: 'pasan' }, gerundio: 'pasando', imperativoTuSolo: 'pasa', imperativoTu: 'pása', subjuntivoTu: 'pases' },
    { infinitive: 'ofrecer', level: 2, accepts: ['comida', 'bebida', 'dinero', 'consejo'], forms: { yo: 'ofrezco', tu: 'ofreces', el: 'ofrece', nosotros: 'ofrecemos', ellos: 'ofrecen' }, gerundio: 'ofreciendo', imperativoTuSolo: 'ofrece', imperativoTu: 'ofréce', subjuntivoTu: 'ofrezcas' },
    { infinitive: 'recordar', level: 2, accepts: ['dato', 'indicacion'], forms: { yo: 'recuerdo', tu: 'recuerdas', el: 'recuerda', nosotros: 'recordamos', ellos: 'recuerdan' }, gerundio: 'recordando', imperativoTuSolo: 'recuerda', imperativoTu: 'recuérda', subjuntivoTu: 'recuerdes' },
    { infinitive: 'guardar', level: 2, accepts: ['objeto', 'envio', 'documento', 'texto', 'dinero', 'imagen', 'comida'], forms: { yo: 'guardo', tu: 'guardas', el: 'guarda', nosotros: 'guardamos', ellos: 'guardan' }, gerundio: 'guardando', imperativoTuSolo: 'guarda', imperativoTu: 'guárda', subjuntivoTu: 'guardes' },
    { infinitive: 'imprimir', level: 2, accepts: ['documento', 'texto'], forms: { yo: 'imprimo', tu: 'imprimes', el: 'imprime', nosotros: 'imprimimos', ellos: 'imprimen' }, gerundio: 'imprimiendo', imperativoTuSolo: 'imprime', imperativoTu: 'impríme', subjuntivoTu: 'imprimas' },
    { infinitive: 'corregir', level: 2, accepts: ['tarea'], forms: { yo: 'corrijo', tu: 'corriges', el: 'corrige', nosotros: 'corregimos', ellos: 'corrigen' }, gerundio: 'corrigiendo', imperativoTuSolo: 'corrige', imperativoTu: 'corríge', subjuntivoTu: 'corrijas' },
    { infinitive: 'compartir', level: 2, accepts: ['imagen', 'noticia'], forms: { yo: 'comparto', tu: 'compartes', el: 'comparte', nosotros: 'compartimos', ellos: 'comparten' }, gerundio: 'compartiendo', imperativoTuSolo: 'comparte', imperativoTu: 'compárte', subjuntivoTu: 'compartas' },
    { infinitive: 'buscar', level: 2, accepts: ['objeto', 'lectura'], forms: { yo: 'busco', tu: 'buscas', el: 'busca', nosotros: 'buscamos', ellos: 'buscan' }, gerundio: 'buscando', imperativoTuSolo: 'busca', imperativoTu: 'búsca', subjuntivoTu: 'busques' },

    // ---- Nivel 3 (AVANZADO): verbos B2 ----
    { infinitive: 'presentar', level: 3, accepts: ['obra'], forms: { yo: 'presento', tu: 'presentas', el: 'presenta', nosotros: 'presentamos', ellos: 'presentan' }, gerundio: 'presentando', imperativoTuSolo: 'presenta', imperativoTu: 'presénta', subjuntivoTu: 'presentes' },
    { infinitive: 'describir', level: 3, accepts: ['imagen'], forms: { yo: 'describo', tu: 'describes', el: 'describe', nosotros: 'describimos', ellos: 'describen' }, gerundio: 'describiendo', imperativoTuSolo: 'describe', imperativoTu: 'descríbe', subjuntivoTu: 'describas' },
    { infinitive: 'comunicar', level: 3, accepts: ['noticia'], forms: { yo: 'comunico', tu: 'comunicas', el: 'comunica', nosotros: 'comunicamos', ellos: 'comunican' }, gerundio: 'comunicando', imperativoTuSolo: 'comunica', imperativoTu: 'comuníca', subjuntivoTu: 'comuniques' },
    { infinitive: 'confesar', level: 3, accepts: ['secreto', 'culpa'], oiVeto: ['menor', 'profesional'], forms: { yo: 'confieso', tu: 'confiesas', el: 'confiesa', nosotros: 'confesamos', ellos: 'confiesan' }, gerundio: 'confesando', imperativoTuSolo: 'confiesa', imperativoTu: 'confiésa', subjuntivoTu: 'confieses' },
    { infinitive: 'dedicar', level: 3, accepts: ['cancion'], forms: { yo: 'dedico', tu: 'dedicas', el: 'dedica', nosotros: 'dedicamos', ellos: 'dedican' }, gerundio: 'dedicando', imperativoTuSolo: 'dedica', imperativoTu: 'dedíca', subjuntivoTu: 'dediques' },
    { infinitive: 'deber', level: 3, accepts: ['dinero', 'deuda', 'pago'], oiVeto: ['menor'], forms: { yo: 'debo', tu: 'debes', el: 'debe', nosotros: 'debemos', ellos: 'deben' }, gerundio: 'debiendo', imperativoTuSolo: 'debe', imperativoTu: 'débe', subjuntivoTu: 'debas' },
    { infinitive: 'firmar', level: 3, accepts: ['documento'], forms: { yo: 'firmo', tu: 'firmas', el: 'firma', nosotros: 'firmamos', ellos: 'firman' }, gerundio: 'firmando', imperativoTuSolo: 'firma', imperativoTu: 'fírma', subjuntivoTu: 'firmes' },
    { infinitive: 'revisar', level: 3, accepts: ['documento', 'tarea'], forms: { yo: 'reviso', tu: 'revisas', el: 'revisa', nosotros: 'revisamos', ellos: 'revisan' }, gerundio: 'revisando', imperativoTuSolo: 'revisa', imperativoTu: 'revísa', subjuntivoTu: 'revises' },
    { infinitive: 'alquilar', level: 3, accepts: ['vehiculo'], oiVeto: ['menor'], forms: { yo: 'alquilo', tu: 'alquilas', el: 'alquila', nosotros: 'alquilamos', ellos: 'alquilan' }, gerundio: 'alquilando', imperativoTuSolo: 'alquila', imperativoTu: 'alquíla', subjuntivoTu: 'alquiles' },
    { infinitive: 'cobrar', level: 3, accepts: ['pago'], oiVeto: ['menor'], forms: { yo: 'cobro', tu: 'cobras', el: 'cobra', nosotros: 'cobramos', ellos: 'cobran' }, gerundio: 'cobrando', imperativoTuSolo: 'cobra', imperativoTu: 'cóbra', subjuntivoTu: 'cobres' },
    { infinitive: 'anunciar', level: 3, accepts: ['noticia'], forms: { yo: 'anuncio', tu: 'anuncias', el: 'anuncia', nosotros: 'anunciamos', ellos: 'anuncian' }, gerundio: 'anunciando', imperativoTuSolo: 'anuncia', imperativoTu: 'anúncia', subjuntivoTu: 'anuncies' },
    { infinitive: 'confirmar', level: 3, accepts: ['noticia', 'dato'], forms: { yo: 'confirmo', tu: 'confirmas', el: 'confirma', nosotros: 'confirmamos', ellos: 'confirman' }, gerundio: 'confirmando', imperativoTuSolo: 'confirma', imperativoTu: 'confírma', subjuntivoTu: 'confirmes' },
    { infinitive: 'traducir', level: 3, accepts: ['documento', 'texto'], forms: { yo: 'traduzco', tu: 'traduces', el: 'traduce', nosotros: 'traducimos', ellos: 'traducen' }, gerundio: 'traduciendo', imperativoTuSolo: 'traduce', imperativoTu: 'tradúce', subjuntivoTu: 'traduzcas' },
    { infinitive: 'agradecer', level: 3, accepts: ['consejo', 'regalo'], forms: { yo: 'agradezco', tu: 'agradeces', el: 'agradece', nosotros: 'agradecemos', ellos: 'agradecen' }, gerundio: 'agradeciendo', imperativoTuSolo: 'agradece', imperativoTu: 'agradéce', subjuntivoTu: 'agradezcas' },
    { infinitive: 'reservar', level: 3, accepts: ['reserva'], forms: { yo: 'reservo', tu: 'reservas', el: 'reserva', nosotros: 'reservamos', ellos: 'reservan' }, gerundio: 'reservando', imperativoTuSolo: 'reserva', imperativoTu: 'resérva', subjuntivoTu: 'reserves' },
];

// --- Objetos directos (OD) con su pronombre según género y número ---
export type DirectPronoun = 'lo' | 'la' | 'los' | 'las';

export interface DirectObject {
    phrase: string; // "el libro"
    pron: DirectPronoun;
    // Rasgos semánticos para filtrar combinaciones verbo+OD implausibles.
    tags: ODTag[];
    // Nivel mínimo en el que la palabra entra al pool (léxico acumulativo).
    level: Difficulty;
}

export const DIRECT_OBJECTS: DirectObject[] = [
    // ---- lo (masculino singular) ----
    { phrase: 'el libro', pron: 'lo', tags: ['lectura', 'obra', 'objeto', 'compra', 'regalo'], level: 1 },
    { phrase: 'el regalo', pron: 'lo', tags: ['regalo'], level: 1 },
    { phrase: 'el dinero', pron: 'lo', tags: ['dinero'], level: 1 },
    { phrase: 'el coche', pron: 'lo', tags: ['vehiculo'], level: 1 },
    { phrase: 'el mensaje', pron: 'lo', tags: ['texto'], level: 1 },
    { phrase: 'el secreto', pron: 'lo', tags: ['secreto'], level: 1 },
    { phrase: 'el cuaderno', pron: 'lo', tags: ['objeto'], level: 1 },
    { phrase: 'el teléfono', pron: 'lo', tags: ['objeto', 'compra'], level: 1 },
    { phrase: 'el café', pron: 'lo', tags: ['bebida'], level: 1 },
    { phrase: 'el té', pron: 'lo', tags: ['bebida'], level: 1 },
    { phrase: 'el zumo', pron: 'lo', tags: ['bebida'], level: 1 },
    { phrase: 'el pastel', pron: 'lo', tags: ['comida'], level: 1 },
    { phrase: 'el desayuno', pron: 'lo', tags: ['comida'], level: 1 },
    { phrase: 'el reloj', pron: 'lo', tags: ['objeto', 'compra', 'regalo'], level: 1 },
    { phrase: 'el ordenador', pron: 'lo', tags: ['objeto', 'compra'], level: 1 },
    { phrase: 'el juguete', pron: 'lo', tags: ['objeto', 'compra', 'regalo'], level: 1 },
    { phrase: 'el periódico', pron: 'lo', tags: ['lectura', 'objeto', 'compra'], level: 1 },
    { phrase: 'el cuento', pron: 'lo', tags: ['relato', 'obra'], level: 1 },
    { phrase: 'el dibujo', pron: 'lo', tags: ['imagen'], level: 1 },
    { phrase: 'el nombre', pron: 'lo', tags: ['dato'], level: 1 },
    { phrase: 'el número', pron: 'lo', tags: ['dato'], level: 1 },
    { phrase: 'el paquete', pron: 'lo', tags: ['envio'], level: 1 },
    { phrase: 'el informe', pron: 'lo', tags: ['documento'], level: 2 },
    { phrase: 'el poema', pron: 'lo', tags: ['texto', 'obra'], level: 2 },
    { phrase: 'el chiste', pron: 'lo', tags: ['relato'], level: 2 },
    { phrase: 'el consejo', pron: 'lo', tags: ['consejo'], level: 2 },
    { phrase: 'el mapa', pron: 'lo', tags: ['objeto'], level: 2 },
    { phrase: 'el paraguas', pron: 'lo', tags: ['objeto'], level: 2 },
    { phrase: 'el cargador', pron: 'lo', tags: ['objeto'], level: 2 },
    { phrase: 'el correo', pron: 'lo', tags: ['texto'], level: 2 },
    { phrase: 'el vídeo', pron: 'lo', tags: ['imagen'], level: 2 },
    { phrase: 'el cartel', pron: 'lo', tags: ['imagen'], level: 2 },
    { phrase: 'el plan', pron: 'lo', tags: ['noticia'], level: 2 },
    { phrase: 'el resultado', pron: 'lo', tags: ['noticia'], level: 2 },
    { phrase: 'el postre', pron: 'lo', tags: ['comida'], level: 2 },
    { phrase: 'el arroz', pron: 'lo', tags: ['comida'], level: 2 },
    { phrase: 'el vino', pron: 'lo', tags: ['bebida'], level: 2 },
    { phrase: 'el disco', pron: 'lo', tags: ['obra'], level: 2 },
    { phrase: 'el examen', pron: 'lo', tags: ['tarea'], level: 2 },
    { phrase: 'el ejercicio', pron: 'lo', tags: ['tarea'], level: 2 },
    { phrase: 'el precio', pron: 'lo', tags: ['dato'], level: 2 },
    { phrase: 'el sobre', pron: 'lo', tags: ['envio'], level: 2 },
    { phrase: 'el diccionario', pron: 'lo', tags: ['lectura', 'objeto'], level: 2 },
    { phrase: 'el perfume', pron: 'lo', tags: ['regalo', 'compra'], level: 2 },
    { phrase: 'el contrato', pron: 'lo', tags: ['documento'], level: 3 },
    { phrase: 'el presupuesto', pron: 'lo', tags: ['documento'], level: 3 },
    { phrase: 'el formulario', pron: 'lo', tags: ['documento'], level: 3 },
    { phrase: 'el sueldo', pron: 'lo', tags: ['deuda'], level: 3 },
    { phrase: 'el préstamo', pron: 'lo', tags: ['deuda'], level: 3 },
    { phrase: 'el alquiler', pron: 'lo', tags: ['pago'], level: 3 },
    { phrase: 'el cambio', pron: 'lo', tags: ['dinero'], level: 3 },
    { phrase: 'el error', pron: 'lo', tags: ['culpa'], level: 3 },
    { phrase: 'el documental', pron: 'lo', tags: ['obra'], level: 3 },
    { phrase: 'el vuelo', pron: 'lo', tags: ['reserva'], level: 3 },

    // ---- la (femenino singular) ----
    { phrase: 'la carta', pron: 'la', tags: ['texto'], level: 1 },
    { phrase: 'la noticia', pron: 'la', tags: ['noticia'], level: 1 },
    { phrase: 'la verdad', pron: 'la', tags: ['secreto'], level: 1 },
    { phrase: 'la receta', pron: 'la', tags: ['indicacion'], level: 1 },
    { phrase: 'la foto', pron: 'la', tags: ['imagen'], level: 1 },
    { phrase: 'la canción', pron: 'la', tags: ['cancion', 'obra'], level: 1 },
    { phrase: 'la dirección', pron: 'la', tags: ['dato'], level: 1 },
    { phrase: 'la maleta', pron: 'la', tags: ['objeto'], level: 1 },
    { phrase: 'la historia', pron: 'la', tags: ['relato'], level: 1 },
    { phrase: 'la película', pron: 'la', tags: ['obra'], level: 1 },
    { phrase: 'la comida', pron: 'la', tags: ['comida'], level: 1 },
    { phrase: 'la cena', pron: 'la', tags: ['comida'], level: 1 },
    { phrase: 'la sopa', pron: 'la', tags: ['comida'], level: 1 },
    { phrase: 'la pizza', pron: 'la', tags: ['comida'], level: 1 },
    { phrase: 'la ropa', pron: 'la', tags: ['objeto', 'compra'], level: 1 },
    { phrase: 'la bicicleta', pron: 'la', tags: ['vehiculo', 'compra', 'regalo'], level: 1 },
    { phrase: 'la mochila', pron: 'la', tags: ['objeto', 'compra'], level: 1 },
    { phrase: 'la pelota', pron: 'la', tags: ['objeto', 'compra', 'regalo'], level: 1 },
    { phrase: 'la camiseta', pron: 'la', tags: ['objeto', 'compra'], level: 1 },
    { phrase: 'la revista', pron: 'la', tags: ['lectura', 'objeto', 'compra'], level: 1 },
    { phrase: 'la lista', pron: 'la', tags: ['texto'], level: 1 },
    { phrase: 'la tarea', pron: 'la', tags: ['tarea'], level: 1 },
    { phrase: 'la fecha', pron: 'la', tags: ['dato'], level: 1 },
    { phrase: 'la hora', pron: 'la', tags: ['dato'], level: 1 },
    { phrase: 'la factura', pron: 'la', tags: ['documento', 'pago'], level: 2 },
    { phrase: 'la novela', pron: 'la', tags: ['lectura', 'obra'], level: 2 },
    { phrase: 'la serie', pron: 'la', tags: ['obra'], level: 2 },
    { phrase: 'la postal', pron: 'la', tags: ['texto'], level: 2 },
    { phrase: 'la invitación', pron: 'la', tags: ['texto'], level: 2 },
    { phrase: 'la tortilla', pron: 'la', tags: ['comida'], level: 2 },
    { phrase: 'la limonada', pron: 'la', tags: ['bebida'], level: 2 },
    { phrase: 'la contraseña', pron: 'la', tags: ['dato'], level: 2 },
    { phrase: 'la idea', pron: 'la', tags: ['consejo'], level: 2 },
    { phrase: 'la ayuda', pron: 'la', tags: ['consejo'], level: 2 },
    { phrase: 'la cuenta', pron: 'la', tags: ['pago'], level: 2 },
    { phrase: 'la moto', pron: 'la', tags: ['vehiculo', 'compra'], level: 2 },
    { phrase: 'la caja', pron: 'la', tags: ['envio'], level: 2 },
    { phrase: 'la propuesta', pron: 'la', tags: ['documento'], level: 3 },
    { phrase: 'la solicitud', pron: 'la', tags: ['documento'], level: 3 },
    { phrase: 'la decisión', pron: 'la', tags: ['noticia'], level: 3 },
    { phrase: 'la novedad', pron: 'la', tags: ['noticia'], level: 3 },
    { phrase: 'la anécdota', pron: 'la', tags: ['relato'], level: 3 },
    { phrase: 'la leyenda', pron: 'la', tags: ['relato'], level: 3 },
    { phrase: 'la mentira', pron: 'la', tags: ['culpa'], level: 3 },
    { phrase: 'la propina', pron: 'la', tags: ['deuda'], level: 3 },
    { phrase: 'la mesa', pron: 'la', tags: ['reserva'], level: 3 },
    { phrase: 'la habitación', pron: 'la', tags: ['reserva'], level: 3 },

    // ---- los (masculino plural) ----
    { phrase: 'los libros', pron: 'los', tags: ['lectura', 'objeto', 'compra'], level: 1 },
    { phrase: 'los regalos', pron: 'los', tags: ['regalo'], level: 1 },
    { phrase: 'los zapatos', pron: 'los', tags: ['objeto', 'compra'], level: 1 },
    { phrase: 'los deberes', pron: 'los', tags: ['tarea'], level: 1 },
    { phrase: 'los euros', pron: 'los', tags: ['dinero'], level: 1 },
    { phrase: 'los documentos', pron: 'los', tags: ['documento'], level: 2 },
    { phrase: 'los apuntes', pron: 'los', tags: ['texto'], level: 2 },
    { phrase: 'los resultados', pron: 'los', tags: ['noticia'], level: 2 },
    { phrase: 'los billetes', pron: 'los', tags: ['compra', 'envio'], level: 2 },
    { phrase: 'los bombones', pron: 'los', tags: ['regalo'], level: 2 },
    { phrase: 'los guantes', pron: 'los', tags: ['objeto', 'compra'], level: 2 },

    // ---- las (femenino plural) ----
    { phrase: 'las llaves', pron: 'las', tags: ['objeto'], level: 1 },
    { phrase: 'las flores', pron: 'las', tags: ['regalo'], level: 1 },
    { phrase: 'las fotos', pron: 'las', tags: ['imagen'], level: 1 },
    { phrase: 'las cartas', pron: 'las', tags: ['texto'], level: 1 },
    { phrase: 'las noticias', pron: 'las', tags: ['noticia'], level: 1 },
    { phrase: 'las instrucciones', pron: 'las', tags: ['indicacion'], level: 1 },
    { phrase: 'las galletas', pron: 'las', tags: ['comida'], level: 1 },
    { phrase: 'las reglas', pron: 'las', tags: ['indicacion'], level: 2 },
    { phrase: 'las entradas', pron: 'las', tags: ['compra', 'reserva'], level: 2 },
    { phrase: 'las gafas', pron: 'las', tags: ['objeto', 'compra'], level: 2 },
    { phrase: 'las canciones', pron: 'las', tags: ['cancion', 'obra'], level: 2 },
];

// --- Objetos indirectos (OI): personas con su pronombre ---
export type IndirectPronoun = 'me' | 'te' | 'le' | 'nos' | 'les';

export interface IndirectObject {
    phrase: string; // "a Juan", "a él", "a mí"
    pron: IndirectPronoun;
    isThirdPerson: boolean; // le / les → activan la regla "se"
    // Categoría para el veto semántico verbo+OI (ver `Verb.oiVeto`).
    category: OICategory;
    // Nivel mínimo en el que la persona entra al pool (léxico acumulativo).
    level: Difficulty;
}

export const INDIRECT_OBJECTS: IndirectObject[] = [
    // ---- 1ª y 2ª persona (sin regla "se"; único pool del nivel BASE) ----
    { phrase: 'a mí', pron: 'me', isThirdPerson: false, category: 'adulto', level: 1 },
    { phrase: 'a ti', pron: 'te', isThirdPerson: false, category: 'adulto', level: 1 },
    { phrase: 'a nosotros', pron: 'nos', isThirdPerson: false, category: 'adulto', level: 1 },
    // ---- 3ª persona singular (le → se) ----
    { phrase: 'a Juan', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a María', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a él', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a ella', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a tu hermano', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a mi hermana', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a mi amiga', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a tu amigo', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a la abuela', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'al abuelo', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a usted', pron: 'le', isThirdPerson: true, category: 'adulto', level: 2 },
    { phrase: 'a la profesora', pron: 'le', isThirdPerson: true, category: 'profesional', level: 2 },
    { phrase: 'al cliente', pron: 'le', isThirdPerson: true, category: 'profesional', level: 2 },
    { phrase: 'al vecino', pron: 'le', isThirdPerson: true, category: 'adulto', level: 2 },
    { phrase: 'a la vecina', pron: 'le', isThirdPerson: true, category: 'adulto', level: 2 },
    { phrase: 'a tu prima', pron: 'le', isThirdPerson: true, category: 'adulto', level: 2 },
    { phrase: 'a la doctora', pron: 'le', isThirdPerson: true, category: 'profesional', level: 2 },
    { phrase: 'al camarero', pron: 'le', isThirdPerson: true, category: 'profesional', level: 2 },
    { phrase: 'al bebé', pron: 'le', isThirdPerson: true, category: 'menor', level: 2 },
    { phrase: 'al jefe', pron: 'le', isThirdPerson: true, category: 'profesional', level: 3 },
    { phrase: 'a la jefa', pron: 'le', isThirdPerson: true, category: 'profesional', level: 3 },
    { phrase: 'a la clienta', pron: 'le', isThirdPerson: true, category: 'profesional', level: 3 },
    // ---- 3ª persona plural (les → se) ----
    { phrase: 'a ellos', pron: 'les', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a ellas', pron: 'les', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a mis padres', pron: 'les', isThirdPerson: true, category: 'adulto', level: 1 },
    { phrase: 'a ustedes', pron: 'les', isThirdPerson: true, category: 'adulto', level: 2 },
    { phrase: 'a los niños', pron: 'les', isThirdPerson: true, category: 'menor', level: 2 },
    { phrase: 'a los estudiantes', pron: 'les', isThirdPerson: true, category: 'menor', level: 2 },
    { phrase: 'a los compañeros', pron: 'les', isThirdPerson: true, category: 'adulto', level: 2 },
    { phrase: 'a los turistas', pron: 'les', isThirdPerson: true, category: 'adulto', level: 3 },
    { phrase: 'a los invitados', pron: 'les', isThirdPerson: true, category: 'adulto', level: 3 },
];

const DIRECT_PRONOUNS: DirectPronoun[] = ['lo', 'la', 'los', 'las'];
const INDIRECT_PRONOUNS: IndirectPronoun[] = ['me', 'te', 'le', 'nos', 'les'];

export { DIRECT_PRONOUNS, INDIRECT_PRONOUNS };

// --- Ambientación de frases (adverbiales, leads, vocativos) ---
//
// REGLA DE CURACIÓN: toda la app conjuga en PRESENTE. Ningún adverbial puede
// exigir pasado ("Ayer", "Anoche", "Esta mañana" quedan prohibidos); valen los
// habituales, los de presente/futuro próximo y los locativos.
export const ADVERBIALS = [
    'Rápidamente,',
    'Sin dudarlo,',
    'Con mucho cuidado,',
    'En la oficina,',
    'En casa,',
    'Todos los días',
    'Cada semana',
    'Normalmente,',
    'Casi siempre',
    'Hoy',
    'Ahora mismo',
    'Esta tarde',
    'Después de clase,',
    'Más tarde',
    'Por fin',
];

// Reflejo temporal para ambientar la frase reflexiva ("Todas las mañanas…").
export const REFLEXIVE_LEADS = [
    'Todas las mañanas',
    'Cada día',
    'Por la noche',
    'Los domingos',
    'Antes de salir',
    'Después del desayuno',
    'Al llegar a casa',
    'Antes de la cena',
    'Durante la semana',
    'Al final del día',
];

// Leads de POSICIÓN: cláusulas de finalidad ("para" + infinitivo → enclisis)…
export const INF_LEADS = [
    'Viene para',
    'Trabaja para',
    'Estudia para',
    'Ahorra para',
    'Lucha para',
    'Vuelve a casa para',
    'Llama para',
    'Madruga para',
    'Hace cola para',
    'Viaja para',
];

// …y cláusulas principales con gerundio adverbial ("mientras lo hacía").
export const GER_LEADS = [
    'Salió de casa',
    'Pasó la tarde',
    'Llegó a la oficina',
    'Volvió al pueblo',
    'Cruzó la ciudad',
    'Terminó la semana',
    'Recorrió el barrio',
    'Esperó el autobús',
];

// Leads para reflexivos en POSICIÓN. Son de 3ª persona (→ pronombre "se") y encajan
// con verbos de rutina. Los de infinitivo son cláusulas de finalidad ("para ___")
// que fuerzan la enclisis; los de gerundio son adverbiales.
export const REFL_INF_LEADS = [
    'Va al baño para',
    'Usa el despertador para',
    'Entra en el cuarto para',
    'Necesita tiempo para',
    'Enciende la luz para',
    'Apaga la tele para',
    'Vuelve al cuarto para',
    'Cierra la puerta para',
];

export const REFL_GER_LEADS = [
    'Empezó la mañana',
    'Terminó el día',
    'Salió del baño',
    'Pasó un rato',
    'Llegó a casa',
    'Empezó el día',
    'Acabó la tarde',
    'Volvió del gimnasio',
];

// Para el imperativo afirmativo: vocativo (destinatario nombrado) + apelativo de
// orden/ruego. Juntos fuerzan la lectura imperativa y descartan el presente de
// indicativo exclamativo (que comparte la misma forma verbal en verbos regulares).
export const VOCATIVOS = [
    'Ana', 'Pedro', 'Marta', 'Luis', 'Sofía', 'Carlos', 'Lucía',
    'Elena', 'Diego', 'Paula', 'Martín', 'Julia', 'Andrés', 'Clara',
];

export const APELATIVOS_ORDEN = [
    'por favor',
    'te lo pido',
    'hazme el favor',
    'cuando puedas',
    'que es urgente',
];

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
    // Nivel mínimo (léxico + dificultad conceptual: rutina → 1, emoción/cambio → 2).
    level: Difficulty;
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
        infinitive: 'levantarse', theme: 'rutina', level: 1,
        forms: { yo: 'levanto', tu: 'levantas', el: 'levanta', nosotros: 'levantamos', ellos: 'levantan' },
        gerundio: 'levantando', imperativoTu: 'levanta', imperativoTuRefl: 'levántate', subjuntivoTu: 'levantes',
        contrast: {
            reflexiveCue: 'muy temprano',
            plain: [{ phrase: 'al bebé de la cuna', pron: 'lo' }, { phrase: 'la caja del suelo', pron: 'la' }],
            note: '«Me levanto» = salgo de la cama; «levanto la caja» = la acción cae sobre otra cosa: sin reflexivo.',
        },
    },
    {
        infinitive: 'ducharse', theme: 'rutina', level: 1,
        forms: { yo: 'ducho', tu: 'duchas', el: 'ducha', nosotros: 'duchamos', ellos: 'duchan' },
        gerundio: 'duchando', imperativoTu: 'ducha', imperativoTuRefl: 'dúchate', subjuntivoTu: 'duches',
        contrast: {
            reflexiveCue: 'con agua fría',
            plain: [{ phrase: 'al perro en el patio', pron: 'lo' }, { phrase: 'al bebé con cuidado', pron: 'lo' }],
            note: '«Me ducho» = el agua cae sobre mí; «ducho al perro» = otro recibe la ducha: sin reflexivo.',
        },
    },
    {
        infinitive: 'despertarse', theme: 'rutina', level: 1,
        forms: { yo: 'despierto', tu: 'despiertas', el: 'despierta', nosotros: 'despertamos', ellos: 'despiertan' },
        gerundio: 'despertando', imperativoTu: 'despierta', imperativoTuRefl: 'despiértate', subjuntivoTu: 'despiertes',
        contrast: {
            reflexiveCue: 'a las siete',
            plain: [{ phrase: 'a tu hermano', pron: 'lo' }, { phrase: 'a la niña', pron: 'la' }, { phrase: 'a los vecinos', pron: 'los' }],
            note: '«Me despierto» = yo abro los ojos; «despierto a mi hermano» = la acción cae sobre OTRA persona: sin reflexivo.',
        },
    },
    {
        infinitive: 'acostarse', theme: 'rutina', level: 1,
        forms: { yo: 'acuesto', tu: 'acuestas', el: 'acuesta', nosotros: 'acostamos', ellos: 'acuestan' },
        gerundio: 'acostando', imperativoTu: 'acuesta', imperativoTuRefl: 'acuéstate', subjuntivoTu: 'acuestes',
        contrast: {
            reflexiveCue: 'antes de medianoche',
            plain: [{ phrase: 'al bebé en la cuna', pron: 'lo' }, { phrase: 'a los niños temprano', pron: 'los' }],
            note: '«Me acuesto» = voy a mi cama; «acuesto al bebé» = pongo a OTRO en la cama: sin reflexivo.',
        },
    },
    {
        infinitive: 'vestirse', theme: 'rutina', level: 1,
        forms: { yo: 'visto', tu: 'vistes', el: 'viste', nosotros: 'vestimos', ellos: 'visten' },
        gerundio: 'vistiendo', imperativoTu: 'viste', imperativoTuRefl: 'vístete', subjuntivoTu: 'vistas',
        contrast: {
            reflexiveCue: 'en cinco minutos',
            plain: [{ phrase: 'al niño para la escuela', pron: 'lo' }, { phrase: 'a las gemelas', pron: 'las' }],
            note: '«Me visto» = pongo ropa sobre mi cuerpo; «visto al niño» = la ropa va sobre OTRO: sin reflexivo.',
        },
    },
    {
        infinitive: 'peinarse', theme: 'rutina', level: 1,
        forms: { yo: 'peino', tu: 'peinas', el: 'peina', nosotros: 'peinamos', ellos: 'peinan' },
        gerundio: 'peinando', imperativoTu: 'peina', imperativoTuRefl: 'péinate', subjuntivoTu: 'peines',
        contrast: {
            reflexiveCue: 'frente al espejo',
            plain: [{ phrase: 'a tu hija antes de salir', pron: 'la' }, { phrase: 'al cliente', pron: 'lo' }],
            note: '«Me peino» = mi propio pelo; «peino a mi hija» = el pelo de OTRA persona: sin reflexivo.',
        },
    },
    {
        infinitive: 'sentarse', theme: 'cambio', level: 1,
        forms: { yo: 'siento', tu: 'sientas', el: 'sienta', nosotros: 'sentamos', ellos: 'sientan' },
        gerundio: 'sentando', imperativoTu: 'sienta', imperativoTuRefl: 'siéntate', subjuntivoTu: 'sientes',
    },
    {
        infinitive: 'bañarse', theme: 'rutina', level: 1,
        forms: { yo: 'baño', tu: 'bañas', el: 'baña', nosotros: 'bañamos', ellos: 'bañan' },
        gerundio: 'bañando', imperativoTu: 'baña', imperativoTuRefl: 'báñate', subjuntivoTu: 'bañes',
        contrast: {
            reflexiveCue: 'en el mar',
            plain: [{ phrase: 'al perro los domingos', pron: 'lo' }, { phrase: 'al bebé por la noche', pron: 'lo' }],
            note: '«Me baño» = yo entro al agua; «baño al perro» = otro recibe el baño: sin reflexivo.',
        },
    },
    {
        infinitive: 'lavarse', theme: 'rutina', level: 1,
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
        infinitive: 'maquillarse', theme: 'rutina', level: 1,
        forms: { yo: 'maquillo', tu: 'maquillas', el: 'maquilla', nosotros: 'maquillamos', ellos: 'maquillan' },
        gerundio: 'maquillando', imperativoTu: 'maquilla', imperativoTuRefl: 'maquíllate', subjuntivoTu: 'maquilles',
    },
    {
        infinitive: 'afeitarse', theme: 'rutina', level: 1,
        forms: { yo: 'afeito', tu: 'afeitas', el: 'afeita', nosotros: 'afeitamos', ellos: 'afeitan' },
        gerundio: 'afeitando', imperativoTu: 'afeita', imperativoTuRefl: 'aféitate', subjuntivoTu: 'afeites',
        bodyParts: ['la barba', 'la cabeza'],
    },
    {
        infinitive: 'secarse', theme: 'rutina', level: 1,
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
        infinitive: 'ponerse', theme: 'rutina', level: 1,
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
        infinitive: 'quitarse', theme: 'rutina', level: 1,
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
        infinitive: 'prepararse', theme: 'rutina', level: 1,
        forms: { yo: 'preparo', tu: 'preparas', el: 'prepara', nosotros: 'preparamos', ellos: 'preparan' },
        gerundio: 'preparando', imperativoTu: 'prepara', imperativoTuRefl: 'prepárate', subjuntivoTu: 'prepares',
        contrast: {
            reflexiveCue: 'para el examen',
            plain: [{ phrase: 'a los alumnos para la prueba', pron: 'los' }, { phrase: 'al equipo para la final', pron: 'lo' }],
            note: '«Me preparo» = yo mismo; «preparo a los alumnos» = la acción cae sobre OTROS: sin reflexivo.',
        },
    },
    {
        infinitive: 'cepillarse', theme: 'rutina', level: 1,
        forms: { yo: 'cepillo', tu: 'cepillas', el: 'cepilla', nosotros: 'cepillamos', ellos: 'cepillan' },
        gerundio: 'cepillando', imperativoTu: 'cepilla', imperativoTuRefl: 'cepíllate', subjuntivoTu: 'cepilles',
        needsComplement: true,
        bodyParts: ['los dientes', 'el pelo'],
    },
    {
        infinitive: 'pintarse', theme: 'rutina', level: 1,
        forms: { yo: 'pinto', tu: 'pintas', el: 'pinta', nosotros: 'pintamos', ellos: 'pintan' },
        gerundio: 'pintando', imperativoTu: 'pinta', imperativoTuRefl: 'píntate', subjuntivoTu: 'pintes',
        contrast: {
            reflexiveCue: 'los labios frente al espejo',
            plain: [{ phrase: 'la pared del salón', pron: 'la' }, { phrase: 'las sillas del jardín', pron: 'las' }],
            note: '«Me pinto» = maquillaje sobre mí; «pinto la pared» = el color va sobre otra cosa: sin reflexivo.',
        },
        bodyParts: ['las uñas', 'los labios'],
    },
    {
        infinitive: 'mirarse', theme: 'rutina', level: 1,
        forms: { yo: 'miro', tu: 'miras', el: 'mira', nosotros: 'miramos', ellos: 'miran' },
        gerundio: 'mirando', imperativoTu: 'mira', imperativoTuRefl: 'mírate', subjuntivoTu: 'mires',
        contrast: {
            reflexiveCue: 'en el espejo',
            plain: [{ phrase: 'la tele por la noche', pron: 'la' }, { phrase: 'las fotos del viaje', pron: 'las' }],
            note: '«Me miro» = mis ojos vuelven a mí (espejo); «miro la tele» = miro otra cosa: sin reflexivo.',
        },
    },
    {
        infinitive: 'quedarse', theme: 'cambio', level: 2,
        forms: { yo: 'quedo', tu: 'quedas', el: 'queda', nosotros: 'quedamos', ellos: 'quedan' },
        gerundio: 'quedando', imperativoTu: 'queda', imperativoTuRefl: 'quédate', subjuntivoTu: 'quedes',
    },
    {
        infinitive: 'relajarse', theme: 'emocion', level: 2,
        forms: { yo: 'relajo', tu: 'relajas', el: 'relaja', nosotros: 'relajamos', ellos: 'relajan' },
        gerundio: 'relajando', imperativoTu: 'relaja', imperativoTuRefl: 'relájate', subjuntivoTu: 'relajes',
    },
    {
        infinitive: 'dormirse', theme: 'cambio', level: 2,
        forms: { yo: 'duermo', tu: 'duermes', el: 'duerme', nosotros: 'dormimos', ellos: 'duermen' },
        gerundio: 'durmiendo', imperativoTu: 'duerme', imperativoTuRefl: 'duérmete', subjuntivoTu: 'duermas',
        contrast: {
            reflexiveCue: 'en el sofá viendo la tele',
            plain: [{ phrase: 'muy poco entre semana' }, { phrase: 'ocho horas cada noche' }],
            note: '«Dormir» es estar dormido; «dormirse» es EMPEZAR a dormir. El pronombre cambia el significado.',
        },
    },
    {
        infinitive: 'irse', theme: 'cambio', level: 2,
        forms: { yo: 'voy', tu: 'vas', el: 'va', nosotros: 'vamos', ellos: 'van' },
        gerundio: 'yendo', imperativoTu: 've', imperativoTuRefl: 'vete', subjuntivoTu: 'vayas',
    },
    {
        infinitive: 'enojarse', theme: 'emocion', level: 2,
        forms: { yo: 'enojo', tu: 'enojas', el: 'enoja', nosotros: 'enojamos', ellos: 'enojan' },
        gerundio: 'enojando', imperativoTu: 'enoja', imperativoTuRefl: 'enójate', subjuntivoTu: 'enojes',
        contrast: {
            reflexiveCue: 'con el tráfico',
            plain: [{ phrase: 'a tu hermana con bromas', pron: 'la' }, { phrase: 'al profesor', pron: 'lo' }],
            note: '«Me enojo» = la emoción es mía; «enojo a mi hermana» = provoco la emoción en OTRA persona: sin reflexivo.',
        },
    },
    {
        infinitive: 'aburrirse', theme: 'emocion', level: 2,
        forms: { yo: 'aburro', tu: 'aburres', el: 'aburre', nosotros: 'aburrimos', ellos: 'aburren' },
        gerundio: 'aburriendo', imperativoTu: 'aburre', imperativoTuRefl: 'abúrrete', subjuntivoTu: 'aburras',
        contrast: {
            reflexiveCue: 'en las reuniones largas',
            plain: [{ phrase: 'a los alumnos con teoría', pron: 'los' }, { phrase: 'al público', pron: 'lo' }],
            note: '«Me aburro» = el aburrimiento es mío; «aburro a los alumnos» = lo provoco en OTROS: sin reflexivo.',
        },
    },
    {
        infinitive: 'divertirse', theme: 'emocion', level: 2,
        forms: { yo: 'divierto', tu: 'diviertes', el: 'divierte', nosotros: 'divertimos', ellos: 'divierten' },
        gerundio: 'divirtiendo', imperativoTu: 'divierte', imperativoTuRefl: 'diviértete', subjuntivoTu: 'diviertas',
        contrast: {
            reflexiveCue: 'en la fiesta',
            plain: [{ phrase: 'a los niños con juegos', pron: 'los' }, { phrase: 'a la gente con chistes', pron: 'la' }],
            note: '«Me divierto» = la diversión es mía; «divierto a los niños» = la provoco en OTROS: sin reflexivo.',
        },
    },
    {
        infinitive: 'preocuparse', theme: 'emocion', level: 2,
        forms: { yo: 'preocupo', tu: 'preocupas', el: 'preocupa', nosotros: 'preocupamos', ellos: 'preocupan' },
        gerundio: 'preocupando', imperativoTu: 'preocupa', imperativoTuRefl: 'preocúpate', subjuntivoTu: 'preocupes',
        contrast: {
            reflexiveCue: 'por los exámenes',
            plain: [{ phrase: 'a tus padres con esas notas', pron: 'los' }, { phrase: 'a la profesora', pron: 'la' }],
            note: '«Me preocupo» = la preocupación es mía; «preocupo a mis padres» = la provoco en OTROS: sin reflexivo.',
        },
    },
    {
        infinitive: 'calmarse', theme: 'emocion', level: 2,
        forms: { yo: 'calmo', tu: 'calmas', el: 'calma', nosotros: 'calmamos', ellos: 'calman' },
        gerundio: 'calmando', imperativoTu: 'calma', imperativoTuRefl: 'cálmate', subjuntivoTu: 'calmes',
        contrast: {
            reflexiveCue: 'antes de hablar en público',
            plain: [{ phrase: 'al bebé con una canción', pron: 'lo' }, { phrase: 'a los pasajeros', pron: 'los' }],
            note: '«Me calmo» = recupero mi calma; «calmo al bebé» = doy calma a OTRO: sin reflexivo.',
        },
    },
    {
        infinitive: 'animarse', theme: 'emocion', level: 2,
        forms: { yo: 'animo', tu: 'animas', el: 'anima', nosotros: 'animamos', ellos: 'animan' },
        gerundio: 'animando', imperativoTu: 'anima', imperativoTuRefl: 'anímate', subjuntivoTu: 'animes',
        contrast: {
            reflexiveCue: 'con la música',
            plain: [{ phrase: 'a tu equipo desde la grada', pron: 'lo' }, { phrase: 'a los corredores', pron: 'los' }],
            note: '«Me animo» = el ánimo es mío; «animo a mi equipo» = doy ánimo a OTROS: sin reflexivo.',
        },
    },
    {
        infinitive: 'alegrarse', theme: 'emocion', level: 2,
        forms: { yo: 'alegro', tu: 'alegras', el: 'alegra', nosotros: 'alegramos', ellos: 'alegran' },
        gerundio: 'alegrando', imperativoTu: 'alegra', imperativoTuRefl: 'alégrate', subjuntivoTu: 'alegres',
        contrast: {
            reflexiveCue: 'con las buenas noticias',
            plain: [{ phrase: 'a tu abuela con la visita', pron: 'la' }, { phrase: 'a los pacientes', pron: 'los' }],
            note: '«Me alegro» = la alegría es mía; «alegro a mi abuela» = la provoco en OTRA persona: sin reflexivo.',
        },
    },
    {
        infinitive: 'mudarse', theme: 'cambio', level: 2,
        forms: { yo: 'mudo', tu: 'mudas', el: 'muda', nosotros: 'mudamos', ellos: 'mudan' },
        gerundio: 'mudando', imperativoTu: 'muda', imperativoTuRefl: 'múdate', subjuntivoTu: 'mudes',
    },
    {
        infinitive: 'casarse', theme: 'cambio', level: 2,
        forms: { yo: 'caso', tu: 'casas', el: 'casa', nosotros: 'casamos', ellos: 'casan' },
        gerundio: 'casando', imperativoTu: 'casa', imperativoTuRefl: 'cásate', subjuntivoTu: 'cases',
        contrast: {
            reflexiveCue: 'el año que viene',
            plain: [{ phrase: 'a los novios en la iglesia', pron: 'los' }],
            note: '«Me caso» = mi propia boda; «el juez casa a los novios» = celebra la boda de OTROS: sin reflexivo.',
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
// ("cantar el coche", "cocinar el café"). Estas reglas podan solo el rincón
// implausible: el espacio combinatorio válido sigue siendo de miles de frases.

// Objetos directos que el verbo admite semánticamente: basta compartir una tag.
// Acepta un pool ya filtrado (p.ej. por nivel); por defecto usa el banco completo.
export const compatibleObjects = (verb: Verb, pool: DirectObject[] = DIRECT_OBJECTS): DirectObject[] =>
    pool.filter(od => od.tags.some(t => verb.accepts.includes(t)));

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

// True si el verbo admite este OI (veto por categoría: "vender … a los niños").
export const oiCompatible = (verb: Verb, oi: IndirectObject): boolean =>
    !verb.oiVeto?.includes(oi.category);

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
    { pre: 'empieza a', kind: 'inf' },
    { pre: 'vuelve a', kind: 'inf' },
    { pre: 'termina de', kind: 'inf' },
    { pre: 'está', kind: 'ger' },
    { pre: 'sigue', kind: 'ger' },
];
