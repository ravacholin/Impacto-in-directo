import { describe, it, expect } from 'vitest';
import {
    resolverCluster,
    attachEnclitic,
    attachReflexiveEnclitic,
    compatibleObjects,
    corefiere,
    VERBS,
    REFLEXIVE_VERBS,
    DIRECT_OBJECTS,
    INDIRECT_OBJECTS,
    ADVERBIALS,
    OD_TAGS,
    type Verb,
    type DirectObject,
} from './pronouns';
import { generateBatch, buildPools } from './generator';
import { resetHistory, __testing } from './history';
import { Difficulty, ExerciseType, QuestionWithOptions, PronounPositionQuestion, InstantSwitchQuestion, QuickResponseQuestion, ShortCircuitQuestion, DetectorQuestion } from '../types';
import { normalize, describeQuestion } from '../utils';

const verbByInfinitive = (inf: string) => {
    const v = VERBS.find(x => x.infinitive === inf);
    if (!v) throw new Error(`Test verb "${inf}" not found`);
    return v;
};

describe('resolverCluster', () => {
    it('applies the le/les + lo/la/los/las -> se rule', () => {
        expect(resolverCluster('le', 'lo')).toBe('se lo');
        expect(resolverCluster('le', 'la')).toBe('se la');
        expect(resolverCluster('les', 'los')).toBe('se los');
        expect(resolverCluster('les', 'las')).toBe('se las');
    });

    it('keeps non-third-person indirect pronouns unchanged', () => {
        expect(resolverCluster('me', 'lo')).toBe('me lo');
        expect(resolverCluster('te', 'los')).toBe('te los');
        expect(resolverCluster('nos', 'la')).toBe('nos la');
    });
});

describe('attachEnclitic', () => {
    it('accents infinitives with a double clitic (esdrújula)', () => {
        expect(attachEnclitic('inf', verbByInfinitive('dar'), 'se lo')).toBe('dárselo');
        expect(attachEnclitic('inf', verbByInfinitive('vender'), 'se la')).toBe('vendérsela');
        expect(attachEnclitic('inf', verbByInfinitive('escribir'), 'se lo')).toBe('escribírselo');
    });

    it('accents gerunds with a double clitic', () => {
        expect(attachEnclitic('ger', verbByInfinitive('dar'), 'se lo')).toBe('dándoselo');
        expect(attachEnclitic('ger', verbByInfinitive('leer'), 'se lo')).toBe('leyéndoselo');
        expect(attachEnclitic('ger', verbByInfinitive('pedir'), 'se la')).toBe('pidiéndosela');
    });

    it('attaches clitics to the affirmative imperative form', () => {
        expect(attachEnclitic('imp', verbByInfinitive('dar'), 'se lo')).toBe('dáselo');
    });
});

describe('capa semántica', () => {
    it('deja al menos un objeto compatible por verbo (evita pick sobre pool vacío)', () => {
        for (const v of VERBS) {
            expect(compatibleObjects(v).length).toBeGreaterThan(0);
        }
    });

    it('detecta correferencia sujeto ↔ objeto indirecto', () => {
        const aEl = { phrase: 'a él', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 } as const;
        const aElla = { phrase: 'a ella', pron: 'le', isThirdPerson: true, category: 'adulto', level: 1 } as const;
        expect(corefiere('el', aEl)).toBe(true);
        expect(corefiere('el', aElla)).toBe(false);
        expect(corefiere('nosotros', { phrase: 'a nosotros', pron: 'nos', isThirdPerson: false, category: 'adulto', level: 1 })).toBe(true);
        expect(corefiere('yo', aEl)).toBe(false);
    });

    it('respeta las restricciones de selección verbo–objeto', () => {
        const verbByInf = (inf: string) => {
            const v = VERBS.find(x => x.infinitive === inf);
            if (!v) throw new Error(`Test verb "${inf}" not found`);
            return v;
        };
        const phrases = (inf: string) => compatibleObjects(verbByInf(inf)).map(o => o.phrase);

        // "repetir" pide contenido contable, no una factura.
        expect(phrases('repetir')).toContain('la noticia');
        expect(phrases('repetir')).not.toContain('la factura');
        // "cantar" solo admite canciones.
        expect(phrases('cantar')).toContain('la canción');
        for (const p of compatibleObjects(verbByInf('cantar'))) {
            expect(p.tags).toContain('cancion');
        }
        // "servir" solo admite comida y bebida (no "el coche").
        expect(phrases('servir')).not.toContain('el coche');
        expect(phrases('servir').length).toBeGreaterThan(0);
    });
});

const ALL_TYPES = Object.values(ExerciseType);

describe('generateBatch', () => {
    it('returns exactly the requested count for every exercise type', () => {
        for (const type of ALL_TYPES) {
            const batch = generateBatch(type, 5);
            expect(batch).toHaveLength(5);
        }
    });

    it('produces multiple-choice questions whose options include the correct answer', () => {
        const optionTypes = [
            ExerciseType.POP_UP_PRONOUN,
            ExerciseType.SHORT_CIRCUIT,
            ExerciseType.INTERFERENCE,
        ];
        for (const type of optionTypes) {
            for (const q of generateBatch(type, 20) as QuestionWithOptions[]) {
                const norms = q.options.map(normalize);
                expect(norms).toContain(normalize(q.correctAnswer));
                // Options are homogeneous and de-duplicated.
                expect(new Set(norms).size).toBe(q.options.length);
            }
        }
    });

    it('marks at least one valid slot for every position question', () => {
        for (const q of generateBatch(ExerciseType.PRONOUN_POSITION, 20) as PronounPositionQuestion[]) {
            expect(q.correctSlotIds.length).toBeGreaterThan(0);
            const validSlotIds = q.tokens
                .filter((t): t is Extract<typeof t, { kind: 'slot' }> => t.kind === 'slot' && t.valid)
                .map(t => t.id);
            expect([...validSlotIds].sort()).toEqual([...q.correctSlotIds].sort());
        }
    });

    it('throws for an unsupported exercise type', () => {
        expect(() => generateBatch('NOPE' as ExerciseType, 3)).toThrow();
    });
});

