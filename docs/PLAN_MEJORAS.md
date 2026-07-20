# Plan de mejoras profundas — Impacto (In)Directo

Documento de implementación autocontenido. Está pensado para ser ejecutado fase por
fase por cualquier desarrollador (humano o modelo) **sin necesidad de contexto
previo**: cada fase indica qué archivos tocar, qué crear, y cómo verificar.

## Estado actual (resumen para el ejecutor)

La app es un "gimnasio" minimalista de pronombres OD/OI en español:

- **Stack**: React 19 + TypeScript + Vite 6 + Tailwind 3. PWA offline con
  `vite-plugin-pwa` (manifest inline en `vite.config.ts`). Tests con Vitest.
  CI en `.github/workflows/ci.yml`: `typecheck → lint → test → build`.
- **Motor 100% local** (sin IA, sin red): `engine/pronouns.ts` (~1000 líneas,
  bancos de palabras + la regla `resolverCluster(oi, od)`) y
  `engine/generator.ts` (~1200 líneas, los 7 generadores procedurales +
  `generateBatch`). Fachada async en `engine.ts` (`generateExerciseData`).
  Dedup de preguntas recientes en `engine/history.ts`.
- **7 ejercicios** (enum `ExerciseType` en `types.ts`), uno por tarjeta de la
  home (`constants.tsx` → `MODULES`): Pop-up, Corto Circuito, Interferencia,
  Switch Instantáneo (texto libre), Detector, Posición (slots), Respuesta Rápida.
- **Persistencia** en `store.ts` (localStorage, sin librerías): ajustes,
  estadísticas por regla (`RuleId`), **SRS Leitner** por regla y registro de
  errores. `getPriorityRules()` = reglas vencidas por SRS ∪ reglas débiles;
  hoy solo sesga la generación (`weakRules`), **no tiene ninguna UI propia**.
- **UI**: `App.tsx` (switch `'home' | 'exercise'`, sin router) →
  `HomeScreen`/`GameEndScreen` (`components/screens/Navigation.tsx`) →
  `ExerciseSession` (`components/exercises/Session.tsx`, timers y corrección) →
  vistas por tipo (`components/exercises/Views.tsx`), feedback
  (`components/ui/Feedback.tsx`), header/timer (`components/ui/Shared.tsx`).

## Principios innegociables

1. **Cero menúes nuevos.** La app sigue siendo: lista de tarjetas → sesión → fin.
   Las novedades entran solo como tarjetas nuevas en la lista existente, una
   tarjeta contextual de repaso, y un botón dentro del panel de feedback.
2. **Todo 100% offline**, sin claves, sin dependencias de red en runtime.
3. **Cada fase deja la app funcionando**: al terminar cada fase debe pasar
   `npm run typecheck && npm run lint && npm test && npm run build`.
   Las fases están ordenadas por relación valor/esfuerzo; se puede parar en
   cualquiera y commitear.
4. Mantener el estilo existente: comentarios en español, estética "brutalist
   HUD" (clases `hud-label`, `font-mono`, `accent`, bordes `zinc-800`),
   voseo rioplatense en microcopy ("escribí", "contestá").

---

## FASE 0 — Higiene y rendimiento (ganancias inmediatas)

### 0.1 Imágenes (el problema nº 1)

`public/logo.png` pesa **6.3 MB** y `public/favicon.png` **5.8 MB**. Ambos se
precachean en la PWA y el logo se carga en la home (`Navigation.tsx`,
`<img src="/logo.png">`): ~12 MB para una app que debería pesar cientos de KB.

- Instalar `sharp` como devDependency y crear `scripts/optimize-assets.mjs`
  que a partir del `public/logo.png` actual genere:
  - `public/logo.png` re-escalado a ancho máx. 1200 px, comprimido (objetivo < 80 KB).
  - `public/favicon.png` de 64×64 (< 10 KB).
  - `public/apple-touch-icon.png` de 180×180.
  - `public/pwa-192.png` y `public/pwa-512.png` para el manifest.
