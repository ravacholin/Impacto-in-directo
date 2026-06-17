
import React, { useState } from 'react';
import type { Module, Exercise } from './types';
import { generateExerciseData } from './engine';
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
    if (exercise.title.includes('(Próximamente)')) return;
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

  const handleBack = () => {
    if (currentScreen === 'exercise') {
      setCurrentScreen('home');
      setSelectedExercise(null);
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={handleBack} />;
  if (currentScreen === 'exercise' && selectedExercise) return <ExerciseSession exercise={selectedExercise} onBack={handleBack} />;

  return <HomeScreen onSelectModule={handleSelectModule} />;
};

export default App;
