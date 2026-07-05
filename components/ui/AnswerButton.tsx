
import React from 'react';

export const AnswerButton = React.memo(({ onClick, children, className, disabled }: { onClick: () => void; children: React.ReactNode, className?: string, disabled?: boolean }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`
            group relative w-full min-h-[72px] md:min-h-[100px] flex items-center justify-center px-6 py-4
            bg-transparent
            border border-zinc-600
            text-zinc-200 font-bold text-xl md:text-2xl text-center tracking-tight
            transition-all duration-200

            hover:bg-zinc-800 hover:border-zinc-400 hover:text-white hover:scale-[1.01]
            active:scale-[0.99] active:bg-zinc-700

            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950

            disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent disabled:hover:border-zinc-600

            /* Corner accents */
            before:absolute before:top-0 before:left-0 before:w-2 before:h-2 before:border-t before:border-l before:border-accent before:opacity-0 group-hover:before:opacity-100 before:transition-opacity
            after:absolute after:bottom-0 after:right-0 after:w-2 after:h-2 after:border-b after:border-r after:border-accent after:opacity-0 group-hover:after:opacity-100 after:transition-opacity

            ${className || ''}
        `}
    >
        <span className="relative z-10">{children}</span>
    </button>
));