- Ejecutar el script una vez y commitear los archivos resultantes (el script
  queda en el repo por si se cambia el arte).
- Actualizar `index.html` (favicon + `apple-touch-icon`) y el bloque
  `manifest.icons` inline de `vite.config.ts` para apuntar a `pwa-192.png` /
  `pwa-512.png`.
- Borrar `favicon.jpg` (raíz del repo, sin ningún uso) y `metadata.json`
  (resto del scaffolding de Google AI Studio, sin ningún uso).

**Aceptación**: `npm run build` y el peso total de `dist/` baja de ~12 MB a < 1 MB.
El logo se sigue viendo bien en la home (conserva `mix-blend-screen`).

### 0.2 Fuentes autoalojadas (offline real desde la primera carga)

`index.html` carga Inter y JetBrains Mono desde Google Fonts (`<link>`): la
primera carga offline pierde la tipografía y contradice el "100% offline".

- `npm i @fontsource/inter @fontsource/jetbrains-mono`.
- En `index.tsx`, importar los pesos usados (revisar Tailwind: sans = Inter
  400/700/900, mono = JetBrains Mono 400/700):
  `import '@fontsource/inter/400.css'` etc.
- Quitar los tres `<link>` de fonts.googleapis/gstatic de `index.html`.

**Aceptación**: `npm run build`, servir `dist/` sin red: la tipografía es la misma.

### 0.3 Código muerto

- `App.tsx`: quitar el guard `if (exercise.title.includes('(Próximamente)'))` —
  ningún módulo usa ese título.
- Quitar el campo `minDifficulty` de `Exercise` (`types.ts`), el guard de
  `minDifficulty` en `App.tsx`, y en `Navigation.tsx`: `moduleMinDifficulty`,
  las props `locked`/`lockLevel` y toda la rama "BLOQUEADO" de `ModuleCard`.
  Nada lo activa: ningún ejercicio define `minDifficulty`, y es deliberado
  (todos los módulos funcionan en BASE con modo de pronombre simple).

**Aceptación**: typecheck/lint/test en verde; la home se ve idéntica.

---

## FASE 1 — Arquitectura: lotes heterogéneos + motor modular

Es el **habilitador** de las fases 2–6. Hoy una sesión es mono-tipo
(`exercise.type` decide vista, corrección y timer) y `generator.ts` concentra
los 7 generadores en 1200 líneas.

### 1.1 `SessionItem`: preguntas con tipo propio

En `types.ts`:

```ts
// Un ítem de sesión: la pregunta junto con su tipo de ejercicio. Permite
// sesiones heterogéneas (p. ej. el Repaso Inteligente mezcla tipos).
export interface SessionItem {
  type: ExerciseType;
  question: QuestionData;
}
```

- `Exercise.data` pasa de `QuestionData[]` a `SessionItem[]`.
- `engine.ts` → `generateExerciseData` devuelve `SessionItem[]` (envuelve lo
  que devuelve `generateBatch`, que puede seguir devolviendo `QuestionData[]`).
- `Session.tsx`: todo lo que hoy lee `exercise.type` pasa a leer
  `currentItem.type` — la vista a renderizar, la corrección, la duración del
  timer (`TIMER_DURATIONS[currentItem.type]`, recalculada por pregunta, no una
  vez por sesión), `describeQuestion` y `recordAttempt`. `exercise.type` queda
  solo como metadato (título del header).
- `FeedbackUI` (`components/ui/Feedback.tsx`): recibir `type: ExerciseType` y
  `question` en lugar del `exercise` completo.

### 1.2 Registro de vistas + evaluador puro

- `components/exercises/Views.tsx`: exportar un registro
  `QUESTION_VIEWS: Record<ExerciseType, React.FC<QuestionViewProps>>` y
  reemplazar la cascada de 7 condicionales del render de `Session.tsx` por una
  búsqueda en el registro. (Interferencia reutiliza `PopUpPronounView`, como hoy.)
