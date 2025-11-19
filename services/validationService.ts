import type { Piece } from '../types';

const MIN_DIMENSION = 20; // 20mm
const MAX_ASPECT_RATIO = 30; // 30:1

/**
 * Analyzes a list of pieces for potential manufacturing issues.
 * @param pieces - The array of pieces to analyze.
 * @returns An array of string warnings for pieces that might be problematic.
 */
export const analyzePieces = (pieces: Piece[]): string[] => {
  const warnings: string[] = [];
  const checkedPieces = new Set<string>();

  pieces.forEach(piece => {
    // Avoid duplicate warnings for pieces with quantity > 1
    if (checkedPieces.has(piece.name)) {
        return;
    }

    // 1. Check for very small dimensions
    if (piece.width < MIN_DIMENSION || piece.height < MIN_DIMENSION) {
      warnings.push(`La pieza '${piece.name}' (${piece.width}x${piece.height}mm) es muy pequeña y podría ser difícil de manipular de forma segura.`);
    }

    // 2. Check for extreme aspect ratios
    const longerSide = Math.max(piece.width, piece.height);
    const shorterSide = Math.min(piece.width, piece.height);

    if (shorterSide > 0) {
      const aspectRatio = longerSide / shorterSide;
      if (aspectRatio > MAX_ASPECT_RATIO) {
        warnings.push(`La pieza '${piece.name}' tiene una proporción muy extrema (${aspectRatio.toFixed(0)}:1), lo que podría hacerla frágil.`);
      }
    }

    checkedPieces.add(piece.name);
  });

  return warnings;
};