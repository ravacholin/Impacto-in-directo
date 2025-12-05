
import React from 'react';
import { Module, ExerciseType } from './types';

const LightningBoltIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const BrainIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.553L16.5 21.75l-.398-1.197a3.375 3.375 0 00-2.455-2.455L12.75 18l1.197-.398a3.375 3.375 0 002.455-2.455L16.5 14.25l.398 1.197a3.375 3.375 0 002.455 2.455L20.25 18l-1.197.398a3.375 3.375 0 00-2.455 2.455z" />
  </svg>
);

const SwitchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const ChatIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
);

const BeakerIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v.344c0 .355-.186.676-.401.959a2.14 2.14 0 01-.349 1.003c0 1.035 1.007 1.875 2.25 1.875s2.25-.84 2.25-1.875a2.14 2.14 0 01-.349-1.003.97.97 0 01-.401-.959v-.344zM14.25 10.5a.75.75 0 00-.75.75v3.375c0 .621-.504 1.125-1.125 1.125h-1.5c-.621 0-1.125-.504-1.125-1.125V11.25a.75.75 0 00-1.5 0v3.375c0 1.439 1.16 2.625 2.625 2.625h1.5c1.439 0 2.625-1.186 2.625-2.625V11.25a.75.75 0 00-.75-.75zM8.25 4.503v.344c0 .355.186.676.401.959.221-.29.349-.634.349 1.003 0 1.035-1.007 1.875-2.25 1.875S4.5 7.84 4.5 6.804c0-.37.128-.713.349-1.003.215-.283.401-.604.401-.959v-.344a.97.97 0 01.401-.959c.221-.29.349-.634.349-1.003C5.25 2.805 6.257 1.967 7.5 1.967s2.25.838 2.25 1.875c0 .369-.128.713-.349 1.003a.97.97 0 01-.401.959z" />
    </svg>
);

const TrophyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9a9.75 9.75 0 1011.85-10.44A9.75 9.75 0 0016.5 18.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75h.008v.008H12v-.008z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a.75.75 0 01-.75-.75V12a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v2.25A.75.75 0 0112 15z" />
    </svg>
);

const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);


export const MODULES: Module[] = [
  {
    id: 'reflejos',
    title: 'Reflejos',
    description: 'Velocidad y patrones para automatizar pronombres.',
    icon: LightningBoltIcon,
    exercises: [
      {
        id: 'pop-up-pronoun',
        title: 'Pop-up Pronoun',
        description: 'Identifica el pronombre correcto en milisegundos.',
        type: ExerciseType.POP_UP_PRONOUN,
        data: []
      }
    ]
  },
  {
    id: 'corto-circuito',
    title: 'Corto Circuito',
    description: 'Combina objeto y persona en un pronombre.',
    icon: BrainIcon,
    exercises: [
       {
        id: 'short-circuit',
        title: 'Corto Circuito',
        description: 'Combina objeto y persona para formar el pronombre.',
        type: ExerciseType.SHORT_CIRCUIT,
        data: []
      }
    ]
  },
  {
    id: 'interferencia',
    title: 'Interferencia',
    description: 'Ignora distracciones y encuentra el objetivo.',
    icon: EyeIcon,
    exercises: [
       {
        id: 'interference',
        title: 'Interferencia',
        description: 'Forma el pronombre correcto ignorando distracciones.',
        type: ExerciseType.INTERFERENCE,
        data: []
      }
    ]
  },
  {
    id: 'microtransformaciones',
    title: 'Microtransformaciones',
    description: 'Transforma frases completas a pronombres rápido.',
    icon: SwitchIcon,
    exercises: [
      {
        id: 'instant-switch',
        title: 'Switch Instantáneo',
        description: 'Transforma la frase completa a su versión con pronombres.',
        type: ExerciseType.INSTANT_SWITCH,
        data: []
      }
    ]
  },
   {
    id: 'comunicacion-forzada',
    title: 'Comunicación Forzada',
    description: 'Situaciones que fuerzan el uso de pronombres.',
    icon: ChatIcon,
    exercises: [
      {
        id: 'roleplay-chat',
        title: 'Chat de Roleplay',
        description: 'Responde en situaciones de la vida real forzando el uso de pronombres.',
        type: ExerciseType.FORCED_COMMUNICATION,
        data: []
      }
    ]
  },
  {
    id: 'errores-tipicos',
    title: 'Errores Típicos',
    description: 'Corrige los fallos más comunes de estudiantes.',
    icon: BeakerIcon,
    exercises: [
      {
        id: 'detector',
        title: 'Detector',
        description: 'Encuentra la única respuesta correcta entre varias opciones con errores comunes.',
        type: ExerciseType.DETECTOR,
        data: []
      }
    ]
  },
   {
    id: 'batallas',
    title: 'Batallas',
    description: 'Modo competitivo. Automatización como reflejo.',
    icon: TrophyIcon,
    exercises: [
        {
            id: 'survival',
            title: 'Supervivencia',
            description: 'Resiste tanto como puedas. 3 vidas. Velocidad alta.',
            type: ExerciseType.BATTLE,
            data: []
        }
    ]
  }
];
