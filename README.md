<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Impacto (In)Directo

Gimnasio de automatización sintáctica para dominar los pronombres de objeto
directo e indirecto (OD/OI) del español. Del conocimiento al instinto.

## Sin IA, 100% offline

Los ejercicios ya **no** se generan con una API de IA. Un **motor procedural
local** (`engine/`) los construye en el navegador a partir de bancos de palabras
curados (verbos con su conjugación, objetos directos con género/número y personas)
combinados con las reglas de pronombres del español (incluida la regla
`le/les + lo/la/los/las → se`).

Esto significa:

- **No requiere API Key** ni conexión a internet.
- **Repertorio prácticamente infinito**: el espacio combinatorio (verbos × objetos ×
  personas × sujetos) genera miles de ejercicios únicos y correctos.
- Compatible con el **modo infinito** y con la PWA offline-first.

### Tipos de ejercicio

`Reflejos` (Pop-up), `Corto Circuito`, `Interferencia`, `Microtransformaciones`
(Switch Instantáneo), `Errores Típicos` (Detector) y `Batallas` (Supervivencia).

### Arquitectura del motor

- `engine/pronouns.ts` — bancos de palabras y la regla `resolverCluster(oi, od)`
  (única fuente de verdad de la combinación de pronombres).
- `engine/generator.ts` — generadores por tipo, distractores homogéneos y muestreo.
- `engine.ts` — fachada `generateExerciseData(type)` que consumen la app y el modo
  infinito.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

No hace falta configurar ninguna variable de entorno ni clave de API.
