
import type React from 'react';

export enum ExerciseType {
  POP_UP_PRONOUN = 'POP_UP_PRONOUN',
  INSTANT_SWITCH = 'INSTANT_SWITCH',
  DETECTOR = 'DETECTOR',
  SHORT_CIRCUIT = 'SHORT_CIRCUIT',
  INTERFERENCE = 'INTERFERENCE',
}

export interface QuestionWithOptions {
  options: string[];
  correctAnswer: string;
}

export interface PopUpPronounQuestion extends QuestionWithOptions {
  phrase: string;
}

export interface InstantSwitchQuestion {
  initialPhrase: string;
  transformedPhrase: string;
  // Variantes válidas adicionales (p.ej. con/sin sujeto explícito) para la
  // evaluación local por normalización.
  acceptedAnswers?: string[];
}

export interface DetectorQuestion {
  prompt: string;
  options: string[];
  correctAnswers: string[]; 
}

export interface ShortCircuitQuestion extends QuestionWithOptions {
  person: string;
  object: string;
}

export interface InterferenceQuestion extends QuestionWithOptions {
  phrase: string;
}

export type QuestionData = PopUpPronounQuestion | InstantSwitchQuestion | DetectorQuestion | ShortCircuitQuestion | InterferenceQuestion;

export interface Exercise {
  id: string;
  title: string;
  description: string;
  type: ExerciseType;
  data: QuestionData[];
}

export interface Module {
  id:string;
  title: string;
  description: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  exercises: Exercise[];
}