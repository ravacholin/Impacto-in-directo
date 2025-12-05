
import React, { useState, useEffect } from 'react';
import type { Module, Exercise } from './types';
import { generateExerciseData } from './gemini';
import { LoadingScreen, ErrorScreen } from './components/ui/Shared';
import { HomeScreen, ApiKeyScreen } from './components/screens/Navigation';
import { ExerciseSession } from './components/exercises/Session';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'apikey' | 'home' | 'exercise'>('home');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check for API key on mount
  useEffect(() => {
    const hasStoredKey = localStorage.getItem('gemini_api_key');
    const hasEnvKey = process.env.API_KEY;
    
    if (!hasStoredKey && !hasEnvKey) {
        setCurrentScreen('apikey');
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
      localStorage.setItem('gemini_api_key', key);
      setCurrentScreen('home');
  };

  const handleChangeApiKey = () => {
      // Logic to clear key and show screen
      localStorage.removeItem('gemini_api_key');
      setCurrentScreen('apikey');
  }

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
        // If error is about missing API key, redirect to API Key screen
        if (err instanceof Error && err.message === "MISSING_API_KEY") {
            setCurrentScreen('apikey');
            setError(null);
        } else {
            setError('No se pudieron cargar los ejercicios. Por favor, revisa tu conexión o tu API Key.');
            console.error(err);
        }
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
  
  if (currentScreen === 'apikey') return <ApiKeyScreen onSave={handleSaveApiKey} />;
  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onRetry={handleBack} />;
  if (currentScreen === 'exercise' && selectedExercise) return <ExerciseSession exercise={selectedExercise} onBack={handleBack} />;
  
  return <HomeScreen onSelectModule={handleSelectModule} onChangeApiKey={handleChangeApiKey} />;
};

export default App;
