
import React, { useState } from 'react';
import { PopUpPronounQuestion, InterferenceQuestion, ShortCircuitQuestion, InstantSwitchQuestion, ForcedCommunicationQuestion, DetectorQuestion, QuestionWithOptions } from '../../types';
import { AnswerButton } from '../ui/AnswerButton';

interface CommonViewProps {
    handleAnswer: (answer: string) => void;
    feedback: 'pending' | 'correct' | 'incorrect' | 'timeout' | null;
    userAnswer: string;
}

// Extreme normalization: remove ALL non-letter characters INCLUDING SPACES.
const normalize = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
};

/* --- EXISTING VIEWS --- */

export const PopUpPronounView: React.FC<{ question: PopUpPronounQuestion | InterferenceQuestion, shuffledOptions: string[] } & CommonViewProps> = ({ question, handleAnswer, shuffledOptions, feedback, userAnswer }) => (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full justify-center">
        <div className="flex-1 flex flex-col items-center justify-center mb-4 md:mb-8 w-full px-4">
            <div className="flex items-center gap-4 mb-4 md:mb-6 opacity-50">
                <div className="h-[1px] w-8 md:w-12 bg-zinc-500"></div>
                <p className="text-zinc-500 font-mono text-[8px] md:text-[10px] uppercase tracking-[0.3em]">IDENTIFICACIÓN DE OBJETIVO</p>
                <div className="h-[1px] w-8 md:w-12 bg-zinc-500"></div>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-8xl font-black text-white text-center leading-[0.9] tracking-tighter">
                {question.phrase}
            </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full max-w-4xl pb-4">
            {shuffledOptions.map(opt => {
                let buttonClass = "";
                const isResultVisible = feedback === 'correct' || feedback === 'incorrect' || feedback === 'timeout';

                if (isResultVisible) {
                    if (normalize(opt) === normalize(question.correctAnswer)) {
                        buttonClass = "!bg-emerald-500/10 !border-emerald-500 !text-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]";
                    } else if (opt === userAnswer && feedback !== 'correct') {
                        buttonClass = "!bg-rose-500/10 !border-rose-500 !text-rose-400";
                    } else {
                        buttonClass = "opacity-10 border-zinc-900 text-zinc-800";
                    }
                }

                return (
                    <AnswerButton
                        key={opt}
                        onClick={() => handleAnswer(opt)}
                        disabled={!!feedback}
                        className={buttonClass}
                    >
                        {opt}
                    </AnswerButton>
                );
            })}
        </div>
    </div>
);

export const ShortCircuitView: React.FC<{ question: ShortCircuitQuestion, shuffledOptions: string[] } & CommonViewProps> = ({ question, handleAnswer, shuffledOptions, feedback, userAnswer }) => (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full justify-center">
        <p className="font-mono text-zinc-600 text-[10px] uppercase tracking-[0.3em] mb-8 md:mb-12 mt-4">PROTOCOLO DE COMBINACIÓN</p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4 mb-8 md:mb-16 w-full flex-1">
            <div className="flex-1 w-full bg-zinc-900/30 border border-zinc-800 p-6 md:p-12 flex flex-col items-center justify-center relative h-full max-h-[200px] md:max-h-none">
                <div className="absolute top-2 left-2 md:top-4 md:left-4 font-mono text-[8px] md:text-[9px] text-zinc-600 uppercase tracking-widest">ENTRADA A</div>
                <h3 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter text-center">{question.person}</h3>
            </div>

            <div className="text-zinc-800 rotate-90 md:rotate-0 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" />
                </svg>
            </div>

            <div className="flex-1 w-full bg-zinc-900/30 border border-zinc-800 p-6 md:p-12 flex flex-col items-center justify-center relative h-full max-h-[200px] md:max-h-none">
                <div className="absolute top-2 left-2 md:top-4 md:left-4 font-mono text-[8px] md:text-[9px] text-zinc-600 uppercase tracking-widest">ENTRADA B</div>
                <h3 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter text-center">{question.object}</h3>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 w-full max-w-4xl pb-4">
            {shuffledOptions.map(opt => {
                let buttonClass = "";
                const isResultVisible = feedback === 'correct' || feedback === 'incorrect' || feedback === 'timeout';

                if (isResultVisible) {
                    if (normalize(opt) === normalize(question.correctAnswer)) {
                        buttonClass = "!bg-emerald-500/10 !border-emerald-500 !text-emerald-400";
                    } else if (opt === userAnswer && feedback !== 'correct') {
                        buttonClass = "!bg-rose-500/10 !border-rose-500 !text-rose-400";
                    } else {
                        buttonClass = "opacity-10 border-zinc-900";
                    }
                }

                return (
                    <AnswerButton
                        key={opt}
                        onClick={() => handleAnswer(opt)}
                        disabled={!!feedback}
                        className={buttonClass}
                    >
                        {opt}
                    </AnswerButton>
                );
            })}
        </div>
    </div>
);

