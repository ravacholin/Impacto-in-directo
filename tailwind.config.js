/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './engine/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      // Tokens semánticos del HUD. Valores tomados de la paleta zinc existente
      // más un único acento "volt"; los estados correcto/error/timeout siguen
      // siendo emerald/rose/amber.
      colors: {
        surface: { DEFAULT: '#09090b', raised: '#18181b', overlay: '#27272a' },
        line: { DEFAULT: '#27272a', strong: '#3f3f46', faint: '#18181b' },
        ink: { DEFAULT: '#fafafa', dim: '#a1a1aa', faint: '#71717a' },
        accent: { DEFAULT: '#a3e635', dim: '#4d7c0f' },
        ok: { DEFAULT: '#10b981', text: '#34d399' },
        err: { DEFAULT: '#f43f5e', text: '#fb7185' },
        warn: { DEFAULT: '#f59e0b', text: '#fbbf24' },
      },
    },
  },
  plugins: [],
};
