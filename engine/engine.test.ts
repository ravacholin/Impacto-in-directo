import { describe, it, expect } from 'vitest';
import { resolverCluster, attachEnclitic, compatibleObjects, corefiere, VERBS } from './pronouns';
import { generateBatch } from './generator';
import { ExerciseType, QuestionWithOptions, PronounPositionQuestion, InstantSwitchQuestion, QuickResponseQuestion, ShortCircuitQuestion } from '../types';
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

    it('los singles de nivel 1 explican OD_AGREEMENT (OD) o REFLEXIVE (reflexivo)', () => {
        const OD = new Set(['lo', 'la', 'los', 'las']);
        const REFL = new Set(['me', 'te', 'se', 'nos']);
        const singles = (generateBatch(ExerciseType.POP_UP_PRONOUN, 60, { difficulty: 1 }) as QuestionWithOptions[])
            .filter(q => !q.correctAnswer.includes(' '));
        expect(singles.length).toBeGreaterThan(0);
        for (const q of singles) {
            if (OD.has(q.correctAnswer)) expect(q.explanation.ruleId).toBe('OD_AGREEMENT');
            else if (REFL.has(q.correctAnswer)) expect(q.explanation.ruleId).toBe('REFLEXIVE');
            else throw new Error(`Respuesta single inesperada: "${q.correctAnswer}"`);
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

    it('nivel 1: aparecen preguntas reflexivas (me/te/se/nos) con ruleId REFLEXIVE y opciones homogéneas', () => {
        const REFL = new Set(['me', 'te', 'se', 'nos']);
        const qs = generateBatch(ExerciseType.POP_UP_PRONOUN, 120, { difficulty: 1 }) as QuestionWithOptions[];
        const reflex = qs.filter(q => REFL.has(q.correctAnswer));
        expect(reflex.length).toBeGreaterThan(0);
        for (const q of reflex) {
            expect(q.explanation.ruleId).toBe('REFLEXIVE');
            expect(new Set(q.options).size).toBe(q.options.length);
            for (const o of q.options) expect(REFL.has(o)).toBe(true);
        }
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

    it('el Detector sigue ejercitando "le → se" incluso en nivel 1', () => {
        for (const q of generateBatch(ExerciseType.DETECTOR, 10, { difficulty: 1 })) {
            expect(q.explanation.ruleId).toBe('SE_TRANSFORM');
        }
    });
});

describe('nivel 1: actividades desbloqueadas (un solo pronombre)', () => {
    const SINGLE = new Set(['lo', 'la', 'los', 'las', 'me', 'te', 'se', 'nos']);
    const OD = new Set(['lo', 'la', 'los', 'las']);
    const REFL = new Set(['me', 'te', 'se', 'nos']);

    it('Corto Circuito e Interferencia: siempre un pronombre suelto, con OD y reflexivos', () => {
        for (const type of [ExerciseType.SHORT_CIRCUIT, ExerciseType.INTERFERENCE]) {
            const qs = generateBatch(type, 120, { difficulty: 1 }) as QuestionWithOptions[];
            let sawOd = false;
            let sawRefl = false;
            for (const q of qs) {
                // Nunca un clúster doble.
                expect(q.correctAnswer.includes(' ')).toBe(false);
                expect(SINGLE.has(q.correctAnswer)).toBe(true);
                // Opciones homogéneas que incluyen la respuesta.
                const norms = q.options.map(normalize);
                expect(norms).toContain(normalize(q.correctAnswer));
                expect(new Set(norms).size).toBe(q.options.length);
                if (OD.has(q.correctAnswer)) { sawOd = true; expect(q.explanation.ruleId).toBe('OD_AGREEMENT'); }
                else if (REFL.has(q.correctAnswer)) { sawRefl = true; expect(q.explanation.ruleId).toBe('REFLEXIVE'); }
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

    it('Respuesta Rápida BASE: OD sin flip y reflexivo con flip te→me', () => {
        const qs = generateBatch(ExerciseType.QUICK_RESPONSE, 120, { difficulty: 1 }) as QuickResponseQuestion[];
        let sawRefl = false;
        let sawOd = false;
        for (const q of qs) {
            const norms = q.options.map(normalize);
            expect(norms).toContain(normalize(q.correctAnswer));
            expect(new Set(norms).size).toBe(q.options.length);
            expect(q.correctAnswer.startsWith('Sí, ')).toBe(true);
            // El pronombre de la respuesta es siempre uno solo.
            const pron = q.correctAnswer.replace('Sí, ', '').split(' ')[0];
            expect(SINGLE.has(pron)).toBe(true);
            if (q.questionPhrase.startsWith('¿Te ')) {
                sawRefl = true;
                expect(q.correctAnswer.startsWith('Sí, me ')).toBe(true);
                expect(q.explanation.ruleId).toBe('PERSON_FLIP');
            } else {
                sawOd = true;
                expect(OD.has(pron)).toBe(true);
                expect(q.explanation.ruleId).toBe('OD_AGREEMENT');
            }
        }
        expect(sawRefl).toBe(true);
        expect(sawOd).toBe(true);
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
