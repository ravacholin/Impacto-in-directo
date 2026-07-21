// SWITCH INSTANTÁNEO: transformar la frase completa a su versión con pronombres.
// En BASE es solo OD ("Doy el libro." → "Lo doy."): los reflexivos ya son
// pronominales, no hay una frase "sin pronombre" que transformar.

import type { QuestionData } from '../../types';
import { resolverCluster } from '../pronouns';
import {
    type GenContext,
    pick,
    cap,
    pickSubject,
    pickCompatibleOD,
    pickDoubleCombo,
    buildSentence,
    explainSingleOd,
    explainCluster,
} from './common';

export const generateInstantSwitch = (ctx: GenContext): QuestionData => {
    if (ctx.singleClitic) {
        const verb = pick(ctx.verbPool);
        const { subject, showPronoun } = pickSubject();
        const od = pickCompatibleOD(ctx, verb);
        const verbForm = verb.forms[subject.key];
        const initialHead = showPronoun ? `${subject.pronoun} ${verbForm}` : cap(verbForm);
        // Proclisis con un OD suelto: el pronombre va DELANTE del verbo conjugado.
        const core = `${od.pron} ${verbForm}`;
        const transformed = showPronoun ? `${subject.pronoun} ${core}.` : `${cap(od.pron)} ${verbForm}.`;
        return {
            initialPhrase: `${initialHead} ${od.phrase}.`,
            transformedPhrase: transformed,
            acceptedAnswers: [core, `${subject.pronoun} ${core}`],
            explanation: explainSingleOd(od),
        };
    }
    const c = pickDoubleCombo(ctx);
    const cluster = resolverCluster(c.oi.pron, c.od.pron);
    const transformed = `${cap(cluster)} ${c.verbForm}.`;
    // Variantes válidas: con y sin sujeto explícito (la normalización ignora
    // espacios, mayúsculas y puntuación, así que basta con cubrir el sujeto).
    const accepted = [
        `${cluster} ${c.verbForm}`,
        `${c.subject.pronoun} ${cluster} ${c.verbForm}`,
    ];
    return {
        initialPhrase: `${buildSentence(c)}.`,
        transformedPhrase: transformed,
        acceptedAnswers: accepted,
        explanation: explainCluster(c.oi, c.od),
    };
};
