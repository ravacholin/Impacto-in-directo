
import type React from 'react';

export enum ExerciseType {
  POP_UP_PRONOUN = 'POP_UP_PRONOUN',
  INSTANT_SWITCH = 'INSTANT_SWITCH',
  DETECTOR = 'DETECTOR',
  SHORT_CIRCUIT = 'SHORT_CIRCUIT',
  INTERFERENCE = 'INTERFERENCE',
  PRONOUN_POSITION = 'PRONOUN_POSITION',
  QUICK_RESPONSE = 'QUICK_RESPONSE',
  DECODER = 'DECODER',
  EAR = 'EAR',
}

// Nivel global de dificultad (persistido en ajustes, ver store.ts).
export type Difficulty = 1 | 2 | 3;

// --- Explicación didáctica adjunta a cada pregunta ---
// La regla principal es también la clave del seguimiento adaptativo: el store
// registra aciertos/errores por RuleId y el generador sesga hacia las débiles.
export type RuleId =
  | 'OD_AGREEMENT'         // lo/la/los/las concuerda en género y número
  | 'REFLEXIVE'            // pronombre reflexivo según el sujeto (me/te/se/nos)
  | 'REFLEXIVE_CONTRAST'   // reflexivo vs. no reflexivo del mismo verbo (me lavo / lavo el coche)
  | 'REFLEXIVE_BODY'       // partes del cuerpo con artículo, no posesivo (me lavo LAS manos)
  | 'CLITIC_ORDER'         // OI antes de OD (me lo, te la…)
  | 'SE_TRANSFORM'         // le/les + lo/la/los/las → se
  | 'POSITION_PROCLISIS'   // verbo conjugado / imperativo negativo
  | 'POSITION_ENCLISIS'    // infinitivo / gerundio / imperativo afirmativo
  | 'POSITION_PERIPHRASIS' // dos posiciones válidas
  | 'PERSON_FLIP';         // pregunta "¿me…?" → respuesta "te…"

export interface Explanation {
  ruleId: RuleId;
  title: string;    // "Regla: le/les → se"
  steps: string[];  // ["el libro → lo (masc. sing.)", "a María → le → se", …]
  detail?: string;  // una frase de apoyo
}

export interface QuestionWithOptions {
  options: string[];
  correctAnswer: string;
  explanation: Explanation;
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
  explanation: Explanation;
}

export interface DetectorQuestion {
  prompt: string;
  options: string[];
  correctAnswers: string[];
  explanation: Explanation;
}

export interface ShortCircuitQuestion extends QuestionWithOptions {
  person: string;
  object: string;
  // Rótulos de los dos paneles. Por defecto "PERSONA"/"OBJETO" (clúster doble).
  // En BASE (un solo pronombre) se ajustan: reflexivo = PERSONA + VERBO;
  // OD = VERBO + OBJETO (la persona no interviene en el OD).
  personLabel?: string;
  objectLabel?: string;
  // Frase adverbial opcional que ambienta la pregunta ("Todas las mañanas",
  // "Ahora mismo"…). Aparece solo parte de las veces, para variar el ritmo.
  lead?: string;
}

export interface InterferenceQuestion extends QuestionWithOptions {
  phrase: string;
}

// Pregunta dirigida a "tú" que se contesta en primera persona con el clúster
// pronominal ya resuelto: "¿Me traes las llaves?" → "Sí, te las traigo".
export interface QuickResponseQuestion extends QuestionWithOptions {
  questionPhrase: string;
}

// Comprensión inversa (Decodificador): se muestra la frase YA pronominalizada y
// se pregunta por el referente de uno de los clíticos.
export interface DecoderQuestion extends QuestionWithOptions {
  phrase: string;   // "Se las llevo mañana."
  prompt: string;   // "¿Qué es «las»?" / "¿A quién se las llevo?"
}

// Oído (comprensión auditiva): se pronuncia la frase completa y se muestra la
// versión con el clúster tapado; el alumno elige el clúster que oyó.
export interface EarQuestion extends QuestionWithOptions {
  maskedPhrase: string; // "___ doy mañana."  (clúster tapado)
  fullPhrase: string;   // "Se lo doy mañana." (lo que se pronuncia)
}

// --- Posición de clíticos (Actividad #6) ---
// La frase se representa como una secuencia ordenada de "tokens": palabras fijas
// y huecos clicables donde el alumno puede colocar el pronombre.
export type PositionToken =
  | { kind: 'word'; text: string }
  // 'result' = frase completa que se muestra/feedbackea si el pronombre va aquí.
  // 'display' = etiqueta del botón: forma separada delante ("se lo") o unida detrás ("selo").
  | { kind: 'slot'; id: string; valid: boolean; result: string; display: string };

export interface PronounPositionQuestion {
  contextLabel: string;     // "IMPERATIVO AFIRMATIVO", "PERÍFRASIS"…
  chip: string;             // pronombre a colocar, p.ej. "se lo"
  tokens: PositionToken[];  // render ordenado: palabras + huecos
  correctSlotIds: string[]; // 1 id, o 2 en perífrasis
  acceptsMultiple: boolean; // true en perífrasis (dos posiciones válidas)
  explanation: Explanation; // regla didáctica mostrada en el feedback
}

export type QuestionData = PopUpPronounQuestion | InstantSwitchQuestion | DetectorQuestion | ShortCircuitQuestion | InterferenceQuestion | PronounPositionQuestion | QuickResponseQuestion | DecoderQuestion | EarQuestion;

// Un ítem de sesión: la pregunta junto con su tipo de ejercicio. Permite
// sesiones heterogéneas (p. ej. el Repaso Inteligente mezcla tipos).
export interface SessionItem {
  type: ExerciseType;
  question: QuestionData;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  type: ExerciseType;
  data: SessionItem[];
}

export interface Module {
  id:string;
  title: string;
  description: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  exercises: Exercise[];
}