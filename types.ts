

export interface Piece {
  id: string;
  width: number;
  height: number;
  quantity: number;
  hasGrain: boolean;
  name: string;
  reference?: string;
  grainContinuityGroup?: string;
  edgeTop: boolean;
  edgeBottom: boolean;
  edgeLeft: boolean;
  edgeRight: boolean;
}

export interface Board {
  width: number;
  height: number;
  name?: string;
}

export interface PlacedPiece {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotated: boolean;
  originalPieceId: string;
  name: string;
}

export interface Layout {
  boardIndex: number;
  placedPieces: PlacedPiece[];
  boardWastePercentage: number;
  estimatedCncTimeMinutes?: number;
  numberOfCutsForLayout?: number;
}

export interface OptimizationResult {
  totalBoards: number;
  estimatedWastePercentage: number;
  layouts: Layout[];
  totalCorteMetrosLineales: number;
  totalNumberOfCuts?: number;
}