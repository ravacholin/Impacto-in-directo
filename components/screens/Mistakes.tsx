// MIS ERRORES: expone el registro local de fallos (`ii_errors_v1`, hoy de solo
// escritura) y permite lanzar un repaso dirigido a las reglas que se fallaron o
// borrar el registro. El repaso en sí lo arma App.tsx (generateMistakeReviewData);
// acá solo listamos y disparamos las acciones.

import React, { useState } from 'react';
import { loadErrors, clearErrors, RULE_NAMES } from '../../store';
import type { ErrorLogEntry } from '../../store';
import { Header } from '../ui/Shared';

// Fecha corta es-AR (ej. "11 sept, 14:05"). Si Intl falla por algo, caemos a una
// cadena vacía antes que romper la vista.
const fmtDate = (ts: number): string => {
    try {
        return new Intl.DateTimeFormat('es-AR', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        }).format(new Date(ts));
    } catch {
        return '';
    }
};

const MistakeRow: React.FC<{ entry: ErrorLogEntry }> = ({ entry }) => (
    <li className="border-b border-zinc-800 p-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 mb-3">
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest border border-zinc-800 px-2 py-1">
                {RULE_NAMES[entry.ruleId] ?? entry.ruleId}
            </span>
            <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wide shrink-0">
                {fmtDate(entry.ts)}
            </span>
        </div>

        <p className="text-white text-base lg:text-lg font-bold leading-snug mb-4 break-words">
            {entry.prompt}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border-l-2 border-rose-500/60 pl-3">
                <p className="hud-label mb-1 text-rose-400">TU RESPUESTA</p>
                <p className="font-mono text-xs text-zinc-300 break-words">
                    {entry.timedOut ? 'sin respuesta (se acabó el tiempo)' : (entry.userAnswer || '—')}
                </p>
            </div>
            <div className="border-l-2 border-accent/60 pl-3">
                <p className="hud-label mb-1 text-accent">CORRECTA</p>
                <p className="font-mono text-xs text-zinc-300 break-words">
                    {entry.correctAnswer || '—'}
                </p>
            </div>
        </div>
    </li>
);

export const MistakesScreen: React.FC<{ onBack: () => void; onStartReview: () => void }> = ({ onBack, onStartReview }) => {
    const [errors, setErrors] = useState<ErrorLogEntry[]>(() => loadErrors());

    const handleClear = () => {
        if (errors.length === 0) return;
        const ok = window.confirm('¿Borrar todo el registro de errores? No se puede deshacer.');
        if (!ok) return;
        clearErrors();
        setErrors([]);
    };

    const isEmpty = errors.length === 0;

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans relative">
            <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
            <Header title="Mis errores" onBack={onBack} />

            <div className="relative z-10 max-w-3xl mx-auto px-6 pt-28 pb-32 lg:pt-32">
                <p className="hud-label mb-2">REGISTRO LOCAL</p>
                <h1 className="text-[clamp(2rem,9vw,3.5rem)] font-black tracking-tighter uppercase leading-none mb-3">
                    Mis errores
                </h1>
                <p className="font-mono text-[10px] lg:text-xs text-zinc-400 uppercase tracking-wide leading-relaxed max-w-lg">
                    {isEmpty
                        ? 'Acá se guardan los ejercicios que fallaste.'
                        : `${errors.length} ${errors.length === 1 ? 'error registrado' : 'errores registrados'}. El repaso apunta a las reglas que fallaste, en tu nivel actual (no repite la pregunta exacta).`}
                </p>

                {isEmpty ? (
                    <div className="mt-12 border border-zinc-800 bg-zinc-900/20 p-8 text-center">
                        <p className="text-lg font-bold text-zinc-300 mb-2 leading-snug">
                            Todavía no registraste errores.
                        </p>
                        <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                            Entrená un poco y volvé.
                        </p>
                    </div>
                ) : (
                    <ul className="mt-8 border-t border-zinc-800">
                        {errors.map(entry => <MistakeRow key={entry.id} entry={entry} />)}
                    </ul>
                )}
            </div>

            {/* Botonera fija al pie */}
            <div className="fixed bottom-0 left-0 w-full bg-zinc-950/90 backdrop-blur border-t border-zinc-800 px-6 py-4 z-20">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <button
                        onClick={handleClear}
                        disabled={isEmpty}
                        className={`font-mono text-[10px] uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${isEmpty ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:text-rose-400'}`}
                    >
                        [ Borrar registro ]
                    </button>
                    <button
                        onClick={onStartReview}
                        disabled={isEmpty}
                        className={`bg-accent text-zinc-950 px-6 py-3 font-black text-sm lg:text-base uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${isEmpty ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-110'}`}
                    >
                        Repasar mis errores
                    </button>
                </div>
            </div>
        </div>
    );
};
