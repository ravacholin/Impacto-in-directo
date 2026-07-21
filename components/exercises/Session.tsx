import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Exercise, QuestionWithOptions, ExerciseType, SessionItem } from '../../types';
import { generateExerciseData, DEFAULT_BATCH_SIZE } from '../../engine';
import { evaluateAnswer } from '../../engine/evaluate';
import { shuffle, describeQuestion } from '../../utils';
import { loadSettings, saveSettings, recordAttempt } from '../../store';
import { Header } from '../ui/Shared';
import { FeedbackUI } from '../ui/Feedback';
import { QUESTION_VIEWS } from './Views';
import { GameEndScreen } from '../screens/Navigation';

const clearManagedTimeout = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current !== null) {
        window.clearTimeout(ref.current);
        ref.current = null;
    }
};

const scheduleManagedTimeout = (
    ref: React.MutableRefObject<number | null>,
    callback: () => void,
    delay: number
) => {
    clearManagedTimeout(ref);
    ref.current = window.setTimeout(() => {
        ref.current = null;
        callback();
    }, delay);
};

// Countdown duration (ms) per exercise type. Centralized to avoid scattered
// magic numbers.
const TIMER_DURATIONS: Partial<Record<ExerciseType, number>> = {
    [ExerciseType.INSTANT_SWITCH]: 15000,
    [ExerciseType.DETECTOR]: 20000,
    [ExerciseType.PRONOUN_POSITION]: 10000,
    [ExerciseType.QUICK_RESPONSE]: 10000,
    [ExerciseType.DECODER]: 12000,
};
const DEFAULT_TIMER_MS = 7000;

// El multiplicador de dificultad escala todos los cronómetros.
const TIMER_MULTIPLIER: Record<1 | 2 | 3, number> = { 1: 1.5, 2: 1, 3: 0.8 };

// How long the feedback panel stays up before advancing.
// On a miss the panel holds longer so the rule can be read; a CONTINUAR button
// inside the panel lets fast users skip the wait.
const FEEDBACK_DELAY_CORRECT_MS = 2000;
const FEEDBACK_DELAY_WRONG_MS = 5000;
const TRANSITION_MS = 300; // fade-out before the next question

