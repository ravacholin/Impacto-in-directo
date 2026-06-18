
import React from 'react';
import { Exercise, QuestionData, QuestionWithOptions, InstantSwitchQuestion, PronounPositionQuestion, ExerciseType } from '../../types';

export const FeedbackUI = ({ exercise, question, feedback }: { exercise: Exercise, question: QuestionData, feedback: 'pending' | 'correct' | 'incorrect' | 'timeout' }) => {
    // Semantic colors, but flat and matte.
    const messages = {
        pending: { text: 'ANALIZANDO...', color: 'text-zinc-100', borderColor: 'border-zinc-700' },
        correct: { text: 'RESPUESTA CORRECTA', color: 'text-emerald-400', borderColor: 'border-emerald-500' },
        incorrect: { text: 'ERROR DETECTADO', color: 'text-rose-400', borderColor: 'border-rose-500' },
        timeout: { text: 'TIEMPO AGOTADO', color: 'text-amber-400', borderColor: 'border-amber-500' },
    };

    const msg = messages[feedback];
    if (!msg) return null;

    // POSICIÓN: además del resultado, mostramos SIEMPRE la regla didáctica y la(s)
    // frase(s) bien colocada(s) (refuerzo del aprendizaje, no solo acierto/error).
    if (exercise.type === ExerciseType.PRONOUN_POSITION && feedback !== 'pending') {
        const q = question as PronounPositionQuestion;
        const solutions = q.tokens
            .filter((t): t is Extract<typeof t, { kind: 'slot' }> => t.kind === 'slot' && t.valid)
            .map(t => t.result);
        return (
            <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
                <div className={`pointer-events-auto relative bg-zinc-950 border-t-2 ${msg.borderColor} p-8 w-full text-center shadow-2xl transform transition-all animate-slide-up`}>
                    <div className="absolute top-0 left-0 w-full h-full bg-grid opacity-10 pointer-events-none"></div>
                    <div className="flex flex-col items-center">
                        <h2 className={`text-2xl md:text-4xl font-black mb-2 ${msg.color} tracking-tighter uppercase`}>{msg.text}</h2>
                        <div className={`h-1 w-16 ${feedback === 'correct' ? 'bg-emerald-500' : 'bg-rose-500'} mb-4`}></div>
                        <p className="max-w-2xl text-sm md:text-base text-zinc-300 font-medium mb-4">{q.rule}</p>
                        <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-[0.3em] mb-1">
                            {q.acceptsMultiple ? 'AMBAS SON CORRECTAS' : 'POSICIÓN CORRECTA'}
                        </p>
                        <p className="text-lg md:text-2xl text-white font-bold tracking-tight">{solutions.join('  /  ')}</p>
                    </div>
                </div>
            </div>
        );
    }

    const showCorrectAnswer = (feedback === 'incorrect' || feedback === 'timeout') && exercise.type !== ExerciseType.DETECTOR;
    let correctAnswer: string | null = null;
    if (showCorrectAnswer) {
        if ('correctAnswer' in question) {
            correctAnswer = (question as QuestionWithOptions).correctAnswer;
        } else if ('transformedPhrase' in question) {
            correctAnswer = (question as InstantSwitchQuestion).transformedPhrase;
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
            {/* No Backdrop, just content at bottom */}

            <div className={`pointer-events-auto relative bg-zinc-950 border-t-2 ${msg.borderColor} p-8 w-full text-center shadow-2xl transform transition-all animate-slide-up`}>
                <div className="absolute top-0 left-0 w-full h-full bg-grid opacity-10 pointer-events-none"></div>

                {feedback === 'pending' ? (
                    <div className="font-mono text-xs text-zinc-500 animate-pulse">PROCESANDO FLUJO DE ENTRADA...</div>
                ) : (
                    <div className="flex flex-col items-center">
                        <h2 className={`text-3xl md:text-4xl font-black mb-2 ${msg.color} tracking-tighter uppercase`}>{msg.text}</h2>

                        <div className={`h-1 w-16 ${feedback === 'correct' ? 'bg-emerald-500' : 'bg-rose-500'} mb-4`}></div>

                        {correctAnswer && (
                            <div className="mt-2 text-center">
                                <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-[0.3em] mb-1">SOLUCIÓN ÓPTIMA</p>
                                <p className="text-xl md:text-2xl text-white font-bold tracking-tight">{correctAnswer}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
