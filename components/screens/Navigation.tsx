
import React, { useState } from 'react';
import { Module, Difficulty, RuleId } from '../../types';
import { MODULES } from '../../constants';
import { DEFAULT_BATCH_SIZE } from '../../engine';
import { loadSettings, saveSettings, getWeakestRule, getPriorityRules, RULE_NAMES } from '../../store';

/* --- HOME --- */

const Marquee = () => (
    <div className="w-full bg-white text-zinc-950 overflow-hidden py-2 border-y border-zinc-800 lg:hidden">
        <div className="whitespace-nowrap animate-marquee flex gap-8">
            {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="font-mono text-[10px] font-bold uppercase tracking-widest">
                    SISTEMA ACTIVO // PROTOCOLO DE AUTOMATIZACIÓN // ESPERANDO ENTRADA //
                </span>
            ))}
        </div>
    </div>
);

const DIFFICULTY_INFO: Record<Difficulty, { name: string; description: string }> = {
    1: { name: 'BASE', description: 'Un solo pronombre: directo o reflexivo. Contraste me lavo / lavo. Vocabulario cotidiano y más tiempo.' },
    2: { name: 'INTERMEDIO', description: 'Combinaciones completas con le/les → se. Reflexivos en imperativos. Más vocabulario.' },
    3: { name: 'AVANZADO', description: 'Perífrasis (también reflexivas), imperativos, vocabulario completo y menos tiempo.' },
};

const DifficultySelector = ({ difficulty, onChange }: { difficulty: Difficulty; onChange: (d: Difficulty) => void }) => (
    <div className="mt-8">
        <p className="hud-label mb-3">NIVEL</p>
        <div className="flex items-center gap-5" role="radiogroup" aria-label="Nivel de dificultad">
            {([1, 2, 3] as Difficulty[]).map(d => (
                <button
                    key={d}
                    role="radio"
                    aria-checked={difficulty === d}
                    onClick={() => onChange(d)}
                    className={`font-mono text-xs font-bold uppercase tracking-widest pb-1 border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${difficulty === d
                        ? 'text-white border-white'
                        : 'text-zinc-600 border-transparent hover:text-zinc-300'
                        }`}
                >
                    {`0${d} ${DIFFICULTY_INFO[d].name}`}
                </button>
            ))}
        </div>
        <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wide mt-3 max-w-xs leading-relaxed">
            {DIFFICULTY_INFO[difficulty].description}
        </p>
    </div>
);

// Tarjeta de módulo única para móvil y escritorio: descripción siempre visible
// (nada de información solo-en-hover).
const ModuleCard: React.FC<{ module: Module, index: number, onClick: () => void }> = ({ module, index, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="group relative w-full text-left bg-zinc-900/40 border-b border-zinc-800 p-6 lg:px-8 overflow-hidden transition-all duration-200 active:bg-white active:text-black lg:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
            {/* Número gigante de fondo */}
            <span className="absolute -right-4 -bottom-10 text-[140px] font-black text-zinc-950 select-none pointer-events-none z-0 leading-none group-active:text-zinc-100/20 lg:group-hover:text-zinc-100/40">
                {index + 1}
            </span>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest border border-zinc-800 px-2 py-1 group-active:border-black group-active:text-black lg:group-hover:border-black lg:group-hover:text-black">
                        SEC_{(index + 1).toString().padStart(2, '0')}
                    </span>
                    <module.icon className="w-5 h-5 text-zinc-500 group-active:text-black lg:group-hover:text-black" />
                </div>

                <h3 className="text-[clamp(1.375rem,6.5vw,1.875rem)] font-black text-white tracking-tighter uppercase mb-2 leading-none break-words group-active:text-black lg:group-hover:text-black">
                    {module.title}
                </h3>
                <p className="font-mono text-[10px] text-zinc-400 uppercase tracking-wide max-w-[80%] leading-relaxed group-active:text-zinc-800 lg:group-hover:text-zinc-800">
                    {module.description}
                </p>
            </div>
        </button>
    );
};

// Tarjeta contextual de Repaso Inteligente. Misma anatomía que ModuleCard pero
// destacada en `accent`. Solo se renderiza cuando hay reglas vencidas/débiles;
// su descripción nombra hasta 3 de esas reglas.
const ReviewCard: React.FC<{ ruleIds: RuleId[]; onClick: () => void }> = ({ ruleIds, onClick }) => {
    const names = ruleIds.slice(0, 3).map(r => RULE_NAMES[r]).join(' · ');
    return (
        <button
            onClick={onClick}
            className="group relative w-full text-left bg-accent/5 border-b-2 border-accent p-6 lg:px-8 overflow-hidden transition-all duration-200 active:bg-accent active:text-black lg:hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
            <span className="absolute -right-4 -bottom-10 text-[140px] font-black text-accent/5 select-none pointer-events-none z-0 leading-none group-active:text-black/10 lg:group-hover:text-black/10">
                ↻
            </span>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-[10px] text-accent uppercase tracking-widest border border-accent/50 px-2 py-1 group-active:border-black group-active:text-black lg:group-hover:border-black lg:group-hover:text-black">
                        PROTOCOLO DE REPASO
                    </span>
                </div>

                <h3 className="text-[clamp(1.375rem,6.5vw,1.875rem)] font-black text-accent tracking-tighter uppercase mb-2 leading-none break-words group-active:text-black lg:group-hover:text-black">
                    REPASO
                </h3>
                <p className="font-mono text-[10px] text-zinc-300 uppercase tracking-wide max-w-[85%] leading-relaxed group-active:text-zinc-800 lg:group-hover:text-zinc-800">
                    OBJETIVOS: {names}
                </p>
            </div>
        </button>
    );
};