export const ExerciseSession = ({ exercise, onBack, fetchMore }: {
    exercise: Exercise;
    onBack: () => void;
    // Fuente para el modo infinito y CONTINUAR. Por defecto genera más preguntas
    // del mismo tipo; el Repaso Inteligente le pasa su propia fuente mixta.
    fetchMore?: () => Promise<SessionItem[]>;
}) => {
    const loadMore = useMemo(
        () => fetchMore ?? (() => generateExerciseData(exercise.type)),
        [fetchMore, exercise.type],
    );

    // State for questions management (dynamic for infinite mode). Ahora cada
    // ítem lleva su propio tipo: la sesión puede ser heterogénea.
    const [items, setItems] = useState<SessionItem[]>(exercise.data);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);

    // State for logic and UI
    const [feedback, setFeedback] = useState<'pending' | 'correct' | 'incorrect' | 'timeout' | null>(null);
    const [isFinished, setIsFinished] = useState(false);
    const [animationState, setAnimationState] = useState<'in' | 'out'>('in');
    const [userAnswer, setUserAnswer] = useState('');

    // Toggles: se inicializan desde los ajustes persistidos y se guardan al cambiar.
    const [isInfinite, setIsInfinite] = useState(() => loadSettings().infinite);
    const [isTimerEnabled, setIsTimerEnabled] = useState(() => loadSettings().timerEnabled);
    const difficulty = useMemo(() => loadSettings().difficulty, []);

    useEffect(() => {
        saveSettings({ ...loadSettings(), infinite: isInfinite, timerEnabled: isTimerEnabled });
    }, [isInfinite, isTimerEnabled]);

    const globalTimeoutRef = useRef<number | null>(null);
    const transitionTimeoutRef = useRef<number | null>(null);
    const feedbackAdvanceTimeoutRef = useRef<number | null>(null);

    const isLoadingMore = useRef(false);
    // Latest question count, read by callbacks to avoid stale closures.
    const itemsLengthRef = useRef(items.length);
    itemsLengthRef.current = items.length;
    // Guards against answering the same question twice (double tap / timeout race).
    const answerLockRef = useRef(false);

    const currentItem = items[currentIndex];
    const currentType = currentItem?.type ?? exercise.type;
    const currentQuestion = currentItem?.question;

    // El timer se recalcula por pregunta según SU tipo (sesiones heterogéneas).
    const totalTime = Math.round((TIMER_DURATIONS[currentType] ?? DEFAULT_TIMER_MS) * TIMER_MULTIPLIER[difficulty]);

    // Options are derived synchronously from the current question (no flash of
    // empty options, no redundant re-shuffle on every render).
    const shuffledOptions = useMemo<string[]>(() => {
        if (currentQuestion && 'options' in currentQuestion) {
            return shuffle((currentQuestion as QuestionWithOptions).options);
        }
        return [];
    }, [currentQuestion]);

    // Fade the new question in.
    useEffect(() => {
        setAnimationState('in');
    }, [currentIndex]);

    // Clean up any pending timers on unmount.
    useEffect(() => {
        return () => {
            clearManagedTimeout(globalTimeoutRef);
            clearManagedTimeout(transitionTimeoutRef);
            clearManagedTimeout(feedbackAdvanceTimeoutRef);
        };
    }, []);

    // Infinite Mode Fetcher
    useEffect(() => {
        const fetchMoreItems = async () => {
            if (isInfinite && !isLoadingMore.current && currentIndex >= items.length - 2) {
                isLoadingMore.current = true;
                try {
                    const newItems = await loadMore();
                    setItems(prev => [...prev, ...newItems]);
                } catch (e) {
                    console.error("Failed to fetch infinite questions", e);
                } finally {
                    isLoadingMore.current = false;
                }
            }
        };
        fetchMoreItems();
    }, [currentIndex, isInfinite, items.length, loadMore]);

    const nextQuestion = useCallback(() => {
        clearManagedTimeout(globalTimeoutRef);
        clearManagedTimeout(feedbackAdvanceTimeoutRef);
        setAnimationState('out');
        setFeedback(null);
        setUserAnswer('');

        scheduleManagedTimeout(transitionTimeoutRef, () => {
            answerLockRef.current = false;
            setCurrentIndex(prev => (prev < itemsLengthRef.current - 1 ? prev + 1 : prev));
            setIsFinished(prev => prev || currentIndex >= itemsLengthRef.current - 1);
        }, TRANSITION_MS);
    }, [currentIndex]);

    const handleTimeout = useCallback(() => {
        if (answerLockRef.current) return;
        answerLockRef.current = true;
        const item = items[currentIndex];
        if (item) {
            const { prompt, correctAnswer } = describeQuestion(item.type, item.question);
            recordAttempt({
                ruleId: item.question.explanation.ruleId,
                exerciseType: item.type,
                correct: false,
                prompt,
                correctAnswer,
                userAnswer: '',
                timedOut: true,
            });
        }
        setFeedback('timeout');
        scheduleManagedTimeout(globalTimeoutRef, nextQuestion, FEEDBACK_DELAY_WRONG_MS);
    }, [nextQuestion, items, currentIndex]);

    const handleAnswer = useCallback((answer: string) => {
        if (answerLockRef.current) return; // Prevent double submission / answer after timeout
        answerLockRef.current = true;

        setUserAnswer(answer);
        const item = items[currentIndex];
        const isCorrect = evaluateAnswer(item.type, item.question, answer);

        const { prompt, correctAnswer } = describeQuestion(item.type, item.question);
        recordAttempt({
            ruleId: item.question.explanation.ruleId,
            exerciseType: item.type,
            correct: isCorrect,
            prompt,
            correctAnswer,
            userAnswer: answer,
            timedOut: false,
        });
        if (isCorrect) setScore(s => s + 1);
        setFeedback(isCorrect ? 'correct' : 'incorrect');

        const delay = isCorrect ? FEEDBACK_DELAY_CORRECT_MS : FEEDBACK_DELAY_WRONG_MS;
        scheduleManagedTimeout(feedbackAdvanceTimeoutRef, nextQuestion, delay);
    }, [items, currentIndex, nextQuestion]);

    const [isLoading, setIsLoading] = useState(false);

    const handleContinue = useCallback(async () => {
        setIsLoading(true);
        try {
            const newItems = await loadMore();
            answerLockRef.current = false;
            setItems(newItems);
            setCurrentIndex(0);
            setScore(0);
            setIsFinished(false);
        } catch (error) {
            console.error("Failed to continue session:", error);
        } finally {
            setIsLoading(false);
        }
    }, [loadMore]);

    if (isFinished) {
        return <GameEndScreen score={score} total={items.length} onBack={onBack} onContinue={handleContinue} isLoading={isLoading} />;
    }

    // Progress: within the current batch, so the bar never recedes in infinite
    // mode (where items.length keeps growing).
    const batchSize = exercise.data.length || DEFAULT_BATCH_SIZE;
    const progress = isInfinite
        ? ((currentIndex % batchSize) / batchSize) * 100
        : (currentIndex / batchSize) * 100;

    const CurrentView = QUESTION_VIEWS[currentType];

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>

            <Header
                title={exercise.title}
                onBack={onBack}
                isInfinite={isInfinite}
                onToggleInfinite={() => setIsInfinite(v => !v)}
                isTimerEnabled={isTimerEnabled}
                onToggleTimer={() => setIsTimerEnabled(v => !v)}
                totalTime={totalTime}
                timerResetKey={currentIndex}
                timerPaused={feedback !== null || isFinished}
                onTimeout={handleTimeout}
            />

            <main
                aria-live="polite"
                className={`flex-1 flex flex-col justify-center p-6 transition-opacity duration-300 ${animationState === 'in' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
                {currentQuestion && CurrentView && (
                    <CurrentView
                        question={currentQuestion}
                        shuffledOptions={shuffledOptions}
                        handleAnswer={handleAnswer}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
            </main>

            {currentQuestion && (
                <FeedbackUI
                    type={currentType}
                    question={currentQuestion}
                    feedback={feedback}
                    onContinue={nextQuestion}
                />
            )}

            {/* Progress Bar (Bottom) */}
            <div className="fixed bottom-0 left-0 w-full h-1 bg-zinc-900">
                <div
                    className="h-full bg-accent transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};
