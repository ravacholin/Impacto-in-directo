
import { GoogleGenAI, Type } from "@google/genai";
import { ExerciseType, QuestionData, ForcedCommunicationQuestion } from './types';

// Helper to get the AI instance dynamically
const getAI = () => {
    // 1. Try Local Storage (User entered)
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
        return new GoogleGenAI({ apiKey: storedKey });
    }

    // 2. Try Environment Variable (Dev/Build)
    if (process.env.API_KEY) {
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    throw new Error("MISSING_API_KEY");
};

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        // Minimal request to check validity
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Ping',
        });
        return true;
    } catch (error) {
        console.error("API Key validation failed:", error);
        return false;
    }
};

const PROMPTS = {
    [ExerciseType.POP_UP_PRONOUN]: `
    Eres un profesor de español experto creando ejercicios de práctica.
    Genera 5 preguntas para el ejercicio "Pop-up Pronoun".
    El objetivo es que los estudiantes de nivel intermedio automaticen el uso de pronombres de objeto directo e indirecto en español.
    Cada pregunta debe consistir en una frase corta en español que contenga uno o dos objetos.
    Para cada frase, proporciona el pronombre o pronombres correctos que reemplazan a los objetos.
    
    CRÍTICO - REGLA DE "SE" (LE LO -> SE LO):
    1. EN ESPAÑOL ES IMPOSIBLE LA SECUENCIA "LE LO", "LE LA", "LE LOS", "LE LAS".
    2. SIEMPRE que "le" o "les" precede a un pronombre de objeto directo (lo, la, los, las), "le" DEBE cambiarse a "se".
    3. JAMÁS generes una respuesta que contenga "le la", "le lo", "les lo", etc.
    4. Ejemplo: "Dar el libro a ella" -> INCORRECTO: "Le lo doy". CORRECTO: "Se lo doy".
    
    CRÍTICO - Homogeneidad de opciones:
    1. Si la respuesta correcta consiste en DOS pronombres (ej: "se lo"), TODAS las opciones incorrectas deben consistir en DOS pronombres también (ej: "me lo", "te la", "se los").
    2. Si la respuesta correcta es UN solo pronombre (ej: "lo"), TODAS las opciones incorrectas deben ser UN solo pronombre.
    NUNCA mezcles opciones de una palabra con opciones de dos palabras en la misma pregunta para evitar que la respuesta se deduzca por longitud.
    
    Asegúrate de que la respuesta correcta esté siempre incluida en las opciones.
    Devuelve el resultado como un array JSON que se ajuste al siguiente esquema.
  `,
    [ExerciseType.INSTANT_SWITCH]: `
    Eres un profesor de español experto creando ejercicios de práctica.
    Genera 5 preguntas para el ejercicio "Switch Instantáneo".
    El objetivo es que los estudiantes de nivel intermedio practiquen la transformación de frases con objetos explícitos a frases con pronombres.
    Cada pregunta debe consistir en un par de frases:
    1. Una "initialPhrase" con objetos explícitos (ej: "Doy el libro a Juan.").
    2. Una "transformedPhrase" que es la versión correcta con pronombres (ej: "Se lo doy.").
    Las frases deben cubrir varios casos (OD, OI, OD+OI, diferentes verbos y personas).
    
    CRÍTICO - REGLA DE "SE":
    Si el resultado implica juntar le/les + lo/la/los/las, DEBES USAR "SE".
    JAMÁS generes "Le lo doy". SIEMPRE "Se lo doy".

    Devuelve el resultado como un array JSON que se ajuste al siguiente esquema.
  `,
    [ExerciseType.DETECTOR]: `
    Eres un profesor de español experto creando ejercicios de práctica tipo "Debug de Código".
    Genera 5 preguntas.
    Cada pregunta presenta un contexto ("prompt") y 4 opciones de frases ("options").
    
    OBJETIVO: El estudiante debe identificar qué frases son gramaticalmente CORRECTAS en español estándar.
    
    REGLA DE VERSATILIDAD:
    En español, a menudo hay más de una forma correcta de decir lo mismo (ej: "Se lo voy a dar" y "Voy a dárselo").
    1. Tus opciones DEBEN incluir al menos una frase correcta.
    2. PUEDEN incluir más de una frase correcta (variaciones de posición de pronombres).
    3. Las opciones incorrectas deben tener errores claros y objetivos (laísmo flagrante, orden incorrecto 'me se', cacofonía 'le lo', falta de concordancia).
    
    IMPORTANTE:
    El campo "correctAnswers" (array) debe contener TODAS las strings del array "options" que sean gramaticalmente válidas. Si hay dos opciones válidas, incluye ambas en "correctAnswers".
    
    Devuelve el resultado como un array JSON que se ajuste al siguiente esquema.
  `,
    [ExerciseType.SHORT_CIRCUIT]: `
    Eres un profesor de español experto. Genera 5 preguntas para el ejercicio "Corto Circuito".
    El objetivo es entrenar la memoria de trabajo para combinar rápidamente un objeto directo y uno indirecto en los pronombres correctos.
    Cada pregunta debe tener:
    1. "person": El objeto indirecto (ej: "a mí", "a nosotros", "a ellos").
    2. "object": El objeto directo (ej: "el coche", "la casa", "los libros").
    3. "correctAnswer": La combinación correcta de pronombres (ej: "me lo", "nos la", "se los").
    4. "options": Un array de 4 strings, incluyendo la respuesta correcta y 3 opciones incorrectas pero plausibles.
    
    CRÍTICO - REGLA DE "SE" (LE LO -> SE LO):
    SIEMPRE que la combinación resulte en le+lo, le+la, etc., DEBES CAMBIAR "le" por "se".
    "a él" + "el libro" -> "se lo" (NUNCA "le lo").

    Varía los géneros y números de los objetos.
    Devuelve el resultado como un array JSON que se ajuste al siguiente esquema.
  `,
    [ExerciseType.INTERFERENCE]: `
    Eres un profesor de español experto. Genera 5 preguntas para el ejercicio "Interferencia".
    El objetivo es entrenar la atención selectiva, forzando al estudiante a identificar los objetos directo e indirecto dentro de una frase que contiene información distractora.
    Cada pregunta debe tener:
    1. "phrase": Una frase que contenga un objeto directo, un objeto indirecto y un elemento distractor (ej: "Rápidamente, le di el libro a María ayer."). El distractor puede ser un adverbio, un adjetivo irrelevante, etc.
    2. "correctAnswer": La combinación correcta de pronombres que reemplazan a los objetos (ej: "se lo").
    3. "options": Un array de 4 strings, incluyendo la respuesta correcta y 3 opciones incorrectas plausibles.
    
    CRÍTICO - REGLA DE "SE":
    Asegúrate de aplicar la regla le->se cuando sea necesario. NUNCA generes "le lo" como respuesta correcta.

    Devuelve el resultado como un array JSON que se ajuste al siguiente esquema.
  `,
    [ExerciseType.FORCED_COMMUNICATION]: `
    Eres un profesor de español experto creando ejercicios de roleplay.
    Genera 5 preguntas para el ejercicio "Comunicación Forzada".
    El objetivo es que los estudiantes de nivel intermedio practiquen el uso de pronombres en un contexto conversacional realista.
    
    Cada pregunta debe tener:
    1. "scenario": Una descripción breve de una situación cotidiana.
    2. "prompt": Una pregunta o instrucción directa de otro personaje.

    REGLA CRÍTICA DE DISEÑO:
    En el "prompt" (lo que dice el otro personaje), EVITA usar los pronombres (lo, la, le, se) que el estudiante debe usar en su respuesta.
    DEBES usar los SUSTANTIVOS EXPLÍCITOS. Esto fuerza al estudiante a hacer la transformación mental.

    Ejemplo INCORRECTO:
    - Prompt: "¿Te lo doy?" (El estudiante solo repite "Sí, dámelo". No hay esfuerzo).
    
    Ejemplo CORRECTO:
    - Prompt: "El camarero trae la cuenta. ¿Le doy la cuenta a usted o a su amigo?" (El estudiante debe transformar 'la cuenta' y 'a usted' -> "Démela a mí").
    - Prompt: "Tengo el informe final. ¿Qué hago con el informe?" (Respuesta esperada: "Mándamelo").

    Devuelve el resultado como un array JSON que se ajuste al siguiente esquema.
  `,
    [ExerciseType.BATTLE]: `
    Eres un generador de desafíos para un modo de "Supervivencia" en un juego de español.
    Genera 15 preguntas de respuesta rápida tipo "Pop-up Pronoun".
    El objetivo es poner a prueba los reflejos del estudiante bajo presión.
    
    Cada pregunta debe consistir en una frase corta con objetos.
    Proporciona la respuesta correcta (pronombres) y 3 distractores.

    CRÍTICO - REGLA DE "SE" (LE LO -> SE LO):
    1. EN ESPAÑOL ES IMPOSIBLE LA SECUENCIA "LE LO", "LE LA", "LE LOS", "LE LAS".
    2. SIEMPRE que "le" o "les" precede a un pronombre de objeto directo (lo, la, los, las), "le" DEBE cambiarse a "se".
    3. JAMÁS generes una respuesta que contenga "le la", "le lo", "les lo", etc.
    4. Ejemplo: "Dar el libro a ella" -> INCORRECTO: "Le lo doy". CORRECTO: "Se lo doy".

    CRÍTICO - Homogeneidad de opciones:
    1. Si la respuesta correcta tiene DOS pronombres, TODAS las opciones deben tener DOS.
    2. Si tiene UNO, TODAS deben tener UNO.
    
    Devuelve un array JSON compatible con el esquema de Pop-up Pronoun.
  `
};