export const HomeScreen = ({ onSelectModule, onStartReview }: { onSelectModule: (module: Module) => void; onStartReview: () => void }) => {
    const [difficulty, setDifficulty] = useState<Difficulty>(() => loadSettings().difficulty);

    // Recalculado en cada render de la home: si el repaso saldó las reglas, la
    // tarjeta desaparece sola al volver.
    const priorityRules = getPriorityRules();

    const changeDifficulty = (d: Difficulty) => {
        setDifficulty(d);
        saveSettings({ ...loadSettings(), difficulty: d });
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col lg:flex-row font-sans selection:bg-white selection:text-black">

            {/* Hero: ancho completo en móvil, columna izquierda fija en escritorio */}
            <div className="lg:w-1/2 lg:h-screen lg:sticky lg:top-0 flex flex-col justify-between p-6 lg:p-16 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950 relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none"></div>

                <div className="relative z-10">
                    <p className="hud-label mb-4">
                        GIMNASIO PRONOMINAL v4.0
                    </p>
                    <img
                        src="/logo.png"
                        alt="Impacto (In)Directo"
                        className="w-full max-w-xl object-contain mix-blend-screen origin-left mb-6"
                    />
                    <div className="w-12 h-1 bg-accent mb-4"></div>
                    <p className="font-mono text-[10px] lg:text-sm text-zinc-400 uppercase tracking-widest lg:tracking-[0.2em] max-w-md leading-relaxed">
                        Del conocimiento al instinto.
                        <span className="hidden lg:inline"><br />Gimnasio de automatización sintáctica.</span>
                    </p>

                    <DifficultySelector difficulty={difficulty} onChange={changeDifficulty} />
                </div>

                <div className="relative z-10 mt-8 lg:mt-0">
                    <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                        v4.0 // Brutal
                    </p>
                </div>
            </div>

            <Marquee />

            {/* Lista de módulos */}
            <div className="lg:w-1/2 flex flex-col pb-24 lg:pb-8 lg:h-screen lg:overflow-y-auto">
                {priorityRules.length > 0 && (
                    <ReviewCard ruleIds={priorityRules} onClick={onStartReview} />
                )}
                {MODULES.map((module, idx) => (
                    <ModuleCard
                        key={module.id}
                        module={module}
                        index={idx}
                        onClick={() => onSelectModule(module)}
                    />
                ))}
            </div>
        </div>
    );
};

/* --- END SCREEN --- */
export const GameEndScreen = ({ score, total, onBack, onContinue, isLoading }: { score: number, total: number, onBack: () => void, onContinue?: () => void, isLoading?: boolean }) => {
    const percentage = Math.round((score / total) * 100) || 0;
    const weakest = getWeakestRule();

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 relative">
            <h2 className="text-[clamp(4rem,15vw,11rem)] font-black text-white leading-none tracking-tighter mb-4">
                {percentage}%
            </h2>
            <p className="font-mono text-sm text-zinc-400 uppercase tracking-[0.5em] mb-16">
                Precisión
            </p>

            <div className="flex gap-16 md:gap-32 mb-12">
                <div className="flex flex-col items-center">
                    <span className="text-4xl font-bold text-white">{score}</span>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase mt-2 tracking-widest">Aciertos</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-4xl font-bold text-zinc-600">{total}</span>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase mt-2 tracking-widest">Total</span>
                </div>
            </div>

            {/* Punto débil global (historial reciente, todas las sesiones) */}
            {weakest && (
                <div className="border border-amber-500/40 bg-amber-500/5 px-6 py-3 mb-12 text-center">
                    <p className="hud-label mb-1">PUNTO DÉBIL DETECTADO</p>
                    <p className="font-mono text-xs md:text-sm text-amber-400 uppercase tracking-widest">
                        {RULE_NAMES[weakest.ruleId]} · {Math.round(weakest.accuracy * 100)}% de aciertos
                    </p>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-8 items-center">
                <button
                    onClick={onBack}
                    className="text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    [ Volver al Menú ]
                </button>

                {onContinue && (
                    <button
                        onClick={onContinue}
                        disabled={isLoading}
                        className={`bg-accent text-zinc-950 hover:brightness-110 px-8 py-4 font-black text-xl uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isLoading ? 'CARGANDO...' : `CONTINUAR (${DEFAULT_BATCH_SIZE})`}
                    </button>
                )}
            </div>
        </div>
    );
};