- Crear `engine/evaluate.ts` con la lógica de corrección extraída de
  `Session.tsx` (hoy inline en `handleAnswer`):

```ts
// Corrección pura por tipo: INSTANT_SWITCH y DETECTOR normalizan contra la
// lista de respuestas aceptadas; PRONOUN_POSITION compara ids de hueco;
// el resto compara con correctAnswer normalizado.
export const evaluateAnswer = (
  type: ExerciseType,
  question: QuestionData,
  answer: string,
): boolean => { ... }
```

  Usa `normalize` de `utils.ts`. `Session.tsx` la consume; añadir
  `engine/evaluate.test.ts` con casos por tipo (incluye `acceptedAnswers`,
  ids de slot válidos/ inválidos, mayúsculas/tildes/puntuación).

### 1.3 Partir `engine/generator.ts`

Crear `engine/generators/` y mover cada generador a su archivo, sin cambiar
lógica:

```
engine/generators/common.ts        buildPools, helpers de distractores,
                                   constantes compartidas, enganche con history
engine/generators/popup.ts         generatePopUp
engine/generators/shortCircuit.ts  generateShortCircuit
engine/generators/interference.ts  generateInterference
engine/generators/instantSwitch.ts generateInstantSwitch
engine/generators/detector.ts      generateDetector
engine/generators/position.ts      generatePosition + POSITION_CONTEXTS +
                                   REFLEXIVE_POSITION_CONTEXTS + gates por nivel
engine/generators/quickResponse.ts generateQuickResponse
```

`engine/generator.ts` queda como **fachada**: `generateBatch` (dispatch por
tipo + dedup por lote + history, como hoy) y re-exports, para no romper
imports existentes ni `engine/engine.test.ts`. Partir el test en espejo
(`engine/generators/*.test.ts`) es deseable pero opcional; si se hace, que sea
mover describes, no reescribirlos.

**Aceptación fase 1**: los 80 tests existentes siguen en verde (más los nuevos
de `evaluate`); jugar cada uno de los 7 módulos manualmente funciona igual que
antes; el timer de cada pregunta corresponde a su tipo.

---

## FASE 2 — Repaso Inteligente (la mejora estrella)

El SRS y el detector de debilidades ya existen y funcionan (`store.ts`), pero
son invisibles. Esta fase los materializa en **una sola tarjeta contextual**,
sin pantallas ni menúes nuevos.

### UX

- En `HomeScreen` (`Navigation.tsx`), **encima** de la lista de módulos,
  renderizar una tarjeta `ReviewCard` **solo si** `getPriorityRules().length > 0`.
  Si no hay nada vencido/débil, no existe: cero ruido.
- Estética: misma anatomía que `ModuleCard` pero destacada — borde y rótulo en
  `accent`, etiqueta `PROTOCOLO DE REPASO`, título `REPASO`, y como descripción
  hasta 3 nombres de reglas con `RULE_NAMES` de `store.ts`
  (p. ej. "OBJETIVOS: le/les → se · orden OI + OD · pronombre reflexivo").
- Al tocarla se entra a una `ExerciseSession` normal de 5 preguntas mixtas.
  `GameEndScreen` no cambia. Al volver a la home, si el repaso saldó las
  reglas, la tarjeta desaparece sola (recalcular `getPriorityRules()` en cada
  render de la home).

### Motor

Crear `engine/generators/review.ts`:

