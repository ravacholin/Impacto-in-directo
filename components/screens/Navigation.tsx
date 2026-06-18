
import React from 'react';
import { Module } from '../../types';
import { MODULES } from '../../constants';

/* --- NEW MINIMALIST HOME --- */

const Marquee = () => (
    <div className="w-full bg-white text-zinc-950 overflow-hidden py-2 border-y border-zinc-800">
        <div className="whitespace-nowrap animate-marquee flex gap-8">
            {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="font-mono text-[10px] font-bold uppercase tracking-widest">
                    SISTEMA ACTIVO // PROTOCOLO DE AUTOMATIZACIÓN // ESPERANDO ENTRADA //
                </span>
            ))}
        </div>
    </div>
);

const ModuleItem: React.FC<{ module: Module, index: number, onClick: () => void }> = ({ module, index, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="group w-full flex-1 min-h-0 flex items-center justify-between py-[clamp(0.5rem,2.5vh,3rem)] border-b border-zinc-900 hover:bg-white hover:px-8 transition-all duration-300 ease-out"
        >
            <div className="flex flex-col items-start text-left">
                <span className="font-mono text-xs text-zinc-600 group-hover:text-black mb-2 transition-colors">
                    {(index + 1).toString().padStart(2, '0')}
                </span>
                <h3 className="text-[clamp(1.75rem,4.5vh,3rem)] font-black text-zinc-300 group-hover:text-black tracking-tighter uppercase leading-none transition-colors">
                    {module.title}
                </h3>
            </div>

            {/* Description only visible on hover (Desktop) */}
            <div className="hidden lg:block opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 text-right max-w-xs">
                <p className="font-mono text-xs text-black uppercase tracking-wide leading-tight">
                    {module.description}
                </p>
            </div>
        </button>
    );
};

const MobileModuleCard: React.FC<{ module: Module, index: number, onClick: () => void }> = ({ module, index, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="group relative w-full text-left bg-zinc-900/40 border-b border-zinc-800 p-6 overflow-hidden transition-all duration-200 active:bg-white active:text-black"
        >
            {/* GIANT BACKGROUND NUMBER */}
            <span className="absolute -right-4 -bottom-10 text-[140px] font-black text-zinc-950 select-none pointer-events-none z-0 leading-none group-active:text-zinc-100/20">
                {index + 1}
            </span>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest border border-zinc-800 px-2 py-1 group-active:border-black group-active:text-black">
                        SEC_{(index + 1).toString().padStart(2, '0')}
                    </span>
                    <module.icon className="w-5 h-5 text-zinc-600 group-active:text-black" />
                </div>

                <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-2 leading-none group-active:text-black">
                    {module.title}
                </h3>
                <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-wide max-w-[80%] leading-relaxed group-active:text-zinc-800">
                    {module.description}
                </p>
            </div>
        </button>
    );
}

export const HomeScreen = ({ onSelectModule }: { onSelectModule: (module: Module) => void }) => {
    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col lg:flex-row font-sans selection:bg-white selection:text-black">

            {/* --- MOBILE LAYOUT --- */}
            <div className="lg:hidden flex flex-col min-h-screen">
                {/* Hero Section */}
                <div className="min-h-[42vh] flex flex-col justify-between p-6 border-b border-zinc-800 bg-zinc-950 relative overflow-hidden">

                    {/* Top Bar Mobile */}
                    <div className="flex justify-between items-center relative z-10">
                        <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                            GIMNASIO PRONOMINAL v3.5
                        </p>
                    </div>

                    <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none"></div>

                    <div className="relative z-10 mb-2 mt-4">
                        <img
                            src="/logo.png"
                            alt="Impacto (In)Directo"
                            className="w-full object-contain mix-blend-screen scale-110 origin-left"
                        />
                    </div>
                    <div className="w-12 h-1 bg-white mb-2"></div>
                    <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                        Del conocimiento al instinto.
                    </p>
                </div>

                {/* Technical Marquee */}
                <Marquee />

                {/* Module Feed */}
                <div className="flex flex-col pb-24">
                    {MODULES.map((module, idx) => (
                        <MobileModuleCard
                            key={module.id}
                            module={module}
                            index={idx}
                            onClick={() => onSelectModule(module)}
                        />
                    ))}
                </div>
            </div>


            {/* --- DESKTOP LAYOUT (Original) --- */}
            <div className="hidden lg:flex w-full h-screen">
                {/* LEFT PANEL */}
                <div className="w-1/2 p-16 h-screen sticky top-0 flex flex-col justify-between border-r border-zinc-900 bg-zinc-950 z-10 shrink-0">
                    {/* Desktop Logo */}
                    <div className="mt-0">
                        <img
                            src="/logo.png"
                            alt="Impacto (In)Directo"
                            className="w-full mb-8 object-contain origin-left"
                        />
                        <div className="w-12 h-1 bg-white mb-8"></div>
                        <p className="font-mono text-sm text-zinc-500 uppercase tracking-[0.2em] max-w-md leading-relaxed">
                            Del conocimiento al instinto.
                            <br />
                            Gimnasio de automatización sintáctica.
                        </p>
                    </div>

                    <div>
                        <p className="font-mono text-[10px] text-zinc-800 uppercase tracking-widest">
                            v3.5 // Brutal
                        </p>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="w-1/2 h-screen bg-zinc-950 flex flex-col">
                    <div className="px-16 py-[clamp(1rem,4vh,4rem)] flex-1 flex flex-col min-h-0">


                        <div className="flex flex-col flex-1 min-h-0">
                            {MODULES.map((module, idx) => (
                                <ModuleItem
                                    key={module.id}
                                    module={module}
                                    index={idx}
                                    onClick={() => onSelectModule(module)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* --- END SCREEN --- */
export const GameEndScreen = ({ score, total, onBack, onContinue, isLoading }: { score: number, total: number, onBack: () => void, onContinue?: () => void, isLoading?: boolean }) => {
    const percentage = Math.round((score / total) * 100) || 0;

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 relative">
            <h2 className="text-[15vw] font-black text-white leading-none tracking-tighter mb-4">
                {percentage}%
            </h2>
            <p className="font-mono text-sm text-zinc-500 uppercase tracking-[0.5em] mb-24">
                Sincronización
            </p>

            <div className="flex gap-16 md:gap-32 mb-24">
                <div className="flex flex-col items-center">
                    <span className="text-4xl font-bold text-white">{score}</span>
                    <span className="text-[10px] font-mono text-zinc-600 uppercase mt-2 tracking-widest">Aciertos</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-4xl font-bold text-zinc-700">{total}</span>
                    <span className="text-[10px] font-mono text-zinc-600 uppercase mt-2 tracking-widest">Total</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-center">
                <button
                    onClick={onBack}
                    className="text-zinc-500 hover:text-white font-mono text-xs uppercase tracking-widest transition-colors"
                >
                    [ Volver al Menú ]
                </button>

                {onContinue && (
                    <button
                        onClick={onContinue}
                        disabled={isLoading}
                        className={`bg-white text-black hover:bg-zinc-200 px-8 py-4 font-black text-xl uppercase tracking-widest transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isLoading ? 'CARGANDO...' : 'CONTINUAR (5)'}
                    </button>
                )}
            </div>
        </div>
    );
};
