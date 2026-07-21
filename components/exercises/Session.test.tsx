// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ExerciseType, type Exercise, type SessionItem } from '../../types';
import type { Settings } from '../../store';

// --- Mocks ---
// store: espiamos recordAttempt e inyectamos ajustes controlados por test.
vi.mock('../../store', async (io) => {
    const actual = await io<typeof import('../../store')>();
    return { ...actual, recordAttempt: vi.fn(), saveSettings: vi.fn(), loadSettings: vi.fn() };
});
// engine: DEFAULT_BATCH_SIZE real; generateExerciseData mockeado (modo infinito).
vi.mock('../../engine', async (io) => {
    const actual = await io<typeof import('../../engine')>();
    return { ...actual, generateExerciseData: vi.fn(), generateReviewData: vi.fn() };
});

import { ExerciseSession } from './Session';
import { recordAttempt, loadSettings } from '../../store';
import { generateExerciseData } from '../../engine';

const OPTIONS = ['se lo', 'le lo', 'me lo', 'te lo'];

const makeItem = (phrase: string, correct = 'se lo'): SessionItem => ({
    type: ExerciseType.POP_UP_PRONOUN,
    question: {
        phrase,
        correctAnswer: correct,
        options: OPTIONS,
        explanation: { ruleId: 'SE_TRANSFORM', title: 'Regla', steps: ['paso'] },
    },
});

const makeExercise = (phrases: string[]): Exercise => ({
    id: 'test',
    title: 'Test',
    description: '',
    type: ExerciseType.POP_UP_PRONOUN,
    data: phrases.map(p => makeItem(p)),
});

const setSettings = (over: Partial<Settings> = {}) =>
    (loadSettings as Mock).mockReturnValue({ difficulty: 2, timerEnabled: false, infinite: false, ...over });

const clickOption = (label: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
    vi.useFakeTimers();
    (recordAttempt as Mock).mockClear();
    (generateExerciseData as Mock).mockReset();
    setSettings();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('ExerciseSession', () => {
    it('responder dos veces seguidas registra un solo intento (candado)', () => {
        render(<ExerciseSession exercise={makeExercise(['FRASE UNO', 'FRASE DOS'])} onBack={() => {}} />);
        clickOption('se lo');
        clickOption('le lo'); // segundo click, ya bloqueado
        expect(recordAttempt).toHaveBeenCalledTimes(1);
        expect((recordAttempt as Mock).mock.calls[0][0]).toMatchObject({ correct: true });
    });

    it('un acierto avanza a la siguiente pregunta tras 2 s', () => {
        render(<ExerciseSession exercise={makeExercise(['FRASE UNO', 'FRASE DOS'])} onBack={() => {}} />);
        expect(screen.getByText('FRASE UNO')).toBeTruthy();
        clickOption('se lo');
        // Antes del delay de feedback sigue en la primera.
        advance(1000);
        expect(screen.queryByText('FRASE DOS')).toBeNull();
        // Tras 2 s de feedback + 300 ms de transición, avanza.
        advance(1300);
        expect(screen.getByText('FRASE DOS')).toBeTruthy();
    });

    it('un fallo muestra CONTINUAR y salta la espera de 5 s', () => {
        render(<ExerciseSession exercise={makeExercise(['FRASE UNO', 'FRASE DOS'])} onBack={() => {}} />);
        clickOption('le lo'); // incorrecto
        expect((recordAttempt as Mock).mock.calls[0][0]).toMatchObject({ correct: false, timedOut: false });
        const continuar = screen.getByRole('button', { name: /continuar/i });
        act(() => { fireEvent.click(continuar); });
        // Sin esperar 5 s: solo la transición de 300 ms.
        advance(300);
        expect(screen.getByText('FRASE DOS')).toBeTruthy();
    });

    it('el timeout marca la pregunta como fallada (timedOut) y avanza', () => {
        setSettings({ timerEnabled: true });
        render(<ExerciseSession exercise={makeExercise(['FRASE UNO', 'FRASE DOS'])} onBack={() => {}} />);
        // totalTime POP_UP en dificultad 2 = 7000 ms; agotarlo dispara onTimeout.
        advance(7200);
        expect(recordAttempt).toHaveBeenCalledTimes(1);
        expect((recordAttempt as Mock).mock.calls[0][0]).toMatchObject({ timedOut: true, correct: false, userAnswer: '' });
        // Tras el delay de fallo (5 s) + transición avanza.
        advance(5300);
        expect(screen.getByText('FRASE DOS')).toBeTruthy();
    });

    it('en modo infinito encola otro lote al acercarse al final', async () => {
        setSettings({ infinite: true });
        (generateExerciseData as Mock).mockResolvedValue([makeItem('EXTRA UNO'), makeItem('EXTRA DOS')]);
        render(<ExerciseSession exercise={makeExercise(['FRASE UNO', 'FRASE DOS'])} onBack={() => {}} />);
        // El fetcher corre al montar (currentIndex 0 >= length-2 = 0).
        await act(async () => { await Promise.resolve(); });
        expect(generateExerciseData).toHaveBeenCalled();
    });
});