```ts
// Qué tipos de ejercicio entrenan cada regla. Los POSITION_* solo existen en
// el ejercicio de posición; el resto admite varios formatos.
export const RULE_TO_TYPES: Record<RuleId, ExerciseType[]> = {
  OD_AGREEMENT:        [POP_UP_PRONOUN, SHORT_CIRCUIT, INSTANT_SWITCH],
  REFLEXIVE:           [POP_UP_PRONOUN, SHORT_CIRCUIT, DETECTOR],
  REFLEXIVE_CONTRAST:  [POP_UP_PRONOUN, DETECTOR],
  REFLEXIVE_BODY:      [DETECTOR],
  CLITIC_ORDER:        [POP_UP_PRONOUN, SHORT_CIRCUIT, QUICK_RESPONSE],
  SE_TRANSFORM:        [POP_UP_PRONOUN, SHORT_CIRCUIT, QUICK_RESPONSE, DETECTOR],
  POSITION_PROCLISIS:  [PRONOUN_POSITION],
  POSITION_ENCLISIS:   [PRONOUN_POSITION],
  POSITION_PERIPHRASIS:[PRONOUN_POSITION],
  PERSON_FLIP:         [QUICK_RESPONSE],
};

export const generateReviewBatch = (
  size: number,
  opts: { difficulty: Difficulty; rules: RuleId[] },
): SessionItem[] => { ... }
```

- Recorrer `rules` en round-robin hasta llenar `size`; para cada regla elegir
  al azar un tipo compatible y generar **una** pregunta con
  `weakRules: [regla]` (el sesgo por regla ya existe en los generadores).
- Respetar los gates de nivel: en dificultad 1 no pedir `SE_TRANSFORM` ni
  `CLITIC_ORDER` con clúster doble si el generador no los produce en BASE —
  en ese caso, saltar la regla o degradar al tipo que sí la ejercite.
  `POSITION_PERIPHRASIS` solo en dificultad 3 (gates ya existentes en el
  generador de posición).
- Dedup: reutilizar el ring de `engine/history.ts` igual que `generateBatch`.
- En `engine.ts`, exponer `generateReviewData(): Promise<SessionItem[]>` que
  inyecta `loadSettings().difficulty` y `getPriorityRules()` (mantener la
  inyección en la fachada: los generadores no importan `store.ts`).

### App

- `App.tsx`: `handleStartReview()` — llama `generateReviewData()`, arma un
  `Exercise` sintético `{ id: 'repaso', title: 'Repaso', description: '',
  type: <tipo del primer ítem>, data: items }` y entra a `'exercise'`.
- `HomeScreen` recibe una prop nueva `onStartReview: () => void`.
- Modo infinito y CONTINUAR dentro de la sesión de repaso: volver a llamar
  `generateReviewData()` (en `Session.tsx`, el fetcher debe usar la misma
  fuente que originó la sesión; la forma más simple es pasarle a
  `ExerciseSession` una prop opcional `fetchMore?: () => Promise<SessionItem[]>`
  que por defecto es `() => generateExerciseData(exercise.type)`).

**Tests**: `review.test.ts` — el lote respeta `size`; todos los ítems entrenan
reglas pedidas (por `explanation.ruleId` o tipo compatible); con
`rules: ['POSITION_PERIPHRASIS']` y dificultad 1 no explota (degrada o salta);
sin reglas devuelve un lote genérico (fallback: comportarse como un Pop-up
mixto estándar).

**Aceptación**: fallar a propósito varias preguntas de un módulo → volver a la
home → aparece la tarjeta de repaso nombrando la regla fallada → jugarla mezcla
tipos → con el SRS al día la tarjeta no aparece.

---

## FASE 3 — Ejercicio nuevo: Decodificador (comprensión inversa)

Los 7 ejercicios van de frase plena → pronombre (**producción**). El
Decodificador va al revés (**decodificación**): ver `"Se las llevo mañana."`
y contestar `¿Qué es «las»?` eligiendo entre 4 sintagmas. Es la habilidad que
más cuesta al escuchar español real, y ningún ejercicio actual la entrena.

### Tipos y datos

- `types.ts`: añadir `DECODER = 'DECODER'` al enum y:

