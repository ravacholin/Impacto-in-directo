import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Exercise, QuestionWithOptions, PopUpPronounQuestion, InterferenceQuestion, ShortCircuitQuestion, InstantSwitchQuestion, ForcedCommunicationQuestion, DetectorQuestion, ExerciseType, QuestionData } from '../../types';
import { evaluateAnswer, generateExerciseData } from '../../gemini';
import { Header } from '../ui/Shared';
import { FeedbackUI } from '../ui/Feedback';
import { PopUpPronounView, ShortCircuitView, InstantSwitchView, ForcedCommunicationView, DetectorView } from './Views';
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

const clearManagedInterval = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current !== null) {
        window.clearInterval(ref.current);
        ref.current = null;
    }
};

export const ExerciseSession = ({ exercise, onBack }: { exercise: Exercise; onBack: () => void }) => {
    // State for questions management (dynamic for infinite mode)
    const [questions, setQuestions] = useState<QuestionData[]>(exercise.data);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);

    // State for logic and UI
    const [feedback, setFeedback] = useState<'pending' | 'correct' | 'incorrect' | 'timeout' | null>(null);
    const [isFinished, setIsFinished] = useState(false);
    const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<string | null>(null);
    const [animationState, setAnimationState] = useState<'in' | 'out'>('in');
    const [userAnswer, setUserAnswer] = useState('');

    // Toggles
    const [isInfinite, setIsInfinite] = useState(false);
    const [isTimerEnabled, setIsTimerEnabled] = useState(true);

    // Timer State
    const [totalTime, setTotalTime] = useState(5000);
    const [timeLeft, setTimeLeft] = useState(5000);
    const timerIntervalRef = useRef<number | null>(null);
    const globalTimeoutRef = useRef<number | null>(null);
    const transitionTimeoutRef = useRef<number | null>(null);
    const feedbackAdvanceTimeoutRef = useRef<number | null>(null);

    const isLoadingMore = useRef(false);

    // Initial setup and question transition
    useEffect(() => {
        if (!questions[currentIndex]) return;

        setAnimationState('in');

        // Reset timer based on difficulty/type logic if needed, default 5s or 10s
        let initialTime = 5000;
        if (exercise.type === ExerciseType.FORCED_COMMUNICATION) initialTime = 45000; // More time for typing
        if (exercise.type === ExerciseType.INSTANT_SWITCH) initialTime = 15000;
        if (exercise.type === ExerciseType.DETECTOR) initialTime = 20000;

        setTotalTime(initialTime);
        setTimeLeft(initialTime);

        // Prepare options
        const q = questions[currentIndex];
        if ('options' in q) {
            setShuffledOptions([...(q as QuestionWithOptions).options].sort(() => Math.random() - 0.5));
        }

    }, [currentIndex, questions, exercise.type]);

    // Timer Logic
    useEffect(() => {
        // Clear existing interval
        clearManagedInterval(timerIntervalRef);

        if (!isTimerEnabled || feedback !== null || isFinished) return;

        timerIntervalRef.current = window.setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 10) {
                    clearManagedInterval(timerIntervalRef);
                    handleTimeout();
                    return 0;
                }
                return prev - 10;
            });
        }, 10);

        return () => {
            clearManagedInterval(timerIntervalRef);
        };
    }, [isTimerEnabled, feedback, isFinished, currentIndex]); // Depend on currentIndex to restart timer on new question

    useEffect(() => {
        return () => {
            clearManagedInterval(timerIntervalRef);
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
                    console.log("Infinite Mode: Fetching more questions...");
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

    const handleTimeout = () => {
        setFeedback('timeout');
        if (exercise.type === ExerciseType.BATTLE) {
            setLives(l => Math.max(0, l - 1));
        }
        scheduleManagedTimeout(globalTimeoutRef, nextQuestion, 2000);
    };

    const handleAddTime = () => {
        if (isTimerEnabled && timeLeft > 0 && !feedback) {
            setTimeLeft(prev => prev + 5000);
        }
    };

    const nextQuestion = () => {
        clearManagedTimeout(globalTimeoutRef);
        clearManagedTimeout(feedbackAdvanceTimeoutRef);
        setAnimationState('out');
        setFeedback(null);
        setAiFeedback(null);
        setUserAnswer('');

        scheduleManagedTimeout(transitionTimeoutRef, () => {
            if (lives <= 0 && exercise.type === ExerciseType.BATTLE) {
                setIsFinished(true);
                return;
            }

            if (currentIndex < questions.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setIsFinished(true);
            }
        }, 300); // Wait for fade out
    };

    // Normalize string for loose comparison (remove spaces, punctuation, lowercase)
    const normalize = (str: string) => {
        return str.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
    };

    const handleAnswer = async (answer: string) => {
        if (feedback) return; // Prevent double submission

        setUserAnswer(answer);
        const currentQuestion = questions[currentIndex];
        let isCorrect = false;
        let aiResponseFeedback: string | null = null;

        if (exercise.type === ExerciseType.FORCED_COMMUNICATION) {
            setFeedback('pending');
            setIsEvaluating(true);
            // AI Evaluation
            const evaluation = await evaluateAnswer(currentQuestion as ForcedCommunicationQuestion, answer);
            isCorrect = evaluation.isCorrect;
            aiResponseFeedback = evaluation.feedback;
            setAiFeedback(aiResponseFeedback);
            setIsEvaluating(false);
        } else if (exercise.type === ExerciseType.INSTANT_SWITCH) {
            setFeedback('pending');
            setIsEvaluating(true);
            const q = currentQuestion as InstantSwitchQuestion;

            // AI Evaluation for flexibility
            const evaluation = await import('../../gemini').then(m => m.evaluateTransformation(q.initialPhrase, answer));

            isCorrect = evaluation.isCorrect;
            aiResponseFeedback = evaluation.feedback;
            setAiFeedback(aiResponseFeedback);
            setIsEvaluating(false);

        } else if (exercise.type === ExerciseType.DETECTOR) {
            const q = currentQuestion as DetectorQuestion;
            const userNorm = normalize(answer);
            // q.correctAnswers is an array of valid strings
            const validAnswers = (q.correctAnswers || []).map(normalize);
            isCorrect = validAnswers.includes(userNorm);

        } else {
            // Standard string match for multiple choice
            const q = currentQuestion as QuestionWithOptions;
            isCorrect = normalize(answer) === normalize(q.correctAnswer);
        }

        if (isCorrect) {
            setScore(s => s + 1);
            setFeedback('correct');
        } else {
            setFeedback('incorrect');
            if (exercise.type === ExerciseType.BATTLE) {
                setLives(l => Math.max(0, l - 1));
            }
        }

        // Delay for user to read feedback
        let delay = 2000;
        if (exercise.type === ExerciseType.FORCED_COMMUNICATION) delay = 4000;
        if (exercise.type === ExerciseType.DETECTOR) delay = 3500; // More time to see correct options
        scheduleManagedTimeout(feedbackAdvanceTimeoutRef, nextQuestion, delay);
    };

    const [isLoading, setIsLoading] = useState(false);

    const handleContinue = async () => {
        setIsLoading(true);
        try {
            const newQuestions = await generateExerciseData(exercise.type);
            setQuestions(newQuestions);
            setCurrentIndex(0);
            setScore(0);
            setLives(3);
            setIsFinished(false);
        } catch (error) {
            console.error("Failed to continue session:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isFinished) {
        return <GameEndScreen score={score} total={questions.length} onBack={onBack} onContinue={handleContinue} isLoading={isLoading} />;
    }

    const currentQuestion = questions[currentIndex];

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>

            <Header
                title={exercise.title}
                onBack={onBack}
                lives={exercise.type === ExerciseType.BATTLE ? lives : undefined}
                isInfinite={isInfinite}
                onToggleInfinite={() => setIsInfinite(!isInfinite)}
                isTimerEnabled={isTimerEnabled}
                onToggleTimer={() => setIsTimerEnabled(!isTimerEnabled)}
                timeLeft={timeLeft}
                totalTime={totalTime}
                onTimerClick={handleAddTime}
            />

            <main className={`flex-1 flex flex-col justify-center p-6 transition-opacity duration-300 ${animationState === 'in' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                {exercise.type === ExerciseType.POP_UP_PRONOUN && (
                    <PopUpPronounView
                        question={currentQuestion as PopUpPronounQuestion}
                        shuffledOptions={shuffledOptions}
                        handleAnswer={handleAnswer}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
                {exercise.type === ExerciseType.BATTLE && (
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
                        isSubmitting={isEvaluating || !!feedback}
                        feedback={feedback}
                        userAnswer={userAnswer}
                    />
                )}
                {exercise.type === ExerciseType.FORCED_COMMUNICATION && (
                    <ForcedCommunicationView
                        question={currentQuestion as ForcedCommunicationQuestion}
                        handleAnswer={handleAnswer}
                        isSubmitting={isEvaluating || !!feedback}
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
            </main>

            <FeedbackUI
                exercise={exercise}
                question={currentQuestion}
                feedback={feedback}
                aiFeedback={aiFeedback}
            />

            {/* Progress Bar (Bottom) */}
            <div className="fixed bottom-0 left-0 w-full h-1 bg-zinc-900">
                <div
                    className="h-full bg-white transition-all duration-300 ease-out"
                    style={{ width: `${((currentIndex) / (isInfinite ? questions.length : exercise.data.length)) * 100}%` }}
                />
            </div>
        </div>
    );
};