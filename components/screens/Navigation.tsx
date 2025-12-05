
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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-300 font-mono relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>
            <div className="w-full max-w-lg relative z-10">
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
                        SEC_{ (index + 1).toString().padStart(2, '0') }
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

export const HomeScreen = ({ onSelectModule, onChangeApiKey }: { onSelectModule: (module: Module) => void, onChangeApiKey: () => void }) => {
    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col lg:flex-row font-sans selection:bg-white selection:text-black">
            
            {/* --- MOBILE LAYOUT --- */}
            <div className="lg:hidden flex flex-col min-h-screen">
                {/* Hero Section */}
                <div className="min-h-[50vh] flex flex-col justify-between p-6 border-b border-zinc-800 bg-zinc-950 relative overflow-hidden">
                    
                    {/* Top Bar Mobile */}
                    <div className="flex justify-between items-center relative z-10">
                        <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                            GIMNASIO PRONOMINAL v3.5
                        </p>
                        <button 
                            onClick={onChangeApiKey}
                            className="font-mono text-[10px] text-zinc-700 hover:text-white uppercase tracking-widest"
                        >
                            [ LLAVE ]
                        </button>
                    </div>

                    <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none"></div>
                    
                    <div className="relative z-10 mb-4">
                        <h1 className="text-[13vw] font-black leading-[0.85] tracking-tighter uppercase text-white mix-blend-difference">
                            IMPACTO<br/>
                            <span className="text-zinc-600">(IN)DIRECTO</span>
                        </h1>
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
                {/* CONFIG BUTTON */}
                <button 
                    onClick={onChangeApiKey}
                    className="fixed top-6 right-6 z-50 font-mono text-[10px] text-zinc-700 hover:text-white uppercase tracking-widest transition-colors"
                >
                    [ LLAVE ]
                </button>

                {/* LEFT PANEL */}
                <div className="w-1/2 p-16 h-screen sticky top-0 flex flex-col justify-between border-r border-zinc-900 bg-zinc-950 z-10 shrink-0">
                    <div className="mt-0">
                        <h1 className="text-8xl xl:text-9xl font-black tracking-tighter leading-[0.8] uppercase mb-8">
                            Impacto<br/>
                            <span className="text-zinc-700">(In)Directo</span>
                        </h1>
                        <div className="w-12 h-1 bg-white mb-8"></div>
                        <p className="font-mono text-sm text-zinc-500 uppercase tracking-[0.2em] max-w-md leading-relaxed">
                            Del conocimiento al instinto.
                            <br/>
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
                <div className="w-1/2 bg-zinc-950 flex flex-col overflow-y-auto">
                    <div className="px-16 pt-16 pb-32">
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