export const InstantSwitchView: React.FC<{ question: InstantSwitchQuestion, isSubmitting: boolean } & CommonViewProps> = ({ question, handleAnswer, isSubmitting }) => {
    const [inputValue, setInputValue] = useState('');

    // Reset input when question changes
    React.useEffect(() => {
        setInputValue('');
    }, [question]);

    return (
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto h-full justify-center">
            <p className="font-mono text-zinc-600 text-[10px] uppercase tracking-[0.3em] mb-8 md:mb-16 mt-4">MOTOR DE TRANSFORMACIÓN</p>

            <h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-zinc-200 mb-12 md:mb-24 text-center leading-none tracking-tighter flex-1 flex items-center">
                {question.initialPhrase}
            </h2>

            <form onSubmit={(e) => { e.preventDefault(); handleAnswer(inputValue); }} className="w-full flex flex-col items-center gap-8 md:gap-12 pb-8">
                <div className="relative w-full max-w-3xl group">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        className="w-full bg-transparent border-b border-zinc-700 focus:border-white py-4 text-center text-4xl md:text-6xl font-bold text-white placeholder-zinc-800 focus:outline-none transition-colors duration-300 tracking-tight"
                        placeholder="ESCRIBIR_SALIDA"
                        autoFocus
                        disabled={isSubmitting}
                        autoComplete="off"
                    />
                </div>
                <button
                    type="submit"
                    className="bg-zinc-100 text-black hover:bg-white hover:scale-105 active:scale-95 font-mono text-xs uppercase tracking-[0.2em] py-4 px-12 transition-all duration-300 disabled:opacity-50"
                    disabled={isSubmitting || !inputValue.trim()}
                >
                    EJECUTAR
                </button>
            </form>
        </div>
    );
};

export const ForcedCommunicationView: React.FC<{ question: ForcedCommunicationQuestion, isSubmitting: boolean } & CommonViewProps> = ({ question, handleAnswer, isSubmitting }) => {
    const [inputValue, setInputValue] = useState('');

    // Reset input when question changes
    React.useEffect(() => {
        setInputValue('');
    }, [question]);

    return (
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto h-full justify-center py-4">
            <div className="w-full mb-8 md:mb-12 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 flex-1">

                <div className="md:col-span-4 border-l border-zinc-800 pl-6 py-2 flex flex-col justify-center">
                    <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-2">CONTEXTO</p>
                    <p className="text-zinc-400 text-base md:text-lg leading-relaxed">{question.scenario}</p>
                </div>

                <div className="md:col-span-8 bg-zinc-900/30 border border-zinc-800 p-6 md:p-10 relative flex flex-col justify-center">
                    <div className="absolute -top-3 -left-3 w-6 h-6 border-t border-l border-zinc-600"></div>
                    <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b border-r border-zinc-600"></div>
                    <p className="font-mono text-[10px] text-emerald-500 uppercase tracking-widest mb-4">TRANSMISIÓN ENTRANTE</p>
                    <p className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">"{question.prompt}"</p>
                </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleAnswer(inputValue); }} className="w-full flex flex-col gap-4 md:gap-8 pb-4">
                <div className="relative">
                    <textarea
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        className="w-full bg-black/40 border border-zinc-800 focus:border-zinc-500 p-6 md:p-8 text-white text-xl md:text-2xl font-medium focus:outline-none transition-all duration-300 resize-none min-h-[120px] md:min-h-[180px] leading-relaxed placeholder-zinc-800"
                        placeholder="Responder..."
                        disabled={isSubmitting}
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        className="bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold uppercase tracking-[0.2em] py-4 px-10 transition-all duration-300 disabled:opacity-50"
                        disabled={isSubmitting || !inputValue.trim()}
                    >
                        {isSubmitting ? 'ANALIZANDO...' : 'ENVIAR TRANSMISIÓN'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export const DetectorView: React.FC<{ question: DetectorQuestion, shuffledOptions: string[] } & CommonViewProps> = ({ question, handleAnswer, shuffledOptions, feedback, userAnswer }) => (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto h-full justify-center">
        <p className="font-mono text-zinc-600 text-[10px] uppercase tracking-[0.3em] mb-8 md:mb-12 mt-4">DETECCIÓN DE ANOMALÍA</p>
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-8 md:mb-16 text-center tracking-tighter flex-1 flex items-center">
            {question.prompt}
        </h2>
        <div className="flex flex-col gap-3 md:gap-4 w-full pb-8">
            {shuffledOptions.map(opt => {
                let stateStyles = "border-zinc-800 bg-zinc-900/20 text-zinc-400 hover:bg-zinc-900/50 hover:border-zinc-600 hover:text-white";

                if (feedback) {
                    const normOpt = normalize(opt);
                    const correctAnswers = (question.correctAnswers || []).map(normalize);

                    if (correctAnswers.includes(normOpt)) {
                        stateStyles = "bg-emerald-500/10 border-emerald-500 text-emerald-400";
                    } else if (opt === userAnswer) {
                        stateStyles = "bg-rose-500/10 border-rose-500 text-rose-400";
                    } else {
                        stateStyles = "opacity-20 border-transparent";
                    }
                }

                return (
                    <button
                        key={opt}
                        onClick={() => handleAnswer(opt)}
                        className={`relative w-full text-left py-4 px-6 md:py-6 md:px-8 border transition-all duration-200 text-lg md:text-xl font-mono tracking-tight flex items-center justify-between group ${stateStyles}`}
                        disabled={!!feedback}
                    >
                        <span>{opt}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-zinc-600 font-mono text-xs uppercase tracking-widest">
                            {feedback ? '' : 'SELECCIONAR'}
                        </span>
                    </button>
                );
            })}
        </div>
    </div>
);
