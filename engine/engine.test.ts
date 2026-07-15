import { describe, it, expect } from 'vitest';
import { resolverCluster, attachEnclitic, attachReflexiveEnclitic, compatibleObjects, corefiere, VERBS, REFLEXIVE_VERBS } from './pronouns';
import { generateBatch } from './generator';
import { ExerciseType, QuestionWithOptions, PronounPositionQuestion, InstantSwitchQuestion, QuickResponseQuestion, ShortCircuitQuestion, DetectorQuestion } from '../types';
import { normalize } from '../utils';

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
        const aEl = { phrase: 'a él', pron: 'le', isThirdPerson: true } as const;
        const aElla = { phrase: 'a ella', pron: 'le', isThirdPerson: true } as const;
        expect(corefiere('el', aEl)).toBe(true);
        expect(corefiere('el', aElla)).toBe(false);
        expect(corefiere('nosotros', { phrase: 'a nosotros', pron: 'nos', isThirdPerson: false })).toBe(true);
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
        expect(phrases('cantar')).toEqual(['la canción']);
        // "servir" solo admite comida (no "el coche").
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
                    if (q.questionPhrase.startsWith('¿Te ')) expect(q.correctAnswer.startsWith('Sí, me ')).toBe(true);
                    else expect(q.correctAnswer.startsWith('Sí, nos ')).toBe(true);
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
        // Proporción natural de OI de 3ª persona: 12/16 = 75%. Con sesgo 0.6 la
        // media sube a ~90%; el umbral 0.8 separa ambos regímenes con margen.
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