```ts
// Comprensión inversa: se muestra la frase YA pronominalizada y se pregunta
// por el referente de uno de los clíticos.
export interface DecoderQuestion extends QuestionWithOptions {
  phrase: string;   // "Se las llevo mañana."
  prompt: string;   // "¿Qué es «las»?" / "¿A quién se las llevo?"
}
```

  Sumar `DecoderQuestion` a la unión `QuestionData`.

### Generador (`engine/generators/decoder.ts`)

Reutiliza `VERBS`, `DIRECT_OBJECTS`, `INDIRECT_OBJECTS`, `resolverCluster` y
los helpers de `common.ts`. Dos modos:

1. **Referente OD** (todas las dificultades; `ruleId: 'OD_AGREEMENT'`).
   Dificultad 1: frase con un solo clítico (`"La compro esta tarde."`).
   Dificultad 2–3: clúster doble (`"Se las llevo mañana."`), preguntando por el OD.
   Opciones: 4 sintagmas de `DIRECT_OBJECTS`. **Regla anti-trampa**: las 4
   opciones deben (a) ser compatibles con el verbo — comparten al menos un
   `ODTag` de `verb.accepts` — y (b) tener `pron` distinto entre sí
   (lo/la/los/las), de modo que **solo la concordancia de género y número**
   desambigüe, nunca la semántica. La correcta es la que coincide con el
   clítico mostrado.
2. **Referente OI** (dificultad ≥ 2; `ruleId: 'SE_TRANSFORM'` si el clúster
   lleva `se`, si no `'CLITIC_ORDER'`). Pregunta `¿A quién …?`; opciones: 4
   personas de `INDIRECT_OBJECTS` con pronombre/nº distinto entre sí
   (p. ej. `a mi jefe` (le→se), `a mis primos` (les→se) no pueden convivir si
   ambas mapean al mismo clúster visible — filtrar para que solo una encaje).

La `explanation` sigue el formato existente (`title` + `steps`), p. ej.:
`["«las» = femenino plural", "las llaves ✓", "el paquete ✗ (masc. sing.)"]`.

### UI

- `DecoderView` en `Views.tsx`: layout calcado de `PopUpPronounView`
  (frase grande arriba, `prompt` como pregunta en `hud-label`, 4
  `AnswerButton`). Registrar en `QUESTION_VIEWS`.
- `Session.tsx`: `TIMER_DURATIONS[DECODER] = 12000`.
- `constants.tsx`: módulo nuevo (tarjeta 8) `id: 'decodificador'`,
  `title: 'Decodificador'`, descripción tipo
  "Escuchás «se lo»… ¿qué es y de quién? Entendé los pronombres al vuelo.",
  icono nuevo inline (una lupa u ondas, mismo estilo stroke 1.5).
- `utils.ts` → `describeQuestion`: caso `DECODER` (prompt = `phrase` + `prompt`).

**Tests** (`decoder.test.ts`): opciones con `pron` único entre sí; todas
compatibles con el verbo; la correcta coincide con el clítico de la frase;
en dificultad 1 no aparecen clústeres dobles; lote sin duplicados.

---

## FASE 4 — Audio con Web Speech API: botón ESCUCHAR + ejercicio Oído

Los clíticos son **átonos**: lo difícil es oírlos. La app es muda hoy.
`window.speechSynthesis` es local, gratis, sin claves y funciona offline en la
mayoría de dispositivos (las voces son del sistema) — encaja con la filosofía.

### 4.1 `speech.ts` (raíz, junto a `utils.ts`)

```ts
// TTS local con degradación: si el navegador no tiene voz en español, la app
// simplemente no ofrece audio (ni botón ni módulo Oído).
export const isSpeechAvailable = (): boolean
export const speak = (text: string): void   // cancela lo que esté sonando
```

- Selección de voz: entre `speechSynthesis.getVoices()`, la primera cuyo
  `lang` empiece por `es`, con preferencia `es-AR` > `es-419`/`es-US`/`es-MX` >
  `es-ES` > cualquier `es`. Cachear la elección; escuchar `voiceschanged`
  (en Chrome la lista llega async). `rate` ~0.95.
