
import React from 'react';
import { Exercise, QuestionData, QuestionWithOptions, InstantSwitchQuestion, ExerciseType } from '../../types';

export const FeedbackUI = ({ exercise, question, feedback, aiFeedback }: { exercise: Exercise, question: QuestionData, feedback: 'pending' | 'correct' | 'incorrect' | 'timeout', aiFeedback: string | null }) => {
    // Semantic colors, but flat and matte.
    const messages = {
        pending: { text: 'ANALIZANDO...', color: 'text-zinc-100', borderColor: 'border-zinc-700' },
        correct: { text: 'RESPUESTA CORRECTA', color: 'text-emerald-400', borderColor: 'border-emerald-500' },
        incorrect: { text: 'ERROR DETECTADO', color: 'text-rose-400', borderColor: 'border-rose-500' },
        timeout: { text: 'TIEMPO AGOTADO', color: 'text-amber-400', borderColor: 'border-amber-500' },
    };

    if (exercise.type === ExerciseType.FORCED_COMMUNICATION) {
        if (feedback === 'correct') messages.correct.text = "TRANSMISIÓN ACEPTADA";
        if (feedback === 'incorrect') messages.incorrect.text = "TRANSMISIÓN RECHAZADA";
    }
    
    const msg = messages[feedback];
    if (!msg) return null;

    const showCorrectAnswer = (feedback === 'incorrect' || feedback === 'timeout') && exercise.type !== ExerciseType.FORCED_COMMUNICATION && exercise.type !== ExerciseType.DETECTOR;
    let correctAnswer: string | null = null;
    if (showCorrectAnswer) {
        if ('correctAnswer' in question) {
             correctAnswer = (question as QuestionWithOptions).correctAnswer;
        } else if ('transformedPhrase' in question) {
            correctAnswer = (question as InstantSwitchQuestion).transformedPhrase;
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm animate-fade-in pointer-events-auto"></div>
            
            <div className={`pointer-events-auto relative bg-zinc-950 border-y-2 ${msg.borderColor} p-12 w-full max-w-2xl text-center shadow-2xl transform transition-all animate-scale-up`}>
                <div className="absolute top-0 left-0 w-full h-full bg-grid opacity-10 pointer-events-none"></div>

                {feedback === 'pending' ? (
                     <div className="font-mono text-xs text-zinc-500 animate-pulse">PROCESANDO FLUJO DE ENTRADA...</div>
                ) : (
                    <div className="flex flex-col items-center">
                        <h2 className={`text-4xl md:text-5xl font-black mb-4 ${msg.color} tracking-tighter uppercase`}>{msg.text}</h2>
                        
                        <div className={`h-1 w-24 ${feedback === 'correct' ? 'bg-emerald-500' : 'bg-rose-500'} mb-8`}></div>

                        {correctAnswer && (
                            <div className="mt-4">
                                <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-[0.3em] mb-2">SOLUCIÓN ÓPTIMA</p>
                                <p className="text-3xl text-white font-bold tracking-tight">{correctAnswer}</p>
                            </div>
                        )}

                        {exercise.type === ExerciseType.FORCED_COMMUNICATION && aiFeedback && (
                            <div className="mt-8 text-left bg-zinc-900/50 p-6 border-l-2 border-zinc-700">
                                <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-2">ANÁLISIS</p>
                                <p className="text-zinc-300 leading-relaxed text-lg font-light">{aiFeedback}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
