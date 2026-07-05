// Loose text normalization shared across the engine (dedup keys) and the UI
// (answer comparison): lowercase and strip everything except Spanish letters,
// so spaces, punctuation and casing are ignored.
export const normalize = (str: string): string =>
    (str ?? '').toLowerCase().replace(/[^a-záéíóúüñ]/g, '');

// Fisher–Yates. Única implementación de barajado de la app (un `sort` con
// comparador aleatorio produce permutaciones sesgadas).
export const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};