describe('explicaciones didácticas', () => {
    it('toda pregunta de todo tipo lleva una explicación con pasos', () => {
        for (const type of ALL_TYPES) {
            for (const q of generateBatch(type, 10)) {
                expect(q.explanation.title).toBeTruthy();
                expect(q.explanation.steps.length).toBeGreaterThan(0);
            }
        }
    });

    it('los clústeres con "se" explican SE_TRANSFORM y el resto CLITIC_ORDER', () => {
        for (const q of generateBatch(ExerciseType.SHORT_CIRCUIT, 30) as QuestionWithOptions[]) {
            if (q.correctAnswer.startsWith('se ')) {
                expect(q.explanation.ruleId).toBe('SE_TRANSFORM');
            } else {
                expect(q.explanation.ruleId).toBe('CLITIC_ORDER');
            }
        }
    });

    // Los singles de Pop-up son solo OD o reflexivo de concordancia: sus opciones
    // son siempre pronombres (lo/la/los/las o me/te/se/nos), nunca un artículo
    // suelto ni "(nada)".
    it('los singles de nivel 1 llevan la regla de su familia (OD o reflexivo), con respuesta de pronombre', () => {
        const OD = new Set(['lo', 'la', 'los', 'las']);
        const REFL = new Set(['me', 'te', 'se', 'nos']);
        const qs = generateBatch(ExerciseType.POP_UP_PRONOUN, 120, { difficulty: 1 }) as QuestionWithOptions[];
        expect(qs.length).toBeGreaterThan(0);
        for (const q of qs) {
            expect(q.correctAnswer.includes(' ')).toBe(false);
            switch (q.explanation.ruleId) {
                case 'OD_AGREEMENT': expect(OD.has(q.correctAnswer)).toBe(true); break;
                case 'REFLEXIVE': expect(REFL.has(q.correctAnswer)).toBe(true); break;
                default: throw new Error(`Regla single inesperada: "${q.explanation.ruleId}"`);
            }
        }
    });
});

