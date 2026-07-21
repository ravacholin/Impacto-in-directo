// POP-UP: reconocer el pronombre correcto de la frase mostrada. Mezcla de
// preguntas de uno y dos objetos (single directo o reflexivo en BASE; clúster
// doble en niveles 2/3).

import type { QuestionData } from '../../types';
import { resolverCluster } from '../pronouns';
import {
    type GenContext,
    pickDoubleCombo,
    buildSentence,
    buildDoubleOptions,
    explainCluster,
    generateReflexiveSingle,
    generateSingleOdPopUp,
} from './common';

export const generatePopUp = (ctx: GenContext): QuestionData => {
    const isDouble = Math.random() >= ctx.singleOdShare;
    if (isDouble) {
        const c = pickDoubleCombo(ctx);
        return {
            phrase: buildSentence(c),
            correctAnswer: resolverCluster(c.oi.pron, c.od.pron),
            options: buildDoubleOptions(c.oi, c.od),
            explanation: explainCluster(c.oi, c.od),
        };
    }
    // Single reflexivo (concordancia, contraste o cuerpo) o single OD.
    if (Math.random() < ctx.reflexiveShare) return generateReflexiveSingle(ctx);
    return generateSingleOdPopUp(ctx);
};
