
import React, { useState } from 'react';
import { Module } from '../../types';
import { MODULES } from '../../constants';
import { Header } from '../ui/Shared';
import { validateApiKey } from '../../gemini';

/* --- API KEY SCREEN --- */
export const ApiKeyScreen = ({ onSave }: { onSave: (key: string) => void }) => {
    const [key, setKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!key.trim()) return;
        
        setIsValidating(true);
        setError(null);
        
        const isValid = await validateApiKey(key);
        
        if (isValid) {
            onSave(key);
        } else {
            setError("La API Key no es válida o no tiene permisos.");
            setIsValidating(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-300 font-mono">
            <div className="w-full max-w-lg">
                <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">
                    Acceso
                </h1>
                <p className="text-zinc-600 text-xs uppercase tracking-widest mb-12">
                    Gemini API Required
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <input 
                        type="text" 
                        value={key}
                        onChange={(e) => { setKey(e.target.value); setError(null); }}
                        placeholder="API KEY..."
                        className={`w-full bg-transparent border-b-2 ${error ? 'border-zinc-500' : 'border-zinc-800 focus:border-white'} py-4 text-white font-mono text-sm focus:outline-none transition-colors placeholder-zinc-800`}
                        disabled={isValidating}
                    />
                    
                    {error && <p className="text-zinc-500 text-xs font-mono">ERR: {error}</p>}

                    <button 
                        type="submit" 
                        disabled={!key.trim() || isValidating}
                        className="self-start text-white hover:text-zinc-400 disabled:opacity-50 font-bold text-xs uppercase tracking-[0.3em] py-4 transition-all"
                    >
                        {isValidating ? '...' : '[ ENTRAR ]'}
                    </button>
                </form>
            </div>
        </div>
    );
};

/* --- NEW MINIMALIST HOME --- */

const ModuleItem: React.FC<{ module: Module, index: number, onClick: () => void }> = ({ module, index, onClick }) => {
    return (
        <button 
            onClick={onClick}
            className="group w-full flex items-baseline justify-between py-8 md:py-12 border-b border-zinc-900 hover:bg-white hover:px-8 transition-all duration-300 ease-out"
        >
            <div className="flex flex-col items-start text-left">
                <span className="font-mono text-xs text-zinc-600 group-hover:text-black mb-2 transition-colors">
                    {(index + 1).toString().padStart(2, '0')}
                </span>
                <h3 className="text-3xl md:text-5xl font-black text-zinc-300 group-hover:text-black tracking-tighter uppercase transition-colors">
                    {module.title}
                </h3>
            </div>
            
            {/* Description only visible on hover (Desktop) or always subtle (Mobile) */}
            <div className="hidden md:block opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 text-right max-w-xs">
                 <p className="font-mono text-xs text-black uppercase tracking-wide leading-tight">
                    {module.description}
                 </p>
            </div>
            
            <div className="md:hidden opacity-0 group-hover:opacity-100">
                <span className="text-black font-bold">→</span>
            </div>
        </button>
    );
};

export const HomeScreen = ({ onSelectModule, onChangeApiKey }: { onSelectModule: (module: Module) => void, onChangeApiKey: () => void }) => {
    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col lg:flex-row">
            
            {/* FIXED CONFIG BUTTON (Top Right) */}
            <button 
                onClick={onChangeApiKey}
                className="fixed top-6 right-6 z-50 font-mono text-[10px] text-zinc-700 hover:text-white uppercase tracking-widest transition-colors"
            >
                [ LLAVE ]
            </button>

            {/* LEFT PANEL: IDENTITY (Sticky on Desktop) */}
            <div className="lg:w-1/2 p-8 md:p-16 lg:h-screen lg:sticky lg:top-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-zinc-900 bg-zinc-950 z-10 shrink-0">
                <div className="mt-12 lg:mt-0">
                    <h1 className="text-6xl md:text-8xl xl:text-9xl font-black tracking-tighter leading-[0.8] uppercase mb-8">
                        Impacto<br/>
                        <span className="text-zinc-700">(In)Directo</span>
                    </h1>
                    <div className="w-12 h-1 bg-white mb-8"></div>
                    <p className="font-mono text-xs md:text-sm text-zinc-500 uppercase tracking-[0.2em] max-w-md leading-relaxed">
                        Del conocimiento al instinto.
                        <br/>
                        Gimnasio de automatización sintáctica.
                    </p>
                </div>
                
                <div className="hidden lg:block">
                     <p className="font-mono text-[10px] text-zinc-800 uppercase tracking-widest">
                         v3.5 // Brutal
                     </p>
                </div>
            </div>

            {/* RIGHT PANEL: MODULES (Scrollable) */}
            <div className="lg:w-1/2 bg-zinc-950 flex flex-col">
                <div className="px-8 md:px-16 pt-16 pb-32">
                    <div className="mb-12 flex items-center gap-4">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                            Seleccionar Protocolo
                        </span>
                    </div>

                    <div className="flex flex-col">
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
    );
};

/* --- END SCREEN --- */
export const GameEndScreen = ({ score, total, onBack }: { score: number, total: number, onBack: () => void }) => {
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

            <button 
                onClick={onBack} 
                className="text-white hover:text-zinc-400 font-black text-xl uppercase tracking-widest transition-colors"
            >
                [ CERRAR SESIÓN ]
            </button>
        </div>
    );
};