describe('dificultad', () => {
    it('nivel 1 nunca dispara la transformación "se"', () => {
        const optionTypes = [ExerciseType.POP_UP_PRONOUN, ExerciseType.SHORT_CIRCUIT, ExerciseType.INTERFERENCE];
        for (const type of optionTypes) {
            for (const q of generateBatch(type, 40, { difficulty: 1 }) as QuestionWithOptions[]) {
                expect(q.correctAnswer.startsWith('se ')).toBe(false);
            }
        }
        for (const q of generateBatch(ExerciseType.INSTANT_SWITCH, 30, { difficulty: 1 }) as InstantSwitchQuestion[]) {
            expect(q.transformedPhrase.toLowerCase().startsWith('se ')).toBe(false);
        }
    });

    it('nivel 1: Pop-up es siempre de un solo pronombre (nunca doble)', () => {
        for (const q of generateBatch(ExerciseType.POP_UP_PRONOUN, 60, { difficulty: 1 }) as QuestionWithOptions[]) {
            expect(q.correctAnswer.includes(' ')).toBe(false);
        }
    });

    it('niveles 2 y 3: Pop-up es siempre doble (nunca un solo pronombre, ni con sesgo adaptativo)', () => {
        for (const difficulty of [2, 3] as const) {
            for (const weakRules of [[], ['OD_AGREEMENT']] as const) {
                for (const q of generateBatch(ExerciseType.POP_UP_PRONOUN, 80, { difficulty, weakRules: [...weakRules] }) as QuestionWithOptions[]) {
                    expect(q.correctAnswer.includes(' ')).toBe(true);
                }
            }
        }
    });

    it('nivel 1: aparecen preguntas reflexivas de concordancia con opciones homogéneas', () => {
        const REFL = new Set(['me', 'te', 'se', 'nos']);
        const qs = generateBatch(ExerciseType.POP_UP_PRONOUN, 120, { difficulty: 1 }) as QuestionWithOptions[];
        const reflex = qs.filter(q => q.explanation.ruleId === 'REFLEXIVE');
        expect(reflex.length).toBeGreaterThan(0);
        for (const q of reflex) {
            expect(REFL.has(q.correctAnswer)).toBe(true);
            expect(new Set(q.options).size).toBe(q.options.length);
            for (const o of q.options) expect(REFL.has(o)).toBe(true);
        }
    });

    it('nivel 1: Pop-up nunca ofrece un artículo suelto ni "(nada)" como opción (solo pronombres)', () => {
        const PRON = new Set(['lo', 'la', 'los', 'las', 'me', 'te', 'se', 'nos']);
        const qs = (generateBatch(ExerciseType.POP_UP_PRONOUN, 300, { difficulty: 1 }) as QuestionWithOptions[])
            .filter(q => q.explanation.ruleId === 'OD_AGREEMENT' || q.explanation.ruleId === 'REFLEXIVE');
        expect(qs.length).toBeGreaterThan(0);
        for (const q of qs) {
            for (const o of q.options) expect(PRON.has(o)).toBe(true);
        }
        // Las reglas de artículo/(nada) ya no aparecen en Pop-up.
        const rules = (generateBatch(ExerciseType.POP_UP_PRONOUN, 300, { difficulty: 1 }) as QuestionWithOptions[])
            .map(q => q.explanation.ruleId);
        expect(rules).not.toContain('REFLEXIVE_CONTRAST');
        expect(rules).not.toContain('REFLEXIVE_BODY');
    });

    it('nivel 1 limita POSICIÓN a conjugado/infinitivo/gerundio', () => {
        const allowed = new Set(['VERBO CONJUGADO', 'INFINITIVO', 'GERUNDIO']);
        for (const q of generateBatch(ExerciseType.PRONOUN_POSITION, 30, { difficulty: 1 }) as PronounPositionQuestion[]) {
            expect(allowed.has(q.contextLabel)).toBe(true);
        }
    });

    it('nivel 1: Posición usa un clítico suelto (OD o reflexivo), con enclisis de infinitivo sin tilde', () => {
        const single = new Set(['lo', 'la', 'los', 'las', 'me', 'te', 'se', 'nos']);
        let sawInfinitive = false;
        for (const q of generateBatch(ExerciseType.PRONOUN_POSITION, 80, { difficulty: 1 }) as PronounPositionQuestion[]) {
            // Siempre un solo pronombre suelto (nunca un clúster doble).
            expect(q.chip.includes(' ')).toBe(false);
            expect(single.has(q.chip)).toBe(true);
            if (q.contextLabel === 'INFINITIVO') {
                sawInfinitive = true;
                const enc = q.tokens.find((t): t is Extract<typeof t, { kind: 'slot' }> => t.kind === 'slot' && t.valid);
                // Infinitivo + 1 clítico → palabra llana: "para darlo"/"para levantarse",
                // nunca con tilde ("dárlo", "levantárse").
                expect(enc && /[áéíóú]/.test(enc.result)).toBe(false);
            }
        }
        expect(sawInfinitive).toBe(true);
    });

    it('nivel 1: Posición incluye reflexivos con enclisis correcta (infinitivo llano, gerundio esdrújulo)', () => {
        const REFL = new Set(['me', 'te', 'se', 'nos']);
        const allowed = new Set(['VERBO CONJUGADO', 'INFINITIVO', 'GERUNDIO']);
        const qs = generateBatch(ExerciseType.PRONOUN_POSITION, 200, { difficulty: 1 }) as PronounPositionQuestion[];
        const reflex = qs.filter(q => REFL.has(q.chip));
        expect(reflex.length).toBeGreaterThan(0);
        let sawInf = false;
        let sawGer = false;
        for (const q of reflex) {
            expect(allowed.has(q.contextLabel)).toBe(true);
            const valid = q.tokens.find((t): t is Extract<typeof t, { kind: 'slot' }> => t.kind === 'slot' && t.valid)!;
            if (q.contextLabel === 'INFINITIVO') {
                sawInf = true;
                // "para levantarse" → llana, sin tilde.
                expect(/[áéíóú]/.test(valid.result)).toBe(false);
                expect(valid.result).toMatch(/[a-z]rse\.$/);
            }
            if (q.contextLabel === 'GERUNDIO') {
                sawGer = true;
                // "…levantándose" → esdrújula, con tilde en la raíz del gerundio.
                expect(/[áéíóú]ndose\.$/.test(valid.result)).toBe(true);
            }
        }
        expect(sawInf).toBe(true);
        expect(sawGer).toBe(true);
    });

    it('nivel 2 excluye perífrasis; nivel 3 la incluye', () => {
        for (const q of generateBatch(ExerciseType.PRONOUN_POSITION, 40, { difficulty: 2 }) as PronounPositionQuestion[]) {
            expect(q.contextLabel).not.toBe('PERÍFRASIS');
        }
        const labels = (generateBatch(ExerciseType.PRONOUN_POSITION, 60, { difficulty: 3 }) as PronounPositionQuestion[])
            .map(q => q.contextLabel);
        expect(labels).toContain('PERÍFRASIS');
    });

    it('el Detector es reflexivo en nivel 1 y mezcla ambas familias en niveles 2/3', () => {
        // En BASE la regla "le → se" todavía no existe: el Detector drilla los
        // errores reflexivos clásicos.
        for (const q of generateBatch(ExerciseType.DETECTOR, 20, { difficulty: 1 })) {
            expect(['REFLEXIVE', 'REFLEXIVE_BODY']).toContain(q.explanation.ruleId);
        }
        for (const difficulty of [2, 3] as const) {
            const rules = generateBatch(ExerciseType.DETECTOR, 80, { difficulty }).map(q => q.explanation.ruleId);
            expect(rules).toContain('SE_TRANSFORM');
            expect(rules.some(r => r === 'REFLEXIVE' || r === 'REFLEXIVE_BODY')).toBe(true);
        }
    });

    it('Detector reflexivo: 4 opciones deduplicadas que incluyen la única respuesta correcta', () => {
        for (const q of generateBatch(ExerciseType.DETECTOR, 30, { difficulty: 1 }) as DetectorQuestion[]) {
            expect(q.options).toHaveLength(4);
            expect(new Set(q.options.map(normalize)).size).toBe(4);
            expect(q.correctAnswers).toHaveLength(1);
            expect(q.options).toContain(q.correctAnswers[0]);
        }
    });

    it('niveles 2/3: la Posición incluye variantes reflexivas (imperativos y perífrasis)', () => {
        // Nivel 2: imperativos reflexivos con "te"; la forma unida del afirmativo
        // es la curada a mano del verbo ("levántate", "ponte", "vete").
        const qs2 = generateBatch(ExerciseType.PRONOUN_POSITION, 200, { difficulty: 2 }) as PronounPositionQuestion[];
        const reflImp = qs2.filter(q => q.chip === 'te' && q.contextLabel.startsWith('IMPERATIVO'));
        expect(reflImp.length).toBeGreaterThan(0);
        for (const q of reflImp.filter(x => x.contextLabel === 'IMPERATIVO AFIRMATIVO')) {
            const valid = q.tokens.find((t): t is Extract<typeof t, { kind: 'slot' }> => t.kind === 'slot' && t.valid)!;
            expect(REFLEXIVE_VERBS.some(v => valid.result.includes(` ${v.imperativoTuRefl},`))).toBe(true);
        }
        // Nivel 3: perífrasis reflexiva ("Se va a levantar." / "Va a levantarse.")
        // con exactamente dos posiciones válidas.
        const qs3 = generateBatch(ExerciseType.PRONOUN_POSITION, 300, { difficulty: 3 }) as PronounPositionQuestion[];
        const reflPeri = qs3.filter(q => q.contextLabel === 'PERÍFRASIS' && q.chip === 'se');
        expect(reflPeri.length).toBeGreaterThan(0);
        for (const q of reflPeri) {
            expect(q.correctSlotIds).toHaveLength(2);
            expect(q.acceptsMultiple).toBe(true);
        }
    });
});

