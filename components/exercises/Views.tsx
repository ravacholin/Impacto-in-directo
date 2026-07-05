
import React, { useState } from 'react';
import { PopUpPronounQuestion, InterferenceQuestion, ShortCircuitQuestion, InstantSwitchQuestion, DetectorQuestion, PronounPositionQuestion, QuickResponseQuestion } from '../../types';
import { normalize } from '../../utils';
import { AnswerButton } from '../ui/AnswerButton';

interface CommonViewProps {
    handleAnswer: (answer: string) => void;
    feedback: 'pending' | 'correct' | 'incorrect' | 'timeout' | null;
    userAnswer: string;
}

/* --- Piezas compartidas --- */

// Etiqueta de instrucción sobre el enunciado (misma línea decorativa en todas
// las vistas; el texto dice QUÉ hacer, no jerga de HUD).
const InstructionLabel = ({ text }: { text: string }) => (
    <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 opacity-70">
        <div className="h-[1px] w-6 md:w-12 bg-zinc-500"></div>
        <p className="hud-label text-center">{text}</p>
        <div className="h-[1px] w-6 md:w-12 bg-zinc-500"></div>
    </div>
);

// Estado visual de una opción una vez revelado el resultado. El acierto/fallo
// no se comunica solo por color: se antepone un glifo ✓/✕.
const optionReveal = (opt: string, correctAnswer: string, userAnswer: string, feedback: CommonViewProps['feedback']) => {
    const isResultVisible = feedback === 'correct' || feedback === 'incorrect' || feedback === 'timeout';
    if (!isResultVisible) return { className: '', glyph: null as string | null };
    if (normalize(opt) === normalize(correctAnswer)) {
        return { className: '!bg-emerald-500/10 !border-emerald-500 !text-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]', glyph: '✓' };
    }
    if (opt === userAnswer && feedback !== 'correct') {
        return { className: '!bg-rose-500/10 !border-rose-500 !text-rose-400', glyph: '✕' };
    }
    return { className: 'opacity-20 border-zinc-900 text-zinc-600', glyph: null };
};

const OptionGrid = ({ options, correctAnswer, userAnswer, feedback, handleAnswer, columns = 'grid-cols-1 md:grid-cols-2' }: {
    options: string[];
    correctAnswer: string;
    handleAnswer: (answer: string) => void;
    columns?: string;
} & Pick<CommonViewProps, 'feedback' | 'userAnswer'>) => (
    <div className={`grid ${columns} gap-3 md:gap-4 w-full max-w-4xl pb-4`}>
        {options.map(opt => {
            const { className, glyph } = optionReveal(opt, correctAnswer, userAnswer, feedback);
            return (
                <AnswerButton
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={!!feedback}
                    className={className}
                >
                    {glyph && <span aria-hidden="true" className="mr-2">{glyph}</span>}
                    {opt}
                </AnswerButton>
            );
        })}
    </div>
);

/* --- Vistas por tipo --- */

export const PopUpPronounView = React.memo(({ question, handleAnswer, shuffledOptions, feedback, userAnswer }: { question: PopUpPronounQuestion | InterferenceQuestion, shuffledOptions: string[] } & CommonViewProps) => (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full justify-center">
        <div className="flex-1 flex flex-col items-center justify-center mb-4 md:mb-8 w-full px-4">
            <InstructionLabel text="¿QUÉ PRONOMBRES REEMPLAZAN AL OBJETO?" />
            <h2 className="text-[clamp(1.875rem,5.5vw,4.5rem)] font-black text-white text-center leading-[1.05] tracking-tighter text-balance break-words max-w-full">
                {question.phrase}
            </h2>
        </div>
        <OptionGrid
            options={shuffledOptions}
            correctAnswer={question.correctAnswer}
            userAnswer={userAnswer}
            feedback={feedback}
            handleAnswer={handleAnswer}
        />
    </div>
));