const SCHEMAS = {
    [ExerciseType.POP_UP_PRONOUN]: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                phrase: { type: Type.STRING, description: 'La frase original en español.' },
                correctAnswer: { type: Type.STRING, description: 'El pronombre o pronombres correctos.' },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Un array de 4 opciones de pronombres, incluyendo la respuesta correcta.' }
            },
            required: ['phrase', 'correctAnswer', 'options']
        }
    },
    [ExerciseType.INSTANT_SWITCH]: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                initialPhrase: { type: Type.STRING, description: 'La frase con objetos explícitos.' },
                transformedPhrase: { type: Type.STRING, description: 'La frase transformada con pronombres.' }
            },
            required: ['initialPhrase', 'transformedPhrase']
        }
    },
    [ExerciseType.DETECTOR]: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                prompt: { type: Type.STRING, description: 'La instrucción para el usuario (contexto).' },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Un array de 4 opciones de respuesta.' },
                correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Un array que contiene TODAS las opciones que son gramaticalmente correctas.' }
            },
            required: ['prompt', 'options', 'correctAnswers']
        }
    },
    [ExerciseType.SHORT_CIRCUIT]: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                person: { type: Type.STRING, description: 'El objeto indirecto.' },
                object: { type: Type.STRING, description: 'El objeto directo.' },
                correctAnswer: { type: Type.STRING, description: 'La combinación correcta de pronombres.' },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array de 4 opciones, incluyendo la correcta.' }
            },
            required: ['person', 'object', 'correctAnswer', 'options']
        }
    },
    [ExerciseType.INTERFERENCE]: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                phrase: { type: Type.STRING, description: 'La frase con objetos y un distractor.' },
                correctAnswer: { type: Type.STRING, description: 'La combinación correcta de pronombres.' },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array de 4 opciones, incluyendo la correcta.' }
            },
            required: ['phrase', 'correctAnswer', 'options']
        }
    },
    [ExerciseType.FORCED_COMMUNICATION]: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                scenario: { type: Type.STRING, description: 'La descripción del contexto de roleplay.' },
                prompt: { type: Type.STRING, description: 'La pregunta o instrucción que el estudiante debe responder.' }
            },
            required: ['scenario', 'prompt']
        }
    },
    [ExerciseType.BATTLE]: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                phrase: { type: Type.STRING, description: 'La frase original en español.' },
                correctAnswer: { type: Type.STRING, description: 'El pronombre o pronombres correctos.' },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Un array de 4 opciones de pronombres, incluyendo la respuesta correcta.' }
            },
            required: ['phrase', 'correctAnswer', 'options']
        }
    }
};


export const generateExerciseData = async (exerciseType: ExerciseType): Promise<QuestionData[]> => {
    try {
        let prompt = PROMPTS[exerciseType];
        const schema = SCHEMAS[exerciseType];
        const ai = getAI();

        if (!prompt || !schema) {
            throw new Error(`Exercise type "${exerciseType}" not supported for AI generation.`);
        }

        // INJECT RANDOMNESS:
        // By appending a random seed or instruction, we force the LLM to generate fresh content
        // and avoid caching mechanisms (both internal and model-side).
        prompt += `\n\n[RANDOM_SEED: ${Date.now()}-${Math.random()}]`;
        prompt += `\nIMPORTANTE: Genera preguntas TOTALMENTE NUEVAS y DIFERENTES a las anteriores. Sé creativo con los sustantivos y verbos.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        const jsonStr = response.text.trim();
        const data = JSON.parse(jsonStr);

        if (!Array.isArray(data) || data.length === 0) {
            console.error("AI returned empty or invalid data", data);
            throw new Error("Failed to generate exercise questions.");
        }

        return data as QuestionData[];

    } catch (error) {
        console.error("Error generating exercise data with Gemini:", error);
        throw error;
    }
};

export const evaluateAnswer = async (question: ForcedCommunicationQuestion, userAnswer: string): Promise<{ isCorrect: boolean; feedback: string; }> => {
    const prompt = `
        Eres un profesor de español experto y amigable. Evalúa la respuesta de un estudiante.
        El contexto es: "${question.scenario}"
        La tarea era: "${question.prompt}"
        La respuesta del estudiante fue: "${userAnswer}"

        ¿Usó el estudiante los pronombres de objeto directo e/o indirecto de forma correcta y natural para completar la tarea?

        Responde únicamente con un objeto JSON que se ajuste al siguiente esquema. No incluyas "\`\`\`json" ni nada más.
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING, description: "Una explicación corta y útil en español. Si es correcto, da un refuerzo positivo. Si es incorrecto, explica el error amablemente y proporciona una o dos formas correctas de responder." }
        },
        required: ['isCorrect', 'feedback']
    };

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        return {
            isCorrect: result.isCorrect,
            feedback: result.feedback
        };

    } catch (error) {
        console.error("Error evaluating answer with Gemini:", error);
        // Fallback in case of AI error
        return {
            isCorrect: false,
            feedback: "Hubo un problema al evaluar tu respuesta. Por favor, intenta de nuevo."
        };
    }
};

export const evaluateTransformation = async (initialPhrase: string, userAnswer: string): Promise<{ isCorrect: boolean; feedback: string; }> => {
    const prompt = `
        Eres un profesor de español experto. Evalúa la respuesta de un estudiante en un ejercicio de transformación de pronombres.
        Frase original (con sustantivos): "${initialPhrase}"
        Respuesta del estudiante (intento de sustitución con pronombres): "${userAnswer}"

        OBJETIVO: El estudiante debe reemplazar los objetos directos e indirectos por sus pronombres correspondientes.
        
        REGLAS CRÍTICAS DE EVALUACIÓN (LEER ATENTAMENTE):
        1. IGNORA por completo signos de puntuación (puntos, comas, interrogaciones) y mayúsculas/minúsculas.
        2. ELISIÓN DEL SUJETO: En español es CORRECTO y NATURAL omitir el sujeto.
           - "Ella se lo da" == "Se lo da". AMBAS son correctas.
           - "Nosotros lo construimos" == "Lo construimos". AMBAS son correctas.
           - JAMÁS marques error por falta de sujeto explícito.
        3. POSICIÓN DE PRONOMBRES:
           - Antes del verbo conjugado: "Lo quiero ver" (Correcto).
           - Adjunto al infinitivo/gerundio: "Quiero verlo" (Correcto).
           - Ambas formas son válidas.
        4. Si la respuesta cumple con gramática correcta de pronombres y verbos, "isCorrect": true.

        Responde únicamente con un objeto JSON (sin markdown):
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
        },
        required: ['isCorrect', 'feedback']
    };

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        return {
            isCorrect: result.isCorrect,
            feedback: result.isCorrect ? "¡Perfecto!" : result.feedback
        };
    } catch (error) {
        console.error("Error evaluating transformation:", error);
        return {
            isCorrect: false,
            feedback: "Error de conexión. Intenta de nuevo."
        };
    }
};