describe('nivel 1: actividades desbloqueadas (un solo pronombre)', () => {
    const SINGLE = new Set(['lo', 'la', 'los', 'las', 'me', 'te', 'se', 'nos']);
    const OD = new Set(['lo', 'la', 'los', 'las']);
    const REFL = new Set(['me', 'te', 'se', 'nos']);

    it('Corto Circuito e Interferencia: siempre una respuesta de un token, con OD y reflexivos', () => {
        for (const type of [ExerciseType.SHORT_CIRCUIT, ExerciseType.INTERFERENCE]) {
            const qs = generateBatch(type, 120, { difficulty: 1 }) as QuestionWithOptions[];
            let sawOd = false;
            let sawRefl = false;
            for (const q of qs) {
                // Nunca un clúster doble.
                expect(q.correctAnswer.includes(' ')).toBe(false);
                // Opciones homogéneas que incluyen la respuesta.
                const norms = q.options.map(normalize);
                expect(norms).toContain(normalize(q.correctAnswer));
                expect(new Set(norms).size).toBe(q.options.length);
                switch (q.explanation.ruleId) {
                    case 'OD_AGREEMENT': sawOd = true; expect(OD.has(q.correctAnswer)).toBe(true); break;
                    case 'REFLEXIVE': sawRefl = true; expect(REFL.has(q.correctAnswer)).toBe(true); break;
                    default: throw new Error(`Regla inesperada en nivel 1: "${q.explanation.ruleId}"`);
                }
            }
            expect(sawOd).toBe(true);
            expect(sawRefl).toBe(true);
        }
    });

    it('Corto Circuito reflexivo rotula el segundo panel como VERBO (persona + verbo → reflexivo)', () => {
        const qs = generateBatch(ExerciseType.SHORT_CIRCUIT, 120, { difficulty: 1 }) as ShortCircuitQuestion[];
        const reflex = qs.filter(q => REFL.has(q.correctAnswer));
        expect(reflex.length).toBeGreaterThan(0);
        for (const q of reflex) {
            expect(q.personLabel).toBe('PERSONA');
            expect(q.objectLabel).toBe('VERBO');
            expect(q.object.endsWith('se')).toBe(true); // infinitivo pronominal
        }
    });

    it('Switch Instantáneo: transforma un OD suelto en proclisis, sin disparar "se"', () => {
        const qs = generateBatch(ExerciseType.INSTANT_SWITCH, 40, { difficulty: 1 }) as InstantSwitchQuestion[];
        for (const q of qs) {
            const answer = (q.acceptedAnswers ?? [q.transformedPhrase])[0];
            const firstWord = answer.trim().split(' ')[0].toLowerCase();
            expect(OD.has(firstWord)).toBe(true);
            expect(q.transformedPhrase.toLowerCase().startsWith('se ')).toBe(false);
        }
    });

    it('Respuesta Rápida BASE: OD, volteo de persona (te→me, se→nos) y contraste', () => {
        const qs = generateBatch(ExerciseType.QUICK_RESPONSE, 200, { difficulty: 1 }) as QuickResponseQuestion[];
        let sawFlip = false;
        let sawOd = false;
        let sawContrast = false;
        for (const q of qs) {
            const norms = q.options.map(normalize);
            expect(norms).toContain(normalize(q.correctAnswer));
            expect(new Set(norms).size).toBe(q.options.length);
            expect(q.correctAnswer.startsWith('Sí, ')).toBe(true);
            // El pronombre de la respuesta es siempre uno solo.
            const pron = q.correctAnswer.replace('Sí, ', '').split(' ')[0];
            expect(SINGLE.has(pron)).toBe(true);
            switch (q.explanation.ruleId) {
                case 'PERSON_FLIP':
                    sawFlip = true;
                    // "¿Te ...?" (tú) y "¿Se ... usted?" (formal) responden en "me";
                    // "¿Ustedes ...?" responde en "nos".
                    if (q.questionPhrase.startsWith('¿Ustedes ')) expect(q.correctAnswer.startsWith('Sí, nos ')).toBe(true);
                    else expect(q.correctAnswer.startsWith('Sí, me ')).toBe(true);
                    break;
                case 'REFLEXIVE_CONTRAST':
                    // La pregunta lleva un OD animado; la trampa es el reflexivo.
                    sawContrast = true;
                    expect(OD.has(pron)).toBe(true);
                    expect(q.options.some(o => o.startsWith('Sí, me '))).toBe(true);
                    break;
                case 'OD_AGREEMENT':
                    sawOd = true;
                    expect(OD.has(pron)).toBe(true);
                    break;
                default: throw new Error(`Regla inesperada en Respuesta Rápida BASE: "${q.explanation.ruleId}"`);
            }
        }
        expect(sawFlip).toBe(true);
        expect(sawOd).toBe(true);
        expect(sawContrast).toBe(true);
    });
});

describe('sesgo adaptativo', () => {
    it('empuja hacia 3ª persona cuando SE_TRANSFORM está débil', () => {
        // La gran mayoría del pool de OI es de 3ª persona; con el sesgo 0.6
        // activo la media queda holgadamente por encima del umbral 0.8.
        const qs = generateBatch(ExerciseType.SHORT_CIRCUIT, 200, { difficulty: 2, weakRules: ['SE_TRANSFORM'] }) as QuestionWithOptions[];
        const seShare = qs.filter(q => q.correctAnswer.startsWith('se ')).length / qs.length;
        expect(seShare).toBeGreaterThan(0.8);
    });
});

