// CORTO CIRCUITO: dos entradas → pronombre. Nivel 2/3: persona (OI) + objeto (OD)
// → clúster. BASE: la combinación genuina de dos entradas es reflexiva (persona +
// verbo → pronombre reflexivo); para OD se muestra verbo + objeto (la persona no
// interviene en el OD, por eso ese panel se rotula "VERBO", no "PERSONA").

import type { QuestionData } from '../../types';
import { resolverCluster, REFLEXIVE_PRON, REFLEXIVE_LEADS, ADVERBIALS } from '../pronouns';
import {
    type GenContext,
    pick,
    cap,
    pickVariedSubject,
    pickCompatibleOD,
    pickOI,
    buildReflexiveOptions,
    buildSingleOptions,
    buildDoubleOptions,
    explainReflexive,
    explainSingleOd,
    explainCluster,
} from './common';

// Lead adverbial opcional que ambienta el panel (mismos bancos que Pop-up/
// Interferencia). Aparece la mitad de las veces: así el ejercicio no repite
// siempre el mismo esqueleto pelado y tampoco pierde su ritmo seco de "dos
// elementos → pronombre".
const pickShortCircuitLead = (pool: string[]): string | undefined =>
    Math.random() < 0.5 ? pick(pool) : undefined;

export const generateShortCircuit = (ctx: GenContext): QuestionData => {
    if (ctx.singleClitic) {
        if (Math.random() < ctx.reflexiveShare) {
            const verb = pick(ctx.bareReflexivePool);
            const subject = pickVariedSubject();
            const pron = REFLEXIVE_PRON[subject.key];
            return {
                lead: pickShortCircuitLead(REFLEXIVE_LEADS),
                person: subject.pronoun,
                object: verb.infinitive,
                personLabel: 'PERSONA',
                objectLabel: 'VERBO',
                correctAnswer: pron,
                options: buildReflexiveOptions(),
                explanation: explainReflexive(subject, verb, pron),
            };
        }
        const verb = pick(ctx.verbPool);
        const od = pickCompatibleOD(ctx, verb);
        return {
            lead: pickShortCircuitLead(ADVERBIALS),
            person: cap(verb.infinitive),
            object: od.phrase,
            personLabel: 'VERBO',
            objectLabel: 'OBJETO',
            correctAnswer: od.pron,
            options: buildSingleOptions(),
            explanation: explainSingleOd(od),
        };
    }
    const od = pick(ctx.odPool);
    const oi = pickOI(ctx);
    return {
        lead: pickShortCircuitLead(ADVERBIALS),
        person: oi.phrase,
        object: od.phrase,
        correctAnswer: resolverCluster(oi.pron, od.pron),
        options: buildDoubleOptions(oi, od),
        explanation: explainCluster(oi, od),
    };
};