export const ShortCircuitView = React.memo(({ question, handleAnswer, shuffledOptions, feedback, userAnswer }: { question: ShortCircuitQuestion, shuffledOptions: string[] } & CommonViewProps) => (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full justify-center">
        <div className="mt-4 mb-8 md:mb-12">
            <InstructionLabel text="COMBINÁ PERSONA + OBJETO EN PRONOMBRES" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4 mb-8 md:mb-16 w-full flex-1">
            <div className="flex-1 w-full bg-zinc-900/30 border border-zinc-800 p-6 md:p-12 flex flex-col items-center justify-center relative h-full max-h-[200px] md:max-h-none">
                <div className="absolute top-2 left-2 md:top-4 md:left-4 hud-label">PERSONA</div>
                <h3 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter text-center">{question.person}</h3>
            </div>

            <div className="text-zinc-600 rotate-90 md:rotate-0 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" />
                </svg>
            </div>

            <div className="flex-1 w-full bg-zinc-900/30 border border-zinc-800 p-6 md:p-12 flex flex-col items-center justify-center relative h-full max-h-[200px] md:max-h-none">
                <div className="absolute top-2 left-2 md:top-4 md:left-4 hud-label">OBJETO</div>
                <h3 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter text-center">{question.object}</h3>
            </div>
        </div>
        <OptionGrid
            options={shuffledOptions}
            correctAnswer={question.correctAnswer}
            userAnswer={userAnswer}
            feedback={feedback}
            handleAnswer={handleAnswer}
            columns="grid-cols-2"
        />
    </div>
));

export const InstantSwitchView = React.memo(({ question, handleAnswer, isSubmitting }: { question: InstantSwitchQuestion, isSubmitting: boolean } & CommonViewProps) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Reset input and focus when question changes
    React.useEffect(() => {
        setInputValue('');
        const id = window.setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 50); // Small delay to ensure render
        return () => window.clearTimeout(id);
    }, [question]);

    return (
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto h-full justify-center">
            <div className="mt-4 mb-8 md:mb-16">
                <InstructionLabel text="REESCRIBÍ LA FRASE CON PRONOMBRES" />
            </div>

            <h2 className="text-[clamp(1.5rem,4.5vw,3.5rem)] font-black text-zinc-200 mb-12 md:mb-24 text-center leading-tight tracking-tighter text-balance break-words flex-1 flex items-center">
                {question.initialPhrase}
            </h2>

            <form onSubmit={(e) => { e.preventDefault(); handleAnswer(inputValue); }} className="w-full flex flex-col items-center gap-8 md:gap-12 pb-8">
                <div className="relative w-full max-w-3xl group">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        aria-label="Escribí la frase transformada"
                        className="w-full bg-transparent border-b border-zinc-700 focus:border-white py-4 text-center text-2xl md:text-4xl font-bold text-white placeholder-zinc-600 focus:outline-none transition-colors duration-300 tracking-tight"
                        placeholder="escribí tu respuesta…"
                        disabled={isSubmitting}
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                </div>
                <button
                    type="submit"
                    className="bg-accent text-zinc-950 hover:brightness-110 hover:scale-105 active:scale-95 font-mono text-xs font-bold uppercase tracking-[0.2em] py-4 px-12 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    disabled={isSubmitting || !inputValue.trim()}
                >
                    COMPROBAR
                </button>
            </form>
        </div>
    );
});

