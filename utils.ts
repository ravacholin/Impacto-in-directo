// Loose text normalization shared across the engine (dedup keys) and the UI
// (answer comparison): lowercase and strip everything except Spanish letters,
// so spaces, punctuation and casing are ignored.
export const normalize = (str: string): string =>
    (str ?? '').toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
