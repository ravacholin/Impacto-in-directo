// INTERFERENCIA: objeto + un distractor textual (adverbio/contexto).
// En BASE es un solo pronombre (OD o reflexivo) con el mismo distractor adverbial.

import type { QuestionData } from '../../types';
import { resolverCluster, ADVERBIALS } from '../pronouns';
import {
    type GenContext,
    pick,
    pickDoubleCombo,
    buildSentence,
    buildDoubleOptions,
    explainCluster,
    generateReflexiveSingle,
    generateSingleOdPopUp,
} from './common';

export const generateInterference = (ctx: GenContext): QuestionData => {
    const adverbial = pick(ADVERBIALS);
    if (ctx.singleClitic) {
        // El adverbial hace de lead: "Hoy él ___ levanta." (reflexivo) o
        // "Hoy él da el libro" (OD, con minúscula inicial tras el adverbial).
        if (Math.random() < ctx.reflexiveShare) return generateReflexiveSingle(ctx, `${adverbial} `);
        const c = generateSingleOdPopUp(ctx);
        return { ...c, phrase: `${adverbial} ${c.phrase.charAt(0).toLowerCase()}${c.phrase.slice(1)}` };
    }
    const c = pickDoubleCombo(ctx);
    const sentence = buildSentence(c);
    // El adverbial va al frente; el resto de la frase en minúscula inicial.
    const phrase = `${adverbial} ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
    return {
        phrase,
        correctAnswer: resolverCluster(c.oi.pron, c.od.pron),
        options: buildDoubleOptions(c.oi, c.od),
        explanation: explainCluster(c.oi, c.od),
    };
};