describe('respuesta rápida', () => {
    it('genera opciones homogéneas que incluyen la respuesta correcta', () => {
        for (const q of generateBatch(ExerciseType.QUICK_RESPONSE, 30) as QuickResponseQuestion[]) {
            const norms = q.options.map(normalize);
            expect(norms).toContain(normalize(q.correctAnswer));
            expect(new Set(norms).size).toBe(q.options.length);
            expect(q.correctAnswer.startsWith('Sí, ')).toBe(true);
        }
    });

    it('voltea la persona: "¿Me…?" se contesta con "te"; 3ª persona con "se"', () => {
        for (const q of generateBatch(ExerciseType.QUICK_RESPONSE, 40) as QuickResponseQuestion[]) {
            if (q.questionPhrase.startsWith('¿Me ')) {
                expect(q.correctAnswer.startsWith('Sí, te ')).toBe(true);
                expect(q.explanation.ruleId).toBe('PERSON_FLIP');
            } else {
                expect(q.correctAnswer.startsWith('Sí, se ')).toBe(true);
                expect(q.explanation.ruleId).toBe('SE_TRANSFORM');
            }
        }
    });
});

describe('banco de verbos reflexivos', () => {
    it('todas las entradas están completas (imperativos, subjuntivo, tema, contraste, cuerpo)', () => {
        expect(REFLEXIVE_VERBS.length).toBeGreaterThanOrEqual(20);
        for (const v of REFLEXIVE_VERBS) {
            expect(v.infinitive.endsWith('se')).toBe(true);
            expect(v.theme).toBeTruthy();
            expect(v.imperativoTu.length).toBeGreaterThan(0);
            // El imperativo curado ya lleva el clítico "te" pegado.
            expect(v.imperativoTuRefl.endsWith('te')).toBe(true);
            expect(v.subjuntivoTu.length).toBeGreaterThan(0);
            if (v.contrast) {
                expect(v.contrast.reflexiveCue.length).toBeGreaterThan(0);
                expect(v.contrast.plain.length).toBeGreaterThan(0);
                expect(v.contrast.note.length).toBeGreaterThan(0);
            }
            for (const part of v.bodyParts ?? []) {
                // Siempre con artículo: la regla que se enseña.
                expect(['el', 'la', 'los', 'las']).toContain(part.split(' ')[0]);
            }
        }
        // Hay material suficiente para las variantes de contraste y de cuerpo.
        expect(REFLEXIVE_VERBS.filter(v => v.contrast).length).toBeGreaterThanOrEqual(8);
        expect(REFLEXIVE_VERBS.filter(v => v.bodyParts?.length).length).toBeGreaterThanOrEqual(3);
    });

    it('los imperativos reflexivos irregulares llevan la forma curada correcta', () => {
        const impRefl = (inf: string) => {
            const v = REFLEXIVE_VERBS.find(x => x.infinitive === inf);
            if (!v) throw new Error(`Verbo reflexivo "${inf}" no encontrado`);
            return v.imperativoTuRefl;
        };
        expect(impRefl('levantarse')).toBe('levántate');
        expect(impRefl('vestirse')).toBe('vístete');
        expect(impRefl('dormirse')).toBe('duérmete');
        // Irregulares monosílabos: SIN tilde.
        expect(impRefl('ponerse')).toBe('ponte');
        expect(impRefl('irse')).toBe('vete');
    });

    it('la enclisis reflexiva usa la forma curada en imperativo y acentúa bien inf/ger', () => {
        const ponerse = REFLEXIVE_VERBS.find(v => v.infinitive === 'ponerse')!;
        expect(attachReflexiveEnclitic('imp', ponerse, 'te')).toBe('ponte');
        expect(attachReflexiveEnclitic('inf', ponerse, 'se')).toBe('ponerse');
        expect(attachReflexiveEnclitic('ger', ponerse, 'se')).toBe('poniéndose');
        const irse = REFLEXIVE_VERBS.find(v => v.infinitive === 'irse')!;
        expect(attachReflexiveEnclitic('imp', irse, 'te')).toBe('vete');
        expect(attachReflexiveEnclitic('ger', irse, 'se')).toBe('yéndose');
    });
});

// ---------------------------------------------------------------------------
// Invariantes de calidad de las frases (bancos re-curados por niveles)
// ---------------------------------------------------------------------------

const ALL_DIFFICULTIES: Difficulty[] = [1, 2, 3];

const verbByInf = (inf: string): Verb => {
    const v = VERBS.find(x => x.infinitive === inf);
    if (!v) throw new Error(`Verbo "${inf}" no encontrado`);
    return v;
};

const odByPhrase = (phrase: string): DirectObject => {
    const o = DIRECT_OBJECTS.find(x => x.phrase === phrase);
    if (!o) throw new Error(`OD "${phrase}" no encontrado`);
    return o;
};

// Todas las formas superficiales con las que un verbo puede aparecer en una frase.
const verbSurfaceForms = (v: Verb): string[] => [
    ...Object.values(v.forms),
    v.infinitive,
    v.gerundio,
    v.imperativoTuSolo,
    v.subjuntivoTu,
];

// Pares verbo+OD que NUNCA deben poder generarse (sinsentidos conocidos).
// Cada par debe tener tags disjuntos; la generación se verifica por muestreo.
const BLACKLIST: Array<[string, string]> = [
    ['cocinar', 'el café'],
    ['cocinar', 'el té'],
    ['cocinar', 'la limonada'],
    ['confesar', 'la película'],
    ['confesar', 'el chiste'],
    ['recomendar', 'la factura'],
    ['repetir', 'la factura'],
    ['deber', 'los billetes'],
    ['mostrar', 'el secreto'],
    ['comunicar', 'el chiste'],
    ['cantar', 'el coche'],
    ['cantar', 'la factura'],
    ['dar', 'la canción'],
    ['prestar', 'las flores'],
    ['vender', 'las llaves'],
    ['firmar', 'el mensaje'],
    ['imprimir', 'la foto'],
    ['cobrar', 'el regalo'],
    ['decir', 'el paquete'],
    ['traducir', 'la pelota'],
    ['describir', 'la sopa'],
    ['servir', 'el coche'],
    ['alquilar', 'el pastel'],
    ['enviar', 'el coche'],
    ['explicar', 'el dinero'],
];

