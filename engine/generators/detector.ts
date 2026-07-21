// DETECTOR: elegir la forma pronominal correcta entre errores clásicos.
// En BASE es siempre reflexivo (la regla "le → se" pertenece a los niveles 2/3);
// en los niveles 2/3 mezcla ambas familias de errores según el contexto.

import type { QuestionData } from '../../types';
import { shuffle } from '../../utils';
import { resolverCluster, REFLEXIVE_PRON, REFLEXIVE_PRONOUNS, DIRECT_PRONOUNS, type DirectPronoun } from '../pronouns';
import {
    type GenContext,
    pick,
    cap,
    pickVariedSubject,
    pickDoubleCombo,
    explainReflexive,
    explainReflexiveBody,
    explainCluster,
    buildSentence,
    POSSESSIVES,
    type PossessiveKey,
    BODY_SUBJECTS,
} from './common';

// DETECTOR reflexivo: la frase correcta entre los errores clásicos de
// estudiantes. Dos variantes:
//  - Concordancia: "Yo me ducho." frente a persona equivocada ("Yo se ducho."),
//    pronombre pospuesto ("Yo ducho me.") y pronombre omitido ("Yo ducho.").
//  - Cuerpo: "Me lavo las manos." frente al posesivo redundante ("mis manos"),
//    el calco sin reflexivo ("Lavo mis manos.") y la parte sin artículo.
// El prompt da el material (infinitivo pronominal + sujeto), igual que el
// detector OI/OD da la frase fuente.
const generateReflexiveDetector = (ctx: GenContext): QuestionData => {
    if (Math.random() < 0.4) {
        const verb = pick(ctx.bodyReflexivePool);
        const subject = pickVariedSubject(BODY_SUBJECTS);
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
    const verb = pick(ctx.bareReflexivePool);
    const subject = pickVariedSubject();
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

export const generateDetector = (ctx: GenContext): QuestionData => {
    if (Math.random() < ctx.reflexiveDetectorShare) return generateReflexiveDetector(ctx);
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
