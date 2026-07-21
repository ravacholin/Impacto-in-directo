// OÍDO: comprensión auditiva de los clíticos. Se pronuncia la frase completa ya
// pronominalizada ("Se lo doy mañana.") y se muestra con el clúster tapado
// ("___ doy mañana."); el alumno elige el clúster que oyó. Los clíticos son
// átonos: lo difícil es justamente oírlos.
//
// Reutiliza la tubería del Pop-up (frase + clúster correcto + distractores
// homogéneos). `ruleId` heredado del modo usado (OD_AGREEMENT / CLITIC_ORDER /
// SE_TRANSFORM).

import type { QuestionData, EarQuestion } from '../../types';
import { resolverCluster } from '../pronouns';
import {
    type GenContext,
    pick,
    cap,
    pickSubject,
    pickCompatibleOD,
    pickDoubleCombo,
    buildSingleOptions,
    buildDoubleOptions,
    explainSingleOd,
    explainCluster,
} from './common';

// Colas temporales (presente/futuro próximo) para variar el ritmo.
const TAILS = ['', ' hoy', ' mañana', ' esta tarde', ' ahora', ' enseguida'];
const tail = (): string => (Math.random() < 0.5 ? pick(TAILS) : '');

export const generateEar = (ctx: GenContext): QuestionData => {
    if (ctx.singleClitic) {
        const verb = pick(ctx.verbPool);
        const { subject } = pickSubject();
        const od = pickCompatibleOD(ctx, verb);
        const verbForm = verb.forms[subject.key];
        const t = tail();
        const cluster = od.pron;
        const full = `${cap(cluster)} ${verbForm}${t}.`;
        const masked = `___ ${verbForm}${t}.`;
        const q: EarQuestion = {
            maskedPhrase: masked,
            fullPhrase: full,
            correctAnswer: cluster,
            options: buildSingleOptions(),
            explanation: explainSingleOd(od),
        };
        return q;
    }
    const c = pickDoubleCombo(ctx);
    const cluster = resolverCluster(c.oi.pron, c.od.pron);
    const t = tail();
    const full = `${cap(cluster)} ${c.verbForm}${t}.`;
    const masked = `___ ${c.verbForm}${t}.`;
    const q: EarQuestion = {
        maskedPhrase: masked,
        fullPhrase: full,
        correctAnswer: cluster,
        options: buildDoubleOptions(c.oi, c.od),
        explanation: explainCluster(c.oi, c.od),
    };
    return q;
};
