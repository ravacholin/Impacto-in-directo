
import React, { useState } from 'react';
import type { Module, Exercise } from './types';
import { generateExerciseData, generateReviewData } from './engine';
import { LoadingScreen, ErrorScreen } from './components/ui/Shared';
import { HomeScreen } from './components/screens/Navigation';
import { ExerciseSession } from './components/exercises/Session';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'exercise'>('home');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // With single-exercise modules, selecting a module immediately starts the first exercise
  const handleSelectModule = (module: Module) => {
    if (module.exercises.length > 0) {
        handleSelectExercise(module.exercises[0]);
    }
  };

  const handleSelectExercise = async (exercise: Exercise) => {
    setIsLoading(true);
    setError(null);
    try {
        const questions = await generateExerciseData(exercise.type);
        setSelectedExercise({ ...exercise, data: questions });
        setCurrentScreen('exercise');
    } catch(err) {
        setError('No se pudieron cargar los ejercicios. Por favor, intenta de nuevo.');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  // Repaso Inteligente: arma un Exercise sintético con el lote mixto y entra a la
  // sesión. La sesión seguirá pidiendo lotes de repaso (fetchMore) en infinito.
  const handleStartReview = async () => {
    setIsLoading(true);
    setError(null);
    try {
        const items = await generateReviewData();
        if (!items.length) return;
        setSelectedExercise({ id: 'repaso', title: 'Repaso', description: '', type: items[0].type, data: items });
        setCurrentScreen('exercise');
    } catch(err) {
        setError('No se pudo cargar el repaso. Por favor, intenta de nuevo.');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentScreen === 'exercise') {
      setCurrentScreen('home');
      setSelectedExercise(null);
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={handleBack} />;
  if (currentScreen === 'exercise' && selectedExercise) return (
    <ExerciseSession
      exercise={selectedExercise}
      onBack={handleBack}
      fetchMore={selectedExercise.id === 'repaso' ? generateReviewData : undefined}
    />
  );

  return <HomeScreen onSelectModule={handleSelectModule} onStartReview={handleStartReview} />;
};

export default App;
