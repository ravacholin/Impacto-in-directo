
import React from 'react';
import { QuestionData, QuestionWithOptions, InstantSwitchQuestion, DetectorQuestion, PronounPositionQuestion, ExerciseType } from '../../types';
import { isSpeechAvailable, speak } from '../../speech';

// Frase completa a pronunciar: la versión con pronombres más "hablable" según el
// tipo. Para los tipos con frase plena, la frase; para los de respuesta, la
// réplica correcta; para posición, la solución colocada.
const spokenPhrase = (type: ExerciseType, question: QuestionData): string => {
    if (type === ExerciseType.PRONOUN_POSITION) {
        const q = question as PronounPositionQuestion;
        const sol = q.tokens.find(t => t.kind === 'slot' && t.valid);
        return sol && sol.kind === 'slot' ? sol.result : q.chip;
    }
    if ('transformedPhrase' in question) return (question as InstantSwitchQuestion).transformedPhrase;
    if ('correctAnswers' in question) return (question as DetectorQuestion).correctAnswers[0] ?? '';
    if ('phrase' in question) return (question as { phrase: string }).phrase; // Pop-up / Interferencia / Decoder
    return (question as QuestionWithOptions).correctAnswer; // Respuesta Rápida / Corto Circuito
};

type FeedbackState = 'pending' | 'correct' | 'incorrect' | 'timeout' | null;

// Panel inferior de feedback. Un único layout para TODOS los tipos de ejercicio:
// estado (con ícono, no solo color), la regla aplicada con sus pasos, la
// respuesta correcta cuando hubo fallo, y un botón CONTINUAR para no esperar el
// avance automático. Recibe el tipo de la pregunta actual (sesiones heterogéneas).
export const FeedbackUI = ({ type, question, feedback, onContinue }: {
    type: ExerciseType;
    question: QuestionData;
    feedback: FeedbackState;
    onContinue?: () => void;
}) => {
    if (!feedback) return null;

    const messages = {
        pending: { text: 'ANALIZANDO...', icon: '…', color: 'text-zinc-100', borderColor: 'border-zinc-700', barColor: 'bg-zinc-700' },
        correct: { text: 'CORRECTO', icon: '✓', color: 'text-emerald-400', borderColor: 'border-emerald-500', barColor: 'bg-emerald-500' },
        incorrect: { text: 'INCORRECTO', icon: '✕', color: 'text-rose-400', borderColor: 'border-rose-500', barColor: 'bg-rose-500' },
        timeout: { text: 'TIEMPO AGOTADO', icon: '⏱', color: 'text-amber-400', borderColor: 'border-amber-500', barColor: 'bg-amber-500' },
    };

    const msg = messages[feedback];
    if (!msg) return null;

    if (feedback === 'pending') {
        return (
            <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
                <div className={`pointer-events-auto relative bg-zinc-950 border-t-2 ${msg.borderColor} p-8 w-full text-center shadow-2xl animate-slide-up`}>
                    <div className="font-mono text-xs text-ink-faint animate-pulse">PROCESANDO FLUJO DE ENTRADA...</div>
                </div>
            </div>
        );
    }

    const missed = feedback === 'incorrect' || feedback === 'timeout';
    const explanation = question.explanation;

    // Respuesta correcta a mostrar cuando hubo fallo. POSICIÓN muestra la(s)
    // frase(s) completas bien colocadas; el resto, la forma correcta.
    let correctLabel: string | null = null;
    let correctText: string | null = null;
    if (type === ExerciseType.PRONOUN_POSITION) {
        const q = question as PronounPositionQuestion;
        const solutions = q.tokens
            .filter((t): t is Extract<typeof t, { kind: 'slot' }> => t.kind === 'slot' && t.valid)
            .map(t => t.result);
        correctLabel = q.acceptsMultiple ? 'AMBAS SON CORRECTAS' : 'POSICIÓN CORRECTA';
        correctText = solutions.join('  /  ');
    } else if (missed) {
        correctLabel = 'RESPUESTA CORRECTA';
        if ('correctAnswer' in question) {
            correctText = (question as QuestionWithOptions).correctAnswer;
        } else if ('transformedPhrase' in question) {
            correctText = (question as InstantSwitchQuestion).transformedPhrase;
        } else if ('correctAnswers' in question) {
            correctText = (question as DetectorQuestion).correctAnswers[0];
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
            <div
                role="status"
                className={`pointer-events-auto relative bg-zinc-950 border-t-2 ${msg.borderColor} px-6 py-6 md:px-8 w-full shadow-2xl animate-slide-up max-h-[70vh] overflow-y-auto`}
            >
                <div className="absolute top-0 left-0 w-full h-full bg-grid opacity-10 pointer-events-none"></div>

                <div className="relative max-w-3xl mx-auto flex flex-col items-center text-center">
                    <h2 className={`text-2xl md:text-3xl font-black ${msg.color} tracking-tighter uppercase flex items-center gap-3`}>
                        <span aria-hidden="true">{msg.icon}</span>
                        {msg.text}
                    </h2>
                    <div className={`h-1 w-16 ${msg.barColor} mt-2 mb-4`}></div>

                    {/* Regla aplicada: siempre visible (refuerzo, no solo acierto/error). */}
                    {explanation && (
                        <div className="w-full border border-zinc-800 bg-zinc-900/40 px-4 py-3 md:px-6 md:py-4 mb-4 text-left">
                            <p className="hud-label mb-2">{explanation.title}</p>
                            <ul className="space-y-1">
                                {explanation.steps.map((step, i) => (
                                    <li key={i} className="font-mono text-xs md:text-sm text-zinc-300 leading-relaxed">
                                        <span className="text-ink-faint select-none">{'>'} </span>{step}
                                    </li>
                                ))}
                            </ul>
                            {missed && explanation.detail && (
                                <p className="mt-2 text-xs md:text-sm text-zinc-400 leading-relaxed">{explanation.detail}</p>
                            )}
                        </div>
                    )}

                    {correctText && (
                        <div className="mb-1">
                            <p className="hud-label mb-1">{correctLabel}</p>
                            <p className="text-lg md:text-2xl text-white font-bold tracking-tight">{correctText}</p>
                        </div>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                        {isSpeechAvailable() && (
                            <button
                                onClick={() => speak(spokenPhrase(type, question))}
                                className="bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-white hover:text-white font-mono text-xs font-bold uppercase tracking-[0.2em] py-3 px-8 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                                ESCUCHAR
                            </button>
                        )}
                        {missed && onContinue && (
                            <button
                                onClick={onContinue}
                                className="bg-zinc-100 text-zinc-950 hover:bg-white font-mono text-xs font-bold uppercase tracking-[0.2em] py-3 px-10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                                CONTINUAR →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
