
import React from 'react';

interface HeaderProps {
    title: string;
    onBack?: () => void;
    lives?: number;
    isInfinite?: boolean;
    onToggleInfinite?: () => void;
    isTimerEnabled?: boolean;
    onToggleTimer?: () => void;
    timeLeft?: number;
    totalTime?: number;
    onTimerClick?: () => void;
}

export const Header = ({ title, onBack, lives, isInfinite, onToggleInfinite, isTimerEnabled, onToggleTimer, timeLeft, totalTime, onTimerClick }: HeaderProps) => {

    // Calculate visual state for timer
    const renderTimer = () => {
        if (!isTimerEnabled || timeLeft === undefined || totalTime === undefined) return null;

        const percentage = (timeLeft / totalTime) * 100;
        const seconds = (timeLeft / 1000).toFixed(2);

        // Color logic: Standard -> Warning -> Critical
        let colorClass = "text-zinc-500 bg-zinc-500"; // Base
        if (percentage < 50) colorClass = "text-white bg-white";
        if (percentage < 20) colorClass = "text-rose-500 bg-rose-500";

        return (
            <div
                onClick={onTimerClick}
                title="Añadir +5s"
                className="absolute left-1/2 -translate-x-1/2 top-8 md:top-6 pointer-events-auto cursor-pointer flex flex-col items-center z-50 group transition-transform active:scale-90 select-none"
            >
                <span className={`font-mono text-xl md:text-2xl font-bold tracking-tighter tabular-nums transition-colors duration-200 ${colorClass.split(' ')[0]}`}>
                    {seconds}
                </span>
                <div className="w-32 h-0.5 bg-zinc-900 mt-1 overflow-hidden relative">
                    {/* Center-out depletion effect */}
                    <div
                        className={`absolute top-0 left-1/2 -translate-x-1/2 h-full transition-all duration-75 ease-linear ${colorClass.split(' ')[1]}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        );
    };

    return (
        <header className="fixed top-0 left-0 w-full px-6 py-6 z-40 pointer-events-none flex justify-between items-start">
            <div className="pointer-events-auto">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-3 text-zinc-600 hover:text-white transition-colors duration-300"
                    >
                        <div className="w-10 h-10 border border-zinc-800 bg-zinc-950/50 backdrop-blur flex items-center justify-center group-hover:border-zinc-500 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-widest hidden md:block opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">ABORTAR</span>
                    </button>
                )}
            </div>

            {/* Center HUD: Shows Title normally, or Timer if active */}
            {(!isTimerEnabled || timeLeft === undefined) && title && (
                <div className="absolute left-1/2 -translate-x-1/2 top-8 pointer-events-none hidden md:block">
                    <div className="flex flex-col items-center">
                        <span className="font-mono text-[9px] text-zinc-700 uppercase tracking-[0.3em] mb-1">SISTEMA</span>
                        <span className="text-sm font-bold text-zinc-400 tracking-widest border-b border-zinc-800 pb-1">{title.toUpperCase()}</span>
                    </div>
                </div>
            )}

            {/* Timer Overlay - Renders only when active */}
            {renderTimer()}

            <div className="pointer-events-auto flex items-center gap-4">
                {/* Settings HUD - Brutalist Style - Icons Only */}
                {(onToggleInfinite || onToggleTimer) && (
                    <div className="flex items-center gap-2">
                        {onToggleInfinite && (
                            <button
                                onClick={onToggleInfinite}
                                title={isInfinite ? "Modo Infinito Activado" : "Modo Limitado"}
                                className={`group relative h-10 w-12 border flex items-center justify-center transition-all duration-200 ${isInfinite
                                    ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                                    : 'bg-transparent border-zinc-900 text-zinc-700 hover:border-zinc-800 hover:text-zinc-500'
                                    }`}
                            >
                                {/* Technical LED indicator */}
                                <div className={`absolute top-1 right-1 w-1 h-1 rounded-none transition-all duration-300 ${isInfinite
                                    ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                                    : 'bg-zinc-800'
                                    }`} />

                                {/* Infinity Icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 18a4.5 4.5 0 000-9h-1.5a4.5 4.5 0 00-4.5 4.5 4.5 4.5 0 00-4.5-4.5H6.75a4.5 4.5 0 000 9h1.5a4.5 4.5 0 004.5-4.5 4.5 4.5 0 004.5 4.5h1.5z" />
                                </svg>
                            </button>
                        )}
                        {onToggleTimer && (
                            <button
                                onClick={onToggleTimer}
                                title={isTimerEnabled ? "Cronómetro Activado" : "Tiempo Libre"}
                                className={`group relative h-10 w-12 border flex items-center justify-center transition-all duration-200 ${isTimerEnabled
                                    ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                                    : 'bg-transparent border-zinc-900 text-zinc-700 hover:border-zinc-800 hover:text-zinc-500'
                                    }`}
                            >
                                {/* Technical LED indicator */}
                                <div className={`absolute top-1 right-1 w-1 h-1 rounded-none transition-all duration-300 ${isTimerEnabled
                                    ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                                    : 'bg-zinc-800'
                                    }`} />

                                {/* Clock Icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* Lives HUD */}
                {lives !== undefined && (
                    <div className="flex items-center gap-1 border-l border-zinc-900 pl-4 ml-2">
                        <span className="font-mono text-[9px] text-zinc-700 mr-2 uppercase hidden sm:inline">VIDAS</span>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 w-4 rounded-none transition-all duration-300 ${i < lives ? 'bg-zinc-200' : 'bg-zinc-900'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
};

export const LoadingScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 font-mono">
        <div className="w-64">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1 uppercase tracking-widest">
                <span>SINCRONIZACIÓN</span>
                <span className="animate-pulse text-zinc-300">PROCESANDO</span>
            </div>
            <div className="h-0.5 w-full bg-zinc-900 overflow-hidden">
                <div className="h-full bg-white animate-progress-indeterminate"></div>
            </div>
            <div className="mt-2 text-[10px] text-zinc-600 text-right">
                GENERANDO ENLACE...
            </div>
        </div>
    </div>
);

export const ErrorScreen = ({ error, onRetry }: { error: string, onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-zinc-950">
        <div className="w-full max-w-md border border-zinc-800 bg-zinc-900/20 p-8 backdrop-blur-sm relative">
            <h2 className="font-mono text-zinc-500 text-[10px] uppercase tracking-[0.2em] mb-6">FALLO DE SISTEMA</h2>
            <p className="text-xl font-bold text-white mb-8 leading-snug">{error}</p>
            <button onClick={onRetry} className="bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-[10px] font-bold uppercase tracking-widest py-4 px-8 transition-all hover:scale-[1.02]">
                REINICIAR SECUENCIA
            </button>
        </div>
    </div>
);