- Todo envuelto en guards (`'speechSynthesis' in window`, try/catch): en un
  entorno sin API, `isSpeechAvailable()` es `false` y `speak` es no-op.

### 4.2 Botón ESCUCHAR en el feedback

En `Feedback.tsx`, cuando hay feedback visible y `isSpeechAvailable()`,
mostrar un botón secundario `[ ESCUCHAR ]` (estilo de los botones `font-mono`
existentes) que hace `speak(fraseCorrecta)` — la frase correcta completa que
ya muestra el panel. Cero fricción: quien no lo toca, no lo nota.

### 4.3 Ejercicio Oído (`ExerciseType.EAR`, tarjeta 9)

- `types.ts`:

```ts
export interface EarQuestion extends QuestionWithOptions {
  maskedPhrase: string; // "___ doy mañana."  (clúster tapado)
  fullPhrase: string;   // "Se lo doy mañana." (lo que se pronuncia)
}
```

- `engine/generators/ear.ts`: reutiliza la tubería del Pop-up (frase +
  clúster correcto + distractores homogéneos); `maskedPhrase` = frase con el
  clúster reemplazado por `"___"`. `ruleId` heredado del modo usado
  (OD_AGREEMENT / CLITIC_ORDER / SE_TRANSFORM).
- `EarView` en `Views.tsx`: muestra `maskedPhrase`, un botón grande
  `🔊 REPETIR` que llama `speak(fullPhrase)`, y las 4 opciones. Auto-reproducir
  al montar cada pregunta (`useEffect` sobre la pregunta). **Nunca** renderizar
  `fullPhrase` como texto antes de responder; tras responder, el feedback ya
  muestra la frase completa.
- `TIMER_DURATIONS[EAR] = 12000`. Módulo en `constants.tsx` (icono altavoz).
- **Degradación**: en `HomeScreen`, filtrar el módulo Oído si
  `!isSpeechAvailable()`. En `RULE_TO_TYPES` no incluir `EAR` (el repaso no
  debe depender del audio).
- `describeQuestion`: caso `EAR` usando `fullPhrase`.

**Tests** (`ear.test.ts`, sin DOM): `maskedPhrase` no contiene el clúster
correcto; `fullPhrase` sí; opciones homogéneas y únicas.

---

## FASE 5 — Racha diaria (motivación mínima, sin pantallas)

- `store.ts`: clave `ii_streak_v1`, forma
  `{ version: 1, lastDay: 'YYYY-MM-DD', count: number }` (fecha **local**, no
  UTC). Funciones:
  - `touchStreak(now = new Date())`: llamada desde `recordAttempt`. Mismo día →
    no-op; día siguiente → `count + 1`; hueco de más de un día → `count = 1`.
  - `getStreak(now = new Date()): number` — devuelve `count` si `lastDay` es
    hoy o ayer, si no `0`.
- UI (solo cuando `getStreak() >= 2`):
  - `HomeScreen`: una línea `font-mono` bajo el subtítulo del hero:
    `RACHA: 4 DÍAS`.
  - `GameEndScreen`: misma línea bajo los contadores.
- **Tests** en `store.test.ts` (con fechas inyectadas): mismo día idempotente,
  día consecutivo incrementa, hueco resetea, cambio de mes/año correcto.

---

## FASE 6 (opcional) — Cadena: diálogo con memoria referencial

Innovación conversacional sin tocar la mecánica de sesión: **pares** de
preguntas `QUICK_RESPONSE` enlazadas donde la segunda **no repite el
sustantivo** y obliga a arrastrar el referente, como en una conversación real.

- `QuickResponseQuestion` gana `context?: string` (se muestra arriba, en
  gris, estilo cita: `"María te prestó su bici el viernes."`).
- Generador `engine/generators/chain.ts`: produce `SessionItem[]` de a pares
  con el mismo referente: turno 1 con el sustantivo explícito
  (`"¿Cuándo devolvés la bici?" → "La devuelvo el lunes"`), turno 2 solo
  pronominal y sin contexto repetido (`"¿Y a quién se la avisás?"…`), ambos con
  el mismo objeto de `DIRECT_OBJECTS`. `ruleId` según el clúster.
- `QuickResponseView`: renderizar `context` si existe (2 líneas de JSX).
- Tarjeta 10 en `constants.tsx` (`id: 'cadena'`, título `Cadena`). El lote de
  5 se compone de 2 pares + 1 suelta (o `size` redondeado a pares).

Si el presupuesto no alcanza, **saltar esta fase**: nada posterior depende de ella.

---

## FASE 7 — Tests de sesión (recomendada)

La lógica más propensa a regresiones (timers, `answerLockRef`, modo infinito)
no tiene cobertura.

- devDeps: `@testing-library/react`, `jsdom`. En `vitest.config` (o el bloque
  `test` de `vite.config.ts`): `environment: 'jsdom'` solo para
  `components/**/*.test.tsx` (usar `environmentMatchGlobs` o comentario
  `// @vitest-environment jsdom` por archivo, para no tocar los tests de motor).
- `components/exercises/Session.test.tsx` con `vi.useFakeTimers()` y un
  `Exercise` fixture:
  1. Responder dos veces seguidas solo registra un intento (candado).
  2. El timeout marca la pregunta como fallada (`recordAttempt` con
     `timedOut: true`) y avanza tras el delay de feedback.
  3. Acierto avanza tras 2 s; fallo tras 5 s; CONTINUAR salta la espera.
  4. Con `isInfinite`, al acercarse al final se encola otro lote (mockear
     `generateExerciseData`).

---

## Arquitectura resultante

```
engine.ts                      fachada async (devuelve SessionItem[]; inyecta
                               dificultad + reglas prioritarias del store)
engine/
  pronouns.ts                  bancos + resolverCluster (SIN CAMBIOS)
  history.ts                   dedup reciente (SIN CAMBIOS)
  evaluate.ts                  evaluateAnswer(type, question, answer)  [nuevo]
  generator.ts                 fachada de compatibilidad (generateBatch)
  generators/
    common.ts   popup.ts   shortCircuit.ts   interference.ts
    instantSwitch.ts   detector.ts   position.ts   quickResponse.ts
    decoder.ts   ear.ts   review.ts   (chain.ts)                      [nuevos]
speech.ts                      TTS con degradación                     [nuevo]
store.ts                       + racha diaria (ii_streak_v1)
components/
  exercises/Views.tsx          QUESTION_VIEWS + DecoderView + EarView
  exercises/Session.tsx        dirigido por SessionItem (heterogéneo)
  screens/Navigation.tsx       + ReviewCard + racha (sin rama BLOQUEADO)
  ui/Feedback.tsx              + botón ESCUCHAR
scripts/optimize-assets.mjs    generación de iconos/logo               [nuevo]
```

## Verificación global

1. `npm run typecheck && npm run lint && npm test && npm run build` (= CI).
2. `npm run dev` y recorrer a mano:
   - Los 7 módulos originales funcionan exactamente igual.
   - Decodificador y Oído generan 5 preguntas variadas y corrigen bien en los
     3 niveles; Oído pronuncia y REPETIR repite.
   - Fallar preguntas → la tarjeta REPASO aparece en la home, mezcla tipos, y
     desaparece cuando el SRS queda al día.
   - El botón ESCUCHAR del feedback lee la frase correcta.
   - La racha aparece a partir del segundo día de uso.
3. `dist/` pesa < 1 MB y la app abre offline con fuentes e iconos correctos.
4. En un navegador sin voces en español: no hay tarjeta Oído ni botón
   ESCUCHAR, y nada falla.