describe('blacklist de pares verbo+OD', () => {
    it('los pares vetados no comparten ningún tag (imposibles por construcción)', () => {
        for (const [inf, phrase] of BLACKLIST) {
            const verb = verbByInf(inf);
            const od = odByPhrase(phrase);
            const shared = od.tags.filter(t => verb.accepts.includes(t));
            expect(shared, `"${inf}" + "${phrase}" comparten ${shared.join(', ')}`).toHaveLength(0);
        }
    });

    it('pares naturales de control SÍ comparten tag', () => {
        const positives: Array<[string, string]> = [
            ['leer', 'el libro'],
            ['cocinar', 'el pastel'],
            ['contar', 'el secreto'],
            ['recomendar', 'la película'],
            ['firmar', 'el contrato'],
            ['servir', 'el café'],
        ];
        for (const [inf, phrase] of positives) {
            const verb = verbByInf(inf);
            const od = odByPhrase(phrase);
            expect(od.tags.some(t => verb.accepts.includes(t)), `"${inf}" + "${phrase}"`).toBe(true);
        }
    });

    it('ninguna frase generada contiene un par vetado (muestreo por tipo y nivel)', () => {
        // Borde de palabra manual: "recomiendas la canción" NO debe disparar el
        // patrón "das la canción" (substring de otra forma verbal legítima).
        const patterns = BLACKLIST.flatMap(([inf, phrase]) =>
            verbSurfaceForms(verbByInf(inf)).map(form =>
                new RegExp(`(^|[^a-záéíóúüñ])${form} ${phrase}`.toLowerCase())));
        for (const type of Object.values(ExerciseType)) {
            for (const difficulty of ALL_DIFFICULTIES) {
                for (const q of generateBatch(type, 120, { difficulty })) {
                    const text = JSON.stringify(q).toLowerCase();
                    for (const p of patterns) {
                        expect(p.test(text), `"${p.source}" en ${type} nivel ${difficulty}`).toBe(false);
                    }
                }
            }
        }
    });
});

describe('coherencia temporal (todo en presente)', () => {
    const FORBIDDEN_PAST = ['Ayer', 'Anoche', 'Esta mañana', 'La semana pasada', 'Anteayer', 'El año pasado'];

    it('ADVERBIALS no contiene adverbios que exijan pasado', () => {
        for (const a of ADVERBIALS) {
            for (const bad of FORBIDDEN_PAST) {
                expect(a.startsWith(bad), `adverbial "${a}"`).toBe(false);
            }
        }
    });

    it('ninguna frase de Interferencia arranca con un adverbio de pasado', () => {
        for (const difficulty of ALL_DIFFICULTIES) {
            const qs = generateBatch(ExerciseType.INTERFERENCE, 150, { difficulty }) as Array<QuestionWithOptions & { phrase: string }>;
            for (const q of qs) {
                for (const bad of FORBIDDEN_PAST) {
                    expect(q.phrase.startsWith(bad), `"${q.phrase}"`).toBe(false);
                }
            }
        }
    });
});

describe('higiene de tags y completitud de bancos', () => {
    it('cada tag es aceptado por >=1 verbo y llevado por >=1 objeto (sin huérfanos)', () => {
        for (const tag of OD_TAGS) {
            expect(VERBS.some(v => v.accepts.includes(tag)), `tag "${tag}" sin verbo`).toBe(true);
            expect(DIRECT_OBJECTS.some(o => o.tags.includes(tag)), `tag "${tag}" sin objeto`).toBe(true);
        }
    });

    it('todas las entradas tienen nivel válido y campos completos', () => {
        for (const v of VERBS) {
            expect([1, 2, 3]).toContain(v.level);
            expect(v.accepts.length).toBeGreaterThan(0);
            expect(v.gerundio.endsWith('ndo'), `gerundio de ${v.infinitive}`).toBe(true);
            expect(v.imperativoTuSolo.length).toBeGreaterThan(0);
            expect(v.imperativoTu.length).toBeGreaterThan(0);
            expect(v.subjuntivoTu.length).toBeGreaterThan(0);
            for (const form of Object.values(v.forms)) expect(form.length).toBeGreaterThan(0);
        }
        for (const o of DIRECT_OBJECTS) {
            expect([1, 2, 3]).toContain(o.level);
            expect(o.tags.length).toBeGreaterThan(0);
        }
        for (const oi of INDIRECT_OBJECTS) {
            expect([1, 2, 3]).toContain(oi.level);
            expect(['adulto', 'menor', 'profesional']).toContain(oi.category);
        }
        for (const r of REFLEXIVE_VERBS) {
            expect([1, 2, 3]).toContain(r.level);
        }
    });

    it('los bancos crecieron ("más de todo")', () => {
        expect(VERBS.length).toBeGreaterThanOrEqual(48);
        expect(DIRECT_OBJECTS.length).toBeGreaterThanOrEqual(95);
        expect(INDIRECT_OBJECTS.length).toBeGreaterThanOrEqual(30);
        expect(REFLEXIVE_VERBS.length).toBeGreaterThanOrEqual(30);
        expect(ADVERBIALS.length).toBeGreaterThanOrEqual(12);
    });

    it('irregulares nuevos: enclisis y formas curadas correctas', () => {
        const decir = verbByInf('decir');
        expect(decir.imperativoTuSolo).toBe('di');
        expect(attachEnclitic('imp', decir, 'se lo')).toBe('díselo');
        expect(attachEnclitic('ger', verbByInf('traducir'), 'se la')).toBe('traduciéndosela');
        expect(attachEnclitic('inf', verbByInf('agradecer'), 'se lo')).toBe('agradecérselo');
        expect(attachEnclitic('ger', verbByInf('corregir'), 'se los')).toBe('corrigiéndoselos');
        expect(verbByInf('agradecer').forms.yo).toBe('agradezco');
        expect(verbByInf('traducir').forms.yo).toBe('traduzco');
        expect(verbByInf('corregir').forms.yo).toBe('corrijo');
    });
});

describe('pools por nivel (léxico acumulativo)', () => {
    it('los pools son válidos y no vacíos en los tres niveles', () => {
        for (const d of ALL_DIFFICULTIES) {
            const pools = buildPools(d);
            expect(pools.verbPool.length).toBeGreaterThan(0);
            for (const v of pools.verbPool) {
                expect(v.level).toBeLessThanOrEqual(d);
                const compat = pools.compatByVerb.get(v.infinitive);
                expect(compat && compat.length, `pool de "${v.infinitive}" en nivel ${d}`).toBeTruthy();
                for (const od of compat!) expect(od.level).toBeLessThanOrEqual(d);
            }
            for (const od of pools.odPool) expect(od.level).toBeLessThanOrEqual(d);
            for (const oi of pools.oiLevelPool) expect(oi.level).toBeLessThanOrEqual(d);
            for (const r of pools.reflexivePool) expect(r.level).toBeLessThanOrEqual(d);
        }
    });

    it('ningún verbo del banco queda excluido de su nivel por falta de OD compatible', () => {
        for (const d of ALL_DIFFICULTIES) {
            const pools = buildPools(d);
            const expected = VERBS.filter(v => v.level <= d).map(v => v.infinitive).sort();
            const actual = pools.verbPool.map(v => v.infinitive).sort();
            expect(actual).toEqual(expected);
        }
    });

    it('BASE tiene léxico suficiente: >=30 OD con los cuatro pronombres', () => {
        const pools = buildPools(1);
        expect(pools.odPool.length).toBeGreaterThanOrEqual(30);
        for (const pron of ['lo', 'la', 'los', 'las'] as const) {
            expect(pools.odPool.filter(o => o.pron === pron).length).toBeGreaterThanOrEqual(5);
        }
        expect(pools.bareReflexivePool.length).toBeGreaterThanOrEqual(8);
        expect(pools.bodyReflexivePool.length).toBeGreaterThanOrEqual(3);
        expect(pools.contrastQrReflexivePool.length).toBeGreaterThanOrEqual(4);
    });

    it('nivel 2 tiene >=8 OI de 3ª persona (regla "se")', () => {
        const pools = buildPools(2);
        expect(pools.oiLevelPool.filter(o => o.isThirdPerson).length).toBeGreaterThanOrEqual(8);
    });

    it('los pools crecen con el nivel (acumulativos)', () => {
        const p1 = buildPools(1);
        const p2 = buildPools(2);
        const p3 = buildPools(3);
        expect(p2.odPool.length).toBeGreaterThan(p1.odPool.length);
        expect(p3.odPool.length).toBeGreaterThan(p2.odPool.length);
        expect(p2.verbPool.length).toBeGreaterThan(p1.verbPool.length);
        expect(p3.verbPool.length).toBeGreaterThan(p2.verbPool.length);
        // Todo lo de nivel 1 sigue disponible en el 3.
        for (const od of p1.odPool) expect(p3.odPool).toContainEqual(od);
    });
});

describe('el léxico respeta el nivel también en la generación', () => {
    // Palabras marcadoras de nivel 2/3 que jamás deben aparecer en una pregunta
    // BASE. Se eligen frases que no colisionan con los textos curados de los
    // contrastes reflexivos de nivel 1 (p.ej. "la mesa" y "el cartel" quedan
    // fuera de la lista porque aparecen en contrastes de ponerse/quitarse).
    const MARKERS_LEVEL_2_3 = [
        'la factura', 'el contrato', 'el presupuesto', 'el formulario',
        'la solicitud', 'el sueldo', 'la propina', 'el préstamo', 'el alquiler',
        'la decisión', 'la anécdota', 'el documental', 'el informe',
        'los documentos', 'la novela', 'la invitación', 'la moto',
    ];
    // Formas verbales inequívocas de verbos de nivel 2/3 (con espacio o comillas
    // alrededor para no confundirlas con sustantivos que las contienen).
    const VERB_MARKERS_2_3 = [
        'explico', 'devuelvo', 'recomiendo', 'ofrezco', 'confieso',
        'traduzco', 'alquilo', 'imprimo', 'corrijo', 'comparto',
    ];
    // Marcadores exclusivos de nivel 3 (no deben aparecer en nivel 2).
    const MARKERS_LEVEL_3 = [
        'el contrato', 'el presupuesto', 'la solicitud', 'el sueldo',
        'la propina', 'la decisión', 'la anécdota', 'el documental',
    ];
    const VERB_MARKERS_3 = ['confieso', 'traduzco', 'agradezco', 'alquilo', 'presento', 'comunico', 'dedico'];

    const containsVerbForm = (text: string, form: string): boolean =>
        text.includes(` ${form} `) || text.includes(`"${form} `) || text.includes(`¿${form} `) || text.includes(` ${form}.`) || text.includes(` ${form}?`);

    it('el nivel BASE nunca muestra léxico de niveles superiores', () => {
        for (const type of Object.values(ExerciseType)) {
            for (const q of generateBatch(type, 150, { difficulty: 1 })) {
                const text = JSON.stringify(q).toLowerCase();
                for (const m of MARKERS_LEVEL_2_3) {
                    expect(text.includes(m), `"${m}" apareció en ${type} BASE`).toBe(false);
                }
                for (const m of VERB_MARKERS_2_3) {
                    expect(containsVerbForm(text, m), `forma "${m}" en ${type} BASE`).toBe(false);
                }
            }
        }
    });

    it('el nivel 2 nunca muestra léxico exclusivo del nivel 3', () => {
        for (const type of Object.values(ExerciseType)) {
            for (const q of generateBatch(type, 150, { difficulty: 2 })) {
                const text = JSON.stringify(q).toLowerCase();
                for (const m of MARKERS_LEVEL_3) {
                    expect(text.includes(m), `"${m}" apareció en ${type} nivel 2`).toBe(false);
                }
                for (const m of VERB_MARKERS_3) {
                    expect(containsVerbForm(text, m), `forma "${m}" en ${type} nivel 2`).toBe(false);
                }
            }
        }
    });
});

