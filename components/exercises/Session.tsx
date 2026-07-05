import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Exercise, QuestionWithOptions, PopUpPronounQuestion, InterferenceQuestion, ShortCircuitQuestion, InstantSwitchQuestion, DetectorQuestion, PronounPositionQuestion, QuickResponseQuestion, ExerciseType, QuestionData } from '../../types';
import { generateExerciseData, DEFAULT_BATCH_SIZE } from '../../engine';
import { normalize, shuffle } from '../../utils';
import { loadSettings, saveSettings, recordResult } from '../../store';
import { Header } from '../ui/Shared';
import { FeedbackUI } from '../ui/Feedback';
import { PopUpPronounView, ShortCircuitView, InstantSwitchView, DetectorView, PronounPositionView, QuickResponseView } from './Views';
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

export const ExerciseSession = ({ exercise, onBack }: { exercise: Exercise; onBack: () => void }) => {
    // State for questions management (dynamic for infinite mode)
    const [questions, setQuestions] = useState<QuestionData[]>(exercise.data);
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

    const totalTime = Math.round((TIMER_DURATIONS[exercise.type] ?? DEFAULT_TIMER_MS) * TIMER_MULTIPLIER[difficulty]);

    const globalTimeoutRef = useRef<number | null>(null);
    const transitionTimeoutRef = useRef<number | null>(null);
    const feedbackAdvanceTimeoutRef = useRef<number | null>(null);

    const isLoadingMore = useRef(false);
    // Latest question count, read by callbacks to avoid stale closures.
    const questionsLengthRef = useRef(questions.length);
    questionsLengthRef.current = questions.length;
    // Guards against answering the same question twice (double tap / timeout race).
    const answerLockRef = useRef(false);

    const currentQuestion = questions[currentIndex];

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
        const fetchMore = async () => {
            if (isInfinite && !isLoadingMore.current && currentIndex >= questions.length - 2) {
                isLoadingMore.current = true;
                try {
                    const newQuestions = await generateExerciseData(exercise.type);
                    setQuestions(prev => [...prev, ...newQuestions]);
                } catch (e) {
                    console.error("Failed to fetch infinite questions", e);
                } finally {
                    isLoadingMore.current = false;
                }
            }
        };
        fetchMore();
    }, [currentIndex, isInfinite, questions.length, exercise.type]);

    const nextQuestion = useCallback(() => {
        clearManagedTimeout(globalTimeoutRef);
        clearManagedTimeout(feedbackAdvanceTimeoutRef);
        setAnimationState('out');
        setFeedback(null);
        setUserAnswer('');

        scheduleManagedTimeout(transitionTimeoutRef, () => {
            answerLockRef.current = false;
            setCurrentIndex(prev => (prev < questionsLengthRef.current - 1 ? prev + 1 : prev));
            setIsFinished(prev => prev || currentIndex >= questionsLengthRef.current - 1);
        }, TRANSITION_MS);
    }, [currentIndex]);

    const handleTimeout = useCallback(() => {
        if (answerLockRef.current) return;
        answerLockRef.current = true;
        const question = questions[currentIndex];
        if (question) recordResult(question.explanation.ruleId, false);
        setFeedback('timeout');
        scheduleManagedTimeout(globalTimeoutRef, nextQuestion, FEEDBACK_DELAY_WRONG_MS);
    }, [nextQuestion, questions, currentIndex]);

    const handleAnswer = useCallback((answer: string) => {
        if (answerLockRef.current) return; // Prevent double submission / answer after timeout
        answerLockRef.current = true;

        setUserAnswer(answer);
        const question = questions[currentIndex];
        let isCorrect = false;

        if (exercise.type === ExerciseType.INSTANT_SWITCH) {
            const q = question as InstantSwitchQuestion;
            const userNorm = normalize(answer);
            const validAnswers = [q.transformedPhrase, ...(q.acceptedAnswers || [])].map(normalize);
            isCorrect = validAnswers.includes(userNorm);
        } else if (exercise.type === ExerciseType.DETECTOR) {
            const q = question as DetectorQuestion;
            const userNorm = normalize(answer);
            const validAnswers = (q.correctAnswers || []).map(normalize);
            isCorrect = validAnswers.includes(userNorm);
        } else if (exercise.type === ExerciseType.PRONOUN_POSITION) {
            const q = question as PronounPositionQuestion;
            // 'answer' es el id del hueco elegido; correcto si está entre los válidos.
            isCorrect = (q.correctSlotIds || []).includes(answer);
        } else {
            const q = question as QuestionWithOptions;
            isCorrect = normalize(answer) === normalize(q.correctAnswer);
        }

        recordResult(question.explanation.ruleId, isCorrect);
        if (isCorrect) setScore(s => s + 1);
        setFeedback(isCorrect ? 'correct' : 'incorrect');

        const delay = isCorrect ? FEEDBACK_DELAY_CORRECT_MS : FEEDBACK_DELAY_WRONG_MS;
        scheduleManagedTimeout(feedbackAdvanceTimeoutRef, nextQuestion, delay);
    }, [questions, currentIndex, exercise.type, nextQuestion]);

    const [isLoading, setIsLoading] = useState(false);

    const handleContinue = useCallback(async () => {
        setIsLoading(true);
        try {
            const newQuestions = await generateExerciseData(exercise.type);
            answerLockRef.current = false;
            setQuestions(newQuestions);
            setCurrentIndex(0);
            setScore(0);
            setIsFinished(false);
        } catch (error) {
            console.error("Failed to continue session:", error);
        } finally {
            setIsLoading(false);
        }
    }, [exercise.type]);

    if (isFinished) {
        return <GameEndScreen score={score} total={questions.length} onBack={onBack} onContinue={handleContinue} isLoading={isLoading} />;
    }

    // Progress: within the current batch, so the bar never recedes in infinite
    // mode (where questions.length keeps growing).
    const batchSize = exercise.data.length || DEFAULT_BATCH_SIZE;
    const progress = isInfinite
        ? ((currentIndex % batchSize) / batchSize) * 100
        : (currentIndex / batchSize) * 100;

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
                {exercise.type === ExerciseType.POP_UP_PRONOUN && (
                    <PopUpPronounView
                        question={currentQuestion as PopUpPronounQuestion}
                        shuffledOptions={shuffledOptions}
                        handleAnswer={handleAnswer}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
                {exercise.type === ExerciseType.SHORT_CIRCUIT && (
                    <ShortCircuitView
                        question={currentQuestion as ShortCircuitQuestion}
                        shuffledOptions={shuffledOptions}
                        handleAnswer={handleAnswer}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
                {exercise.type === ExerciseType.INTERFERENCE && (
                    <PopUpPronounView
                        question={currentQuestion as InterferenceQuestion}
                        shuffledOptions={shuffledOptions}
                        handleAnswer={handleAnswer}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
                {exercise.type === ExerciseType.INSTANT_SWITCH && (
                    <InstantSwitchView
                        question={currentQuestion as InstantSwitchQuestion}
                        handleAnswer={handleAnswer}
                        isSubmitting={!!feedback}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
                {exercise.type === ExerciseType.DETECTOR && (
                    <DetectorView
                        question={currentQuestion as DetectorQuestion}
                        shuffledOptions={shuffledOptions}
                        handleAnswer={handleAnswer}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
                {exercise.type === ExerciseType.PRONOUN_POSITION && (
                    <PronounPositionView
                        question={currentQuestion as PronounPositionQuestion}
                        handleAnswer={handleAnswer}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
                {exercise.type === ExerciseType.QUICK_RESPONSE && (
                    <QuickResponseView
                        question={currentQuestion as QuickResponseQuestion}
                        shuffledOptions={shuffledOptions}
                        handleAnswer={handleAnswer}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
            </main>

            <FeedbackUI
                exercise={exercise}
                question={currentQuestion}
                feedback={feedback}
                onContinue={nextQuestion}
            />

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