export const PronounPositionView = React.memo(({ question, handleAnswer, feedback, userAnswer }: { question: PronounPositionQuestion } & CommonViewProps) => {
    const isResultVisible = feedback === 'correct' || feedback === 'incorrect' || feedback === 'timeout';
    return (
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto h-full justify-center px-4 py-6 gap-6 md:gap-10">
            <InstructionLabel text={`¿DÓNDE VA EL PRONOMBRE? · ${question.contextLabel}`} />

            {/* Ficha del pronombre a colocar */}
            <div className="flex flex-col items-center gap-2">
                <span className="hud-label">COLOCÁ ESTE PRONOMBRE</span>
                <div className="px-5 py-2.5 md:px-6 md:py-3 border border-zinc-600 bg-zinc-900/40 text-2xl md:text-4xl font-black text-white tracking-tight lowercase shadow-[0_0_25px_-10px_rgba(255,255,255,0.4)]">
                    {question.chip}
                </div>
                <span className="hud-label">tocá el hueco correcto</span>
            </div>

            {/* Frase tokenizada con huecos clicables */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 md:gap-x-3 md:gap-y-4 leading-tight">
                {question.tokens.map((t, i) => {
                    if (t.kind === 'word') {
                        return <span key={i} className="text-xl sm:text-2xl md:text-4xl font-black text-white tracking-tight">{t.text}</span>;
                    }
                    let cls = "border-zinc-600 text-zinc-400 bg-zinc-900/40 hover:border-white hover:text-white hover:bg-zinc-800 active:scale-95";
                    let glyph: string | null = null;
                    if (isResultVisible) {
                        if (t.valid) { cls = "!border-emerald-500 !text-emerald-400 bg-emerald-500/10 border-solid"; glyph = '✓'; }
                        else if (t.id === userAnswer) { cls = "!border-rose-500 !text-rose-400 bg-rose-500/10 border-solid"; glyph = '✕'; }
                        else cls = "border-zinc-900 text-zinc-700 opacity-30";
                    }
                    return (
                        <button
                            key={i}
                            onClick={() => handleAnswer(t.id)}
                            disabled={!!feedback}
                            aria-label={`Colocar ${question.chip} en esta posición`}
                            className={`px-3 py-1.5 md:px-5 md:py-2.5 rounded-md border border-dashed text-base sm:text-lg md:text-2xl font-bold lowercase tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${cls}`}
                        >
                            {glyph && <span aria-hidden="true" className="mr-1">{glyph}</span>}
                            {t.display}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

export const DetectorView = React.memo(({ question, handleAnswer, shuffledOptions, feedback, userAnswer }: { question: DetectorQuestion, shuffledOptions: string[] } & CommonViewProps) => (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto h-full justify-center">
        <div className="mt-4 mb-8 md:mb-12">
            <InstructionLabel text="ELEGÍ LA ÚNICA FRASE CORRECTA" />
        </div>
        <h2 className="text-[clamp(1.5rem,4.5vw,3.5rem)] font-black text-white mb-8 md:mb-16 text-center tracking-tighter text-balance break-words flex-1 flex items-center">
            {question.prompt}
        </h2>
        <div className="flex flex-col gap-3 md:gap-4 w-full pb-8">
            {shuffledOptions.map(opt => {
                let stateStyles = "border-zinc-700 bg-zinc-900/20 text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-500 hover:text-white";
                let glyph: string | null = null;

                if (feedback) {
                    const normOpt = normalize(opt);
                    const correctAnswers = (question.correctAnswers || []).map(normalize);

                    if (correctAnswers.includes(normOpt)) {
                        stateStyles = "bg-emerald-500/10 border-emerald-500 text-emerald-400";
                        glyph = '✓';
                    } else if (opt === userAnswer) {
                        stateStyles = "bg-rose-500/10 border-rose-500 text-rose-400";
                        glyph = '✕';
                    } else {
                        stateStyles = "opacity-20 border-transparent";
                    }
                }

                return (
                    <button
                        key={opt}
                        onClick={() => handleAnswer(opt)}
                        className={`relative w-full text-left py-4 px-6 md:py-6 md:px-8 border transition-all duration-200 text-lg md:text-xl font-mono tracking-tight flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${stateStyles}`}
                        disabled={!!feedback}
                    >
                        <span>
                            {glyph && <span aria-hidden="true" className="mr-2">{glyph}</span>}
                            {opt}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-zinc-500 font-mono text-xs uppercase tracking-widest">
                            {feedback ? '' : 'SELECCIONAR'}
                        </span>
                    </button>
                );
            })}
        </div>
    </div>
));

// RESPUESTA RÁPIDA: pregunta en tono de diálogo, respuestas como réplicas.
export const QuickResponseView = React.memo(({ question, handleAnswer, shuffledOptions, feedback, userAnswer }: { question: QuickResponseQuestion, shuffledOptions: string[] } & CommonViewProps) => (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full justify-center">
        <div className="flex-1 flex flex-col items-center justify-center mb-4 md:mb-8 w-full px-4">
            <InstructionLabel text="CONTESTÁ CON EL PRONOMBRE CORRECTO" />
            <div className="border border-zinc-700 bg-zinc-900/40 px-6 py-4 md:px-10 md:py-6 max-w-full">
                <p className="hud-label mb-2 text-left">TE PREGUNTAN:</p>
                <h2 className="text-[clamp(1.5rem,4.5vw,3.5rem)] font-black text-white text-center leading-tight tracking-tighter text-balance break-words">
                    {question.questionPhrase}
                </h2>
            </div>
        </div>
        <OptionGrid
            options={shuffledOptions}
            correctAnswer={question.correctAnswer}
            userAnswer={userAnswer}
            feedback={feedback}
            handleAnswer={handleAnswer}
        />
    </div>
));