describe('veto semántico verbo + OI', () => {
    it('los verbos transaccionales nunca combinan con menores; confesar solo con cercanos', () => {
        const vetoedMinor = ['vender', 'alquilar', 'cobrar', 'deber'].map(verbByInf);
        const minorPhrases = INDIRECT_OBJECTS.filter(o => o.category === 'menor').map(o => o.phrase.toLowerCase());
        const profPhrases = INDIRECT_OBJECTS.filter(o => o.category === 'profesional').map(o => o.phrase.toLowerCase());
        const confesar = verbByInf('confesar');
        const types = [ExerciseType.POP_UP_PRONOUN, ExerciseType.INTERFERENCE, ExerciseType.DETECTOR, ExerciseType.QUICK_RESPONSE, ExerciseType.INSTANT_SWITCH];
        for (const difficulty of [2, 3] as Difficulty[]) {
            for (const type of types) {
                for (const q of generateBatch(type, 200, { difficulty })) {
                    const text = JSON.stringify(q).toLowerCase();
                    for (const v of vetoedMinor) {
                        for (const form of verbSurfaceForms(v)) {
                            for (const oiPhrase of minorPhrases) {
                                const hasBoth = text.includes(` ${form.toLowerCase()} `) && text.includes(oiPhrase);
                                expect(hasBoth, `"${form} … ${oiPhrase}" en ${type} nivel ${difficulty}`).toBe(false);
                            }
                        }
                    }
                    for (const form of verbSurfaceForms(confesar)) {
                        for (const oiPhrase of [...minorPhrases, ...profPhrases]) {
                            const hasBoth = text.includes(form.toLowerCase()) && text.includes(oiPhrase);
                            expect(hasBoth, `"${form} … ${oiPhrase}" en ${type} nivel ${difficulty}`).toBe(false);
                        }
                    }
                }
            }
        }
    });
});

describe('imperativo afirmativo con forma suelta curada', () => {
    it('el token suelto es siempre un imperativoTuSolo (nunca la 3ª persona de un irregular)', () => {
        const soloForms = new Set(VERBS.map(v => v.imperativoTuSolo));
        const reflSolo = new Set(REFLEXIVE_VERBS.map(v => v.imperativoTu));
        for (const difficulty of [2, 3] as Difficulty[]) {
            const qs = generateBatch(ExerciseType.PRONOUN_POSITION, 250, { difficulty }) as PronounPositionQuestion[];
            for (const q of qs.filter(x => x.contextLabel === 'IMPERATIVO AFIRMATIVO')) {
                const looseToken = q.tokens[2];
                expect(looseToken.kind).toBe('word');
                if (looseToken.kind === 'word') {
                    expect(soloForms.has(looseToken.text) || reflSolo.has(looseToken.text), `token suelto "${looseToken.text}"`).toBe(true);
                    // "decir" es el caso trampa: el suelto es "di", jamás "dice".
                    expect(looseToken.text).not.toBe('dice');
                }
            }
        }
    });
});

describe('variedad del repertorio ampliado', () => {
    it('un lote de 25 preguntas es 100% único para todo tipo × nivel', () => {
        for (const type of Object.values(ExerciseType)) {
            for (const difficulty of ALL_DIFFICULTIES) {
                const batch = generateBatch(type, 25, { difficulty });
                expect(batch).toHaveLength(25);
                const keys = new Set(batch.map(q => normalize(JSON.stringify(q))));
                expect(keys.size, `${type} nivel ${difficulty}`).toBe(25);
            }
        }
    });
});

describe('registro de repeticiones entre lotes (modo infinito)', () => {
    // La clave real de una pregunta es lo que el alumno LEE (frase + respuesta),
    // no el objeto entero: las opciones se barajan al azar y no deben contar.
    const contentKeys = (type: ExerciseType, qs: ReturnType<typeof generateBatch>) =>
        qs.map(q => {
            const { prompt, correctAnswer } = describeQuestion(type, q);
            return `${normalize(prompt)}#${normalize(correctAnswer)}`;
        });

    it('dos lotes consecutivos del mismo tipo no repiten ninguna frase mientras el pool dé variedad', () => {
        for (const type of Object.values(ExerciseType)) {
            resetHistory(type);
            const first = contentKeys(type, generateBatch(type, 5, { difficulty: 3 }));
            const second = contentKeys(type, generateBatch(type, 5, { difficulty: 3 }));
            const seenInFirst = new Set(first);
            for (const k of second) {
                expect(seenInFirst.has(k), `${type}: "${k}" se repitió en el lote siguiente`).toBe(false);
            }
        }
    });

    it('dentro de un mismo lote de 5, ninguna frase se repite (el caso reportado: "de cinco, dos iguales")', () => {
        for (const type of Object.values(ExerciseType)) {
            resetHistory(type);
            const keys = contentKeys(type, generateBatch(type, 5, { difficulty: 3 }));
            expect(new Set(keys).size, type).toBe(keys.length);
        }
    });

    it('el historial recuerda lo reciente pero no crece sin límite', () => {
        resetHistory();
        const type = ExerciseType.POP_UP_PRONOUN;
        for (let i = 0; i < 40; i++) generateBatch(type, 20, { difficulty: 3 });
        const history = __testing.histories.get(type);
        expect(history).toBeDefined();
        expect(history!.size).toBeLessThanOrEqual(__testing.HISTORY_SIZE);
    });

    it('cuando se agota la variedad, repite en vez de colgarse o devolver menos preguntas', () => {
        // BASE + reflexivo de contraste es un pool chico: pedir muchas fuerza la
        // repetición, que debe llegar como último recurso, nunca como un lote
        // incompleto ni un cuelgue.
        resetHistory();
        const batch = generateBatch(ExerciseType.QUICK_RESPONSE, 500, { difficulty: 1 });
        expect(batch).toHaveLength(500);
    });
});
