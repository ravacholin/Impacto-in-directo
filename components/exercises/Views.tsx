
import React, { useState } from 'react';
import { PopUpPronounQuestion, InterferenceQuestion, ShortCircuitQuestion, InstantSwitchQuestion, DetectorQuestion, QuestionWithOptions, PronounPositionQuestion } from '../../types';
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
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Reset input and focus when question changes
    React.useEffect(() => {
        setInputValue('');
        setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 50); // Small delay to ensure render
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
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        className="w-full bg-transparent border-b border-zinc-700 focus:border-white py-4 text-center text-4xl md:text-6xl font-bold text-white placeholder-zinc-800 focus:outline-none transition-colors duration-300 tracking-tight"
                        placeholder="ESCRIBIR_SALIDA"
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

export const PronounPositionView: React.FC<{ question: PronounPositionQuestion } & CommonViewProps> = ({ question, handleAnswer, feedback, userAnswer }) => {
    const isResultVisible = feedback === 'correct' || feedback === 'incorrect' || feedback === 'timeout';
    return (
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto h-full justify-center">
            <div className="flex items-center gap-4 mb-6 opacity-50">
                <div className="h-[1px] w-8 md:w-12 bg-zinc-500"></div>
                <p className="text-zinc-500 font-mono text-[8px] md:text-[10px] uppercase tracking-[0.3em]">PROTOCOLO DE POSICIÓN · {question.contextLabel}</p>
                <div className="h-[1px] w-8 md:w-12 bg-zinc-500"></div>
            </div>

            {/* Ficha del pronombre a colocar */}
            <div className="mb-10 md:mb-16 flex flex-col items-center gap-2">
                <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-[0.3em]">COLOCA ESTE PRONOMBRE</span>
                <div className="px-6 py-3 border border-zinc-600 bg-zinc-900/40 text-2xl md:text-4xl font-black text-white tracking-tight uppercase shadow-[0_0_25px_-10px_rgba(255,255,255,0.4)]">
                    {question.chip}
                </div>
            </div>

            {/* Frase tokenizada con huecos clicables */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-5 px-4 flex-1 content-center">
                {question.tokens.map((t, i) => {
                    if (t.kind === 'word') {
                        return <span key={i} className="text-3xl md:text-5xl font-black text-white tracking-tighter">{t.text}</span>;
                    }
                    let cls = "border-zinc-700 text-zinc-600 hover:border-white hover:text-white hover:bg-zinc-800";
                    if (isResultVisible) {
                        if (t.valid) cls = "!border-emerald-500 !text-emerald-400 bg-emerald-500/10";
                        else if (t.id === userAnswer) cls = "!border-rose-500 !text-rose-400 bg-rose-500/10";
                        else cls = "border-zinc-900 text-zinc-800 opacity-30";
                    }
                    return (
                        <button
                            key={i}
                            onClick={() => handleAnswer(t.id)}
                            disabled={!!feedback}
                            className={`px-4 py-2 md:px-5 md:py-3 border border-dashed text-base md:text-2xl font-bold lowercase tracking-tight transition-all duration-200 ${cls}`}
                        >
                            {question.chip}
                        </button>
                    );
                })}
            </div>
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
