
import type React from 'react';

export enum ExerciseType {
  POP_UP_PRONOUN = 'POP_UP_PRONOUN',
  INSTANT_SWITCH = 'INSTANT_SWITCH',
  DETECTOR = 'DETECTOR',
  SHORT_CIRCUIT = 'SHORT_CIRCUIT',
  INTERFERENCE = 'INTERFERENCE',
  PRONOUN_POSITION = 'PRONOUN_POSITION',
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

// --- Posición de clíticos (Actividad #6) ---
// La frase se representa como una secuencia ordenada de "tokens": palabras fijas
// y huecos clicables donde el alumno puede colocar el pronombre.
export type PositionToken =
  | { kind: 'word'; text: string }
  // 'result' = frase completa que se muestra/feedbackea si el pronombre va aquí.
  | { kind: 'slot'; id: string; valid: boolean; result: string };

export interface PronounPositionQuestion {
  contextLabel: string;     // "IMPERATIVO AFIRMATIVO", "PERÍFRASIS"…
  chip: string;             // pronombre a colocar, p.ej. "se lo"
  tokens: PositionToken[];  // render ordenado: palabras + huecos
  correctSlotIds: string[]; // 1 id, o 2 en perífrasis
  rule: string;             // mini-regla mostrada en el feedback
  acceptsMultiple: boolean; // true en perífrasis (dos posiciones válidas)
}

export type QuestionData = PopUpPronounQuestion | InstantSwitchQuestion | DetectorQuestion | ShortCircuitQuestion | InterferenceQuestion | PronounPositionQuestion;

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