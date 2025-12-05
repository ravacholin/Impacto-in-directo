import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Exercise, QuestionWithOptions, PopUpPronounQuestion, InterferenceQuestion, ShortCircuitQuestion, InstantSwitchQuestion, ForcedCommunicationQuestion, DetectorQuestion, ExerciseType, QuestionData } from '../../types';
import { evaluateAnswer, generateExerciseData } from '../../gemini';
import { Header } from '../ui/Shared';
import { FeedbackUI } from '../ui/Feedback';
import { PopUpPronounView, ShortCircuitView, InstantSwitchView, ForcedCommunicationView, DetectorView } from './Views';
import { GameEndScreen } from '../screens/Navigation';

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
        if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);

        if (!isTimerEnabled || feedback !== null || isFinished) return;

        timerIntervalRef.current = window.setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 10) {
                    if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
                    handleTimeout();
                    return 0;
                }
                return prev - 10;
            });
        }, 10);

        return () => {
            if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
        };
    }, [isTimerEnabled, feedback, isFinished, currentIndex]); // Depend on currentIndex to restart timer on new question

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
        setTimeout(nextQuestion, 2000);
    };

    const handleAddTime = () => {
        if (isTimerEnabled && timeLeft > 0 && !feedback) {
             setTimeLeft(prev => prev + 5000);
        }
    };

    const nextQuestion = () => {
        setAnimationState('out');
        setFeedback(null);
        setAiFeedback(null);
        setUserAnswer('');
        
        setTimeout(() => {
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
            const q = currentQuestion as InstantSwitchQuestion;
            // Check against full phrase OR phrase without subject pronoun
            const correctFull = normalize(q.transformedPhrase);
            // Heuristic: remove first word if it looks like a subject? No, let's just strip everything.
            // Better strategy: The AI usually gives "Ella se lo da". We accept "Ella se lo da" or "Se lo da".
            
            const userNorm = normalize(answer);
            
            // Generate valid variations logic could be complex, for now strictly check normalized string
            // OR check if the answer is contained in a "valid answers" list if we had one.
            // For now, let's try to be lenient:
            // If the user's answer is a substring of correct answer or vice versa (for subject omission)?
            // A safer way is checking if the core pronouns/verb match.
            // Let's stick to the flexible logic implemented previously if available, or just normalize.
            
            // Special logic for "Ella se lo regala" vs "Se lo regala"
            // We can check if userNorm ends with correctFull (user included subject?) or correctFull ends with userNorm (user omitted subject?)
            // BUT, only if the length difference is small?
            
            // Re-implementing the "Flexible Subject" logic requested previously:
            // 1. Full match
            if (userNorm === correctFull) isCorrect = true;
            else {
                // 2. Try removing the first word of the correct answer (assuming it's a subject like "Ella")
                const parts = q.transformedPhrase.split(' ');
                if (parts.length > 1) {
                    const withoutSubject = parts.slice(1).join(' ');
                    if (userNorm === normalize(withoutSubject)) isCorrect = true;
                }
            }

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
        const delay = exercise.type === ExerciseType.FORCED_COMMUNICATION ? 4000 : 2000;
        setTimeout(nextQuestion, delay);
    };

    if (isFinished) {
        return <GameEndScreen score={score} total={currentIndex + 1} onBack={onBack} />;
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
                        isSubmitting={!!feedback}
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