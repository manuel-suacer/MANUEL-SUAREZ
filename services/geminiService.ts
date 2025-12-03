


import { GoogleGenAI, Type } from "@google/genai";
import type { Piece, Board, OptimizationResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// FIX: Define a response schema for reliable JSON output.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    totalBoards: { type: Type.NUMBER, description: "Número total de tableros utilizados." },
    estimatedWastePercentage: { type: Type.NUMBER, description: "Porcentaje de desperdicio global en todos los tableros." },
    totalCorteMetrosLineales: { type: Type.NUMBER, description: "Suma total en milímetros de la longitud de todos los cortes de guillotina necesarios." },
    totalNumberOfCuts: { type: Type.NUMBER, description: "El número total de operaciones de corte (pasadas de cuchilla) en todos los tableros." },
    layouts: {
      type: Type.ARRAY,
      description: "Array con la distribución de piezas en cada tablero.",
      items: {
        type: Type.OBJECT,
        properties: {
          boardIndex: { type: Type.NUMBER, description: "Índice del tablero, comenzando en 0." },
          boardWastePercentage: { type: Type.NUMBER, description: "Porcentaje de desperdicio para este tablero específico." },
          estimatedCncTimeMinutes: { type: Type.NUMBER, description: "Tiempo estimado en minutos para que un CNC corte este tablero, si aplica." },
          numberOfCutsForLayout: { type: Type.NUMBER, description: "El número de operaciones de corte (pasadas de cuchilla) para este tablero específico." },
          placedPieces: {
            type: Type.ARRAY,
            description: "Array de piezas colocadas en este tablero.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Identificador único para esta instancia de pieza colocada." },
                originalPieceId: { type: Type.STRING, description: "El 'id' de la pieza en la lista de entrada." },
                name: { type: Type.STRING, description: "El 'name' de la pieza en la lista de entrada." },
                width: { type: Type.NUMBER, description: "Ancho de la pieza como fue colocada (puede estar intercambiado con height si se rota)." },
                height: { type: Type.NUMBER, description: "Alto de la pieza como fue colocada." },
                x: { type: Type.NUMBER, description: "Coordenada X de la esquina superior izquierda." },
                y: { type: Type.NUMBER, description: "Coordenada Y de la esquina superior izquierda." },
                rotated: { type: Type.BOOLEAN, description: "Indica si la pieza fue rotada." },
              },
              required: ['id', 'originalPieceId', 'name', 'width', 'height', 'x', 'y', 'rotated']
            }
          }
        },
        required: ['boardIndex', 'placedPieces', 'boardWastePercentage']
      }
    }
  },
  required: ['totalBoards', 'estimatedWastePercentage', 'layouts', 'totalCorteMetrosLineales']
};

const generatePrompt = (board: Board, pieces: Piece[], kerf: number, machine: string, forceGuillotine: boolean, cncSpeed?: number): string => {
  const piecesJson = JSON.stringify(pieces.map(p => ({
    id: p.id,
    name: p.name,
    reference: p.reference,
    width: p.width,
    height: p.height,
    quantity: p.quantity,
    hasGrain: p.hasGrain,
    grainContinuityGroup: p.grainContinuityGroup,
    edgeTop: p.edgeTop,
    edgeBottom: p.edgeBottom,
    edgeLeft: p.edgeLeft,
    edgeRight: p.edgeRight,
  })), null, 2);
  
  const guillotineInstruction = forceGuillotine 
    ? "TODOS los cortes deben ser de guillotina (cortes rectos de un borde a otro del tablero o retal)."
    : `La máquina seleccionada es una '${machine}'. Prioriza layouts que agrupen piezas para permitir cortes largos y continuos, lo cual es más eficiente para este tipo de máquina. Puedes usar cortes que no sean de guillotina si mejora significativamente el aprovechamiento y la máquina es un CNC.`;

  const cncTimeInstruction = machine === 'cnc' && cncSpeed
    ? `
    11. **Cálculo de Tiempo CNC:** Para cada tablero, calcula el tiempo estimado de corte si se usa un CNC.
        - Velocidad de corte: ${cncSpeed} mm/minuto.
        - Considera la longitud total de todos los recorridos de corte necesarios para separar cada pieza en el tablero.
        - Añade un factor de tiempo adicional del 15% al tiempo de corte puro para tener en cuenta los movimientos rápidos (rapids) entre cortes, aceleraciones y deceleraciones.
        - Devuelve este valor en minutos en el campo \`estimatedCncTimeMinutes\` para cada layout. Si la máquina no es un CNC, este campo puede ser omitido.
    `
    : '';


  return `
    Actúa como un experto en algoritmos de optimización de corte (nesting) para la industria de la madera y el mueble. Tu tarea es generar el layout de corte más eficiente posible para un conjunto de piezas en tableros de tamaño estándar.

    **Restricciones y Reglas:**

    1.  **Objetivo Principal:** Minimizar el desperdicio total (área no utilizada) de los tableros.
    2.  **Dimensiones del Tablero:** El tablero disponible tiene un LARGO de ${board.width} y un ANCHO de ${board.height}. La veta del tablero corre a lo largo de la dimensión 'width' (Largo).
    3.  **Lista de Piezas:** Las piezas a cortar se especifican en el siguiente JSON. Para cada pieza, 'width' corresponde a su LARGO y 'height' a su ANCHO.
        ${piecesJson}
    4.  **Espacio de Corte (Kerf):** DEJA UN ESPACIO OBLIGATORIO de ${kerf} mm entre cada pieza para el ancho del disco de corte o fresa. Las coordenadas X/Y deben tener en cuenta este espaciado. Por ejemplo, si una pieza de 100 de ancho está en x=0, la siguiente pieza a su derecha debe empezar en x >= 100 + ${kerf}. Esto se aplica a los 4 lados.
    5.  **Dirección de la Veta:** Si una pieza tiene \`hasGrain: true\`, NO PUEDE ser rotada. Su dimensión 'width' (Largo) debe permanecer paralela a la dimensión 'width' (Largo) del tablero para mantener la alineación de la veta.
    6.  **Continuidad de Veta (Regla CRÍTICA):** Las piezas que compartan el mismo valor en \`grainContinuityGroup\` DEBEN ser tratadas como un bloque único e indivisible. Deben colocarse una al lado de la otra, sin interrupción, a lo largo de su eje 'width' para mantener el patrón de la veta. Mantén la misma coordenada 'y' para todas las piezas del grupo. El kerf de ${kerf} mm debe aplicarse entre ellas. La altura de todas las piezas dentro de un mismo grupo debe ser idéntica.
    7.  **Método de Corte:** ${guillotineInstruction}
    8.  **Sin Colisiones:** Las piezas no pueden solaparse. Teniendo en cuenta el kerf, las áreas ocupadas por las piezas más el kerf no pueden superponerse.
    9.  **Múltiples Tableros:** Si todas las piezas no caben en un solo tablero, utiliza tantos tableros como sea necesario, siempre con las mismas dimensiones.
    10. **Cálculo de Corte Lineal:** Calcula la longitud total de todos los cortes de guillotina (de lado a lado) necesarios para separar todas las piezas. Suma la longitud de cada corte a través de todos los tableros y devuelve el total en milímetros en el campo \`totalCorteMetrosLineales\`.
    ${cncTimeInstruction}
    12. **Canteado (Edge Banding):** Las propiedades 'edgeTop', 'edgeBottom', 'edgeLeft', 'edgeRight' indican qué lados de una pieza necesitan canteado. Si es posible y no compromete significativamente el aprovechamiento, intenta agrupar piezas de manera que los lados sin canto queden adyacentes a otros lados sin canto o a los bordes del tablero. La minimización del desperdicio sigue siendo la prioridad principal.
    13. **Conteo de Cortes:** Cuenta el número de operaciones de corte (pasadas de cuchilla) individuales. Para cortes de guillotina, cada pasada a lo largo o ancho del tablero/retal es un corte. Para CNC, cada perímetro de pieza es una operación de corte. Devuelve el total para cada tablero en \`numberOfCutsForLayout\` y la suma de todos los tableros en \`totalNumberOfCuts\`.

    **Datos de Entrada para esta Petición:**

    Tablero (Largo x Ancho): ${board.width} x ${board.height} mm
    Margen de corte (kerf): ${kerf} mm
    Máquina: ${machine}
    ${machine === 'cnc' && cncSpeed ? `Velocidad CNC: ${cncSpeed} mm/min` : ''}
    Forzar cortes de guillotina: ${forceGuillotine}
    Piezas: ${piecesJson}

    Genera el layout óptimo basándote en esta información. Asegúrate de incluir el campo 'name' de la pieza original en cada objeto 'placedPiece'.
  `;
};

export const getOptimalLayout = async (board: Board, pieces: Piece[], kerf: number, machine: string, forceGuillotine: boolean, cncSpeed?: number): Promise<OptimizationResult> => {
  try {
    const prompt = generatePrompt(board, pieces, kerf, machine, forceGuillotine, cncSpeed);
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText) as OptimizationResult;

    // Basic validation
    if (!result.layouts || !result.hasOwnProperty('totalBoards') || !result.hasOwnProperty('totalCorteMetrosLineales')) {
        throw new Error("Respuesta JSON inválida del API.");
    }
    
    return result;

  } catch (error) {
    console.error("Error al obtener el layout óptimo:", error);
    if (error instanceof Error && error.message.includes('API key')) {
      throw new Error("Error de API Key. Por favor, verifica que la clave de API esté configurada correctamente.");
    }
    throw new Error("No se pudo generar el plan de corte. Inténtalo de nuevo.");
  }
};