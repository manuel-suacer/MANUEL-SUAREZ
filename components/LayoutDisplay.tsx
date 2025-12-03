
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Group, Line } from 'react-konva';
import Konva from 'konva';
import type { Board, Layout, PlacedPiece, Piece } from '../types';
import { ClockIcon, CubeIcon, ExpandIcon, SawBladeIcon, TableIcon, ZoomInIcon, ZoomOutIcon } from './icons';

const pieceColors = [
  '#A7F3D0', '#BAE6FD', '#FDE68A', '#DDD6FE', '#FECDD3', '#C7D2FE', '#99F6E4', '#FCA5A5'
];
const pieceBorderColors = [
  '#34D399', '#60A5FA', '#FBBF24', '#A78BFA', '#F472B6', '#818CF8', '#2DD4BF', '#EF4444'
];

const GRID_SNAP_SIZE = 5;

// Helper function for collision detection with kerf
function haveIntersectionWithKerf(r1: Konva.RectConfig, r2: Konva.RectConfig, kerf: number) {
    if (!r1.x || !r1.y || !r2.x || !r2.y || !r1.width || !r1.height || !r2.width || !r2.height) return false;
    // Check if the gap between rectangles is less than kerf
    return !(
        r2.x >= r1.x + r1.width + kerf ||  // r2 is to the right of r1 with a gap of at least kerf
        r2.x + r2.width + kerf <= r1.x ||   // r2 is to the left of r1 with a gap of at least kerf
        r2.y >= r1.y + r1.height + kerf || // r2 is below r1 with a gap of at least kerf
        r2.y + r2.height + kerf <= r1.y    // r2 is above r1 with a gap of at least kerf
    );
}

const GrainGroupLabel = ({ text, x, y, theme }: { text: string; x: number; y: number; theme: 'light' | 'dark' }) => {
    const FONT_SIZE = 10;
    const PADDING_X = 6;
    const PADDING_Y = 3;
    const textRef = useRef<Konva.Text>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (textRef.current) {
            setWidth(textRef.current.width());
        }
    }, [text]);

    return (
        <Group x={x} y={y}>
            <Rect
                width={width + PADDING_X * 2}
                height={FONT_SIZE + PADDING_Y * 2}
                fill={theme === 'dark' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)'}
                cornerRadius={4}
                listening={false}
            />
            <Text
                ref={textRef}
                text={text}
                fontSize={FONT_SIZE}
                fill={theme === 'dark' ? '#E2E8F0' : '#1F2937'}
                padding={PADDING_Y}
                x={PADDING_X}
                y={0}
                fontStyle="bold"
                listening={false}
            />
        </Group>
    );
};


function calculateFontSize(width: number, height: number, name: string, dimensions: string) {
  const PADDING = 4;
  const MIN_FONT_SIZE = 8;
  const MAX_FONT_SIZE = 20;
  const FONT_ASPECT_RATIO = 0.6; // Approximate width-to-height ratio for a character
  const LINE_HEIGHT_RATIO = 1.2;

  const availableWidth = width - PADDING * 2;
  const availableHeight = height - PADDING * 2;

  if (availableWidth <= 0 || availableHeight <= 0) return MIN_FONT_SIZE;

  // Calculate max font size based on width for each line
  const maxFontSizeForName = availableWidth / (name.length * FONT_ASPECT_RATIO);
  const maxFontSizeForDims = availableWidth / (dimensions.length * FONT_ASPECT_RATIO);
  const maxFontSizeByWidth = Math.min(maxFontSizeForName, maxFontSizeForDims);
  
  // Calculate max font size based on height for two lines
  const maxFontSizeByHeight = availableHeight / (2 * LINE_HEIGHT_RATIO);

  // The final font size is the minimum of the two constraints
  const optimalSize = Math.min(maxFontSizeByWidth, maxFontSizeByHeight);

  // Clamp the font size to a reasonable range
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, optimalSize));
}


const PieceComponent = React.memo(({ piece, originalPiece, allPieces, board, onPieceMove, color, borderColor, theme, kerf, onSelect, isSelected, isSelectedGroup }: { 
    piece: PlacedPiece;
    originalPiece: Piece;
    allPieces: PlacedPiece[];
    board: Board;
    onPieceMove: (id: string, newPos: { x: number, y: number }) => void;
    color: string;
    borderColor: string;
    theme: 'light' | 'dark';
    kerf: number;
    onSelect: () => void;
    isSelected: boolean;
    isSelectedGroup: boolean;
}) => {
    const shapeRef = useRef<Konva.Group>(null);
    const rectRef = useRef<Konva.Rect>(null);
    const [isColliding, setIsColliding] = useState(false);

    useEffect(() => {
        const node = rectRef.current;
        if (!node) return;

        if (isSelectedGroup) {
             const layer = node.getLayer();
             if (layer) { // Safety check
                const anim = new Konva.Animation(frame => {
                    if (!frame) return;
                    const period = 2000;
                    const amplitude = 6;
                    const blur = 8 + amplitude * Math.sin((frame.time * 2 * Math.PI) / period);
                    node.shadowBlur(blur);
                }, layer);
                anim.start();
                return () => anim.stop();
            }
        } else {
            node.shadowBlur(0);
        }
    }, [isSelectedGroup]);

    const handleMouseEnter = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'pointer';
    };
    const handleMouseLeave = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
    };

    const handleDragMove = () => {
        const node = shapeRef.current;
        if (!node) return;

        const currentPos = node.getAbsolutePosition();
        let collision = false;
        
        const thisPieceRect = {
            id: piece.id,
            x: currentPos.x,
            y: currentPos.y,
            width: piece.width,
            height: piece.height
        };
        
        for (const other of allPieces) {
            if (other.id === piece.id) continue;
            const otherPieceRect = {
                id: other.id,
                x: other.x,
                y: other.y,
                width: other.width,
                height: other.height,
            };
            if (haveIntersectionWithKerf(thisPieceRect, otherPieceRect, kerf)) {
                collision = true;
                break;
            }
        }
        setIsColliding(collision);
    };

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        setIsColliding(false);
        const newX = Math.round(e.target.x() / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
        const newY = Math.round(e.target.y() / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
        e.target.position({ x: newX, y: newY });
        onPieceMove(piece.id, { x: newX, y: newY });
    };

    const { edgeTop, edgeBottom, edgeLeft, edgeRight } = originalPiece;
    const rotated = piece.rotated;
    
    // Adjust edges based on rotation
    const finalEdges = {
        top: rotated ? edgeLeft : edgeTop,
        bottom: rotated ? edgeRight : edgeBottom,
        left: rotated ? edgeBottom : edgeLeft,
        right: rotated ? edgeTop : edgeRight,
    };

    const EDGE_THICKNESS = Math.min(4, piece.width / 10, piece.height / 10);
    const edgeColor = theme === 'dark' ? '#94A3B8' : '#4B5563';

    const SELECTED_EDGE_HIGHLIGHT_STROKE = 5;
    const SELECTED_EDGE_HIGHLIGHT_OFFSET = SELECTED_EDGE_HIGHLIGHT_STROKE / 2;
    const selectedEdgeColor = theme === 'dark' ? '#FBBF24' : '#F97316';
    
    const dimensionsText = `${piece.width}x${piece.height}`;
    const referenceText = originalPiece.reference ? `[${originalPiece.reference}]` : '';
    const nameText = `${piece.name}${referenceText ? ' ' + referenceText : ''}`;
    const fontSize = calculateFontSize(piece.width, piece.height, nameText, dimensionsText);

    return (
        <Group
            ref={shapeRef}
            x={piece.x}
            y={piece.y}
            draggable
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            dragBoundFunc={(pos) => {
                const newX = Math.max(0, Math.min(pos.x, board.width - piece.width));
                const newY = Math.max(0, Math.min(pos.y, board.height - piece.height));
                return { x: newX, y: newY };
            }}
            onClick={onSelect}
            onTap={onSelect}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <Rect
                ref={rectRef}
                width={piece.width}
                height={piece.height}
                fill={isColliding ? '#EF4444' : color}
                stroke={isSelectedGroup ? (theme === 'dark' ? '#60A5FA' : '#2563EB') : borderColor}
                strokeWidth={isSelectedGroup ? 2.5 : 1}
                opacity={isColliding ? 0.7 : 0.9}
                cornerRadius={4}
                shadowForStrokeEnabled={isSelectedGroup}
                shadowColor={isSelectedGroup ? (theme === 'dark' ? '#3B82F6' : '#2563EB') : undefined}
                shadowBlur={isSelectedGroup ? 8 : 0}
                shadowOpacity={isSelectedGroup ? 0.6 : 0}
            />
            
            {/* Edge Banding Visuals */}
            {finalEdges.top && <Rect x={0} y={0} width={piece.width} height={EDGE_THICKNESS} fill={edgeColor} listening={false} cornerRadius={[4,4,0,0]}/>}
            {finalEdges.bottom && <Rect x={0} y={piece.height - EDGE_THICKNESS} width={piece.width} height={EDGE_THICKNESS} fill={edgeColor} listening={false} cornerRadius={[0,0,4,4]}/>}
            {finalEdges.left && <Rect x={0} y={0} width={EDGE_THICKNESS} height={piece.height} fill={edgeColor} listening={false} cornerRadius={[4,0,0,4]}/>}
            {finalEdges.right && <Rect x={piece.width - EDGE_THICKNESS} y={0} width={EDGE_THICKNESS} height={piece.height} fill={edgeColor} listening={false} cornerRadius={[0,4,4,0]}/>}
            
            {/* Selected Edge Banding Highlight Visuals */}
            {isSelected && (
                 <>
                    {finalEdges.top && <Line points={[SELECTED_EDGE_HIGHLIGHT_OFFSET, SELECTED_EDGE_HIGHLIGHT_OFFSET, piece.width - SELECTED_EDGE_HIGHLIGHT_OFFSET, SELECTED_EDGE_HIGHLIGHT_OFFSET]} stroke={selectedEdgeColor} strokeWidth={SELECTED_EDGE_HIGHLIGHT_STROKE} listening={false} opacity={0.85} lineCap="round" />}
                    {finalEdges.bottom && <Line points={[SELECTED_EDGE_HIGHLIGHT_OFFSET, piece.height - SELECTED_EDGE_HIGHLIGHT_OFFSET, piece.width - SELECTED_EDGE_HIGHLIGHT_OFFSET, piece.height - SELECTED_EDGE_HIGHLIGHT_OFFSET]} stroke={selectedEdgeColor} strokeWidth={SELECTED_EDGE_HIGHLIGHT_STROKE} listening={false} opacity={0.85} lineCap="round" />}
                    {finalEdges.left && <Line points={[SELECTED_EDGE_HIGHLIGHT_OFFSET, SELECTED_EDGE_HIGHLIGHT_OFFSET, SELECTED_EDGE_HIGHLIGHT_OFFSET, piece.height - SELECTED_EDGE_HIGHLIGHT_OFFSET]} stroke={selectedEdgeColor} strokeWidth={SELECTED_EDGE_HIGHLIGHT_STROKE} listening={false} opacity={0.85} lineCap="round" />}
                    {finalEdges.right && <Line points={[piece.width - SELECTED_EDGE_HIGHLIGHT_OFFSET, SELECTED_EDGE_HIGHLIGHT_OFFSET, piece.width - SELECTED_EDGE_HIGHLIGHT_OFFSET, piece.height - SELECTED_EDGE_HIGHLIGHT_OFFSET]} stroke={selectedEdgeColor} strokeWidth={SELECTED_EDGE_HIGHLIGHT_STROKE} listening={false} opacity={0.85} lineCap="round" />}
                </>
            )}

            <Text
                text={`${nameText}\n${dimensionsText}`}
                fontSize={fontSize}
                fontStyle="bold"
                fill={theme === 'dark' ? '#E2E8F0' : '#1F2937'}
                width={piece.width}
                height={piece.height}
                align="center"
                verticalAlign="middle"
                padding={2}
                listening={false} // Make text non-interactive
            />

            {isSelectedGroup && originalPiece.grainContinuityGroup && (
                <GrainGroupLabel
                    text={`Grupo Veta: ${originalPiece.grainContinuityGroup}`}
                    x={0}
                    y={piece.height + 4}
                    theme={theme}
                />
            )}
        </Group>
    );
});


export const LayoutDisplay: React.FC<{
  board: Board;
  layout: Layout;
  pieces: Piece[];
  onLayoutChange: (newLayout: Layout) => void;
  theme: 'light' | 'dark';
  kerf: number;
  machine: 'seccionadora' | 'cnc';
  isActive: boolean;
}> = ({ board, layout, pieces, onLayoutChange, theme, kerf, machine, isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<'canvas' | 'list'>('canvas');
  const [stage, setStage] = useState({ scale: 1, x: 0, y: 0 });
  const [selectedGrainGroup, setSelectedGrainGroup] = useState<string | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);

  const resetZoomAndPosition = useCallback(() => {
      if (containerRef.current && board.width > 0 && containerRef.current.offsetWidth > 0) {
          const containerWidth = containerRef.current.offsetWidth;
          // Use a fixed max height relative to window to ensure visibility
          const maxHeight = Math.min(window.innerHeight * 0.7, containerWidth * 1.5); 
          
          // Calculate scale ratios for both dimensions
          const scaleX = containerWidth / board.width;
          const scaleY = maxHeight / board.height;

          // Use the smaller scale to ensure the WHOLE board fits
          const newScale = Math.min(scaleX, scaleY) * 0.95; // 0.95 for small padding
          
          const displayedWidth = board.width * newScale;
          const displayedHeight = board.height * newScale;

          // Center the stage
          const x = (containerWidth - displayedWidth) / 2;
          const y = (maxHeight - displayedHeight) / 2;

          setSize({ width: containerWidth, height: maxHeight });
          setStage({ scale: newScale, x: x > 0 ? x : 0, y: y > 0 ? y : 0 });
      }
  }, [board.width, board.height]);

  useEffect(() => {
      if (isActive) {
          // Use a small timeout to allow the browser to render the container with its new display style
          const timer = setTimeout(() => {
              resetZoomAndPosition();
          }, 0);
          
          window.addEventListener('resize', resetZoomAndPosition);
          return () => {
              clearTimeout(timer);
              window.removeEventListener('resize', resetZoomAndPosition);
          };
      }
  }, [isActive, resetZoomAndPosition]);


  const colorMap = useMemo(() => {
    const map = new Map<string, { color: string, borderColor: string }>();
    let colorIndex = 0;
    layout.placedPieces.forEach(p => {
      if (!map.has(p.originalPieceId)) {
        map.set(p.originalPieceId, {
          color: pieceColors[colorIndex % pieceColors.length],
          borderColor: pieceBorderColors[colorIndex % pieceBorderColors.length]
        });
        colorIndex++;
      }
    });
    return map;
  }, [layout.placedPieces]);

  const handlePieceMove = (id: string, newPos: { x: number, y: number }) => {
    const newPlacedPieces = layout.placedPieces.map(p =>
        p.id === id ? { ...p, x: newPos.x, y: newPos.y } : p
    );
    onLayoutChange({ ...layout, placedPieces: newPlacedPieces });
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stageNode = stageRef.current;
    if (!stageNode) return;

    const oldScale = stageNode.scaleX();
    const pointer = stageNode.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
        x: (pointer.x - stageNode.x()) / oldScale,
        y: (pointer.y - stageNode.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    setStage({
        scale: newScale,
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
    });
  };
  
  const handleDragEndStage = (e: Konva.KonvaEventObject<DragEvent>) => {
    setStage({
        ...stage,
        x: e.target.x(),
        y: e.target.y(),
    });
  };

  const zoomOnCenter = (factor: number) => {
    const stageNode = stageRef.current;
    if (!stageNode) return;

    const oldScale = stageNode.scaleX();
    const newScale = Math.max(0.1, oldScale * factor);

    const center = { x: size.width / 2, y: size.height / 2 };

    const mousePointTo = {
        x: (center.x - stageNode.x()) / oldScale,
        y: (center.y - stageNode.y()) / oldScale,
    };
    
    setStage({
        scale: newScale,
        x: center.x - mousePointTo.x * newScale,
        y: center.y - mousePointTo.y * newScale,
    });
};
  
  return (
    <div className="w-full p-4 bg-white dark:bg-dark-base-200 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div>
            <h3 className="font-bold text-lg dark:text-dark-content-100">Tablero {layout.boardIndex + 1}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium mt-1">
                {layout.numberOfCutsForLayout && layout.numberOfCutsForLayout > 0 && (
                     <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <SawBladeIcon className="w-4 h-4" />
                        {layout.numberOfCutsForLayout} Cortes
                    </span>
                )}
                {machine === 'cnc' && layout.estimatedCncTimeMinutes && layout.estimatedCncTimeMinutes > 0 && (
                    <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                        <ClockIcon className="w-4 h-4" />
                        ~{layout.estimatedCncTimeMinutes.toFixed(1)} min
                    </span>
                )}
                <span className="text-red-600 dark:text-red-400">Desperdicio: {layout.boardWastePercentage.toFixed(2)}%</span>
            </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-base-100 dark:bg-dark-base-300 rounded-lg">
           <button onClick={() => setViewMode('canvas')} className={`px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'canvas' ? 'bg-white dark:bg-dark-base-200 shadow' : 'text-content-200 dark:text-dark-content-200'}`}>
             <CubeIcon className="w-4 h-4" /> Vista Gráfica
           </button>
           <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white dark:bg-dark-base-200 shadow' : 'text-content-200 dark:text-dark-content-200'}`}>
             <TableIcon className="w-4 h-4" /> Lista de Piezas
           </button>
        </div>
      </div>
      
      {viewMode === 'canvas' && (
          <div ref={containerRef} className="relative w-full bg-base-200 dark:bg-dark-base-100 rounded-md overflow-hidden border border-base-300 dark:border-dark-base-300">
             {size.width > 0 && size.height > 0 ? (
                <>
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 p-1 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg shadow-md">
                    <button onClick={() => zoomOnCenter(1.2)} title="Acercar" className="p-2 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                        <ZoomInIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => zoomOnCenter(1 / 1.2)} title="Alejar" className="p-2 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                        <ZoomOutIcon className="w-5 h-5" />
                    </button>
                    <button onClick={resetZoomAndPosition} title="Restablecer vista" className="p-2 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                        <ExpandIcon className="w-5 h-5" />
                    </button>
                </div>
                <Stage 
                    ref={stageRef}
                    width={size.width} 
                    height={size.height}
                    draggable
                    onWheel={handleWheel}
                    onDragEnd={handleDragEndStage}
                    scaleX={stage.scale}
                    scaleY={stage.scale}
                    x={stage.x}
                    y={stage.y}
                >
                    <Layer>
                        {/* Board Background */}
                        <Rect 
                            width={board.width} 
                            height={board.height} 
                            fill={theme === 'dark' ? '#1E293B' : '#F3F4F6'}
                            shadowColor="black"
                            shadowBlur={10}
                            shadowOpacity={0.1}
                            onClick={() => {
                                setSelectedGrainGroup(null);
                                setSelectedPieceId(null);
                            }}
                            onTap={() => {
                                setSelectedGrainGroup(null);
                                setSelectedPieceId(null);
                            }}
                        />
                        {/* Placed Pieces */}
                        {layout.placedPieces.map((piece) => {
                            const colors = colorMap.get(piece.originalPieceId) || { color: '#E5E7EB', borderColor: '#9CA3AF' };
                            const originalPiece = pieces.find(p => p.id === piece.originalPieceId);
                            if (!originalPiece) {
                                console.warn("Could not find original piece for", piece);
                                return null;
                            }
                            
                            const grainGroup = originalPiece.grainContinuityGroup;
                            const hasGrainGroup = !!grainGroup && grainGroup.trim() !== '';
                            const isSelectedGroup = hasGrainGroup && grainGroup === selectedGrainGroup;
                            const isSelected = piece.id === selectedPieceId;

                            return (
                                <PieceComponent 
                                    key={piece.id} 
                                    piece={piece}
                                    originalPiece={originalPiece}
                                    allPieces={layout.placedPieces}
                                    board={board}
                                    onPieceMove={handlePieceMove}
                                    color={colors.color}
                                    borderColor={colors.borderColor}
                                    theme={theme}
                                    kerf={kerf}
                                    onSelect={() => {
                                        setSelectedPieceId(current => (current === piece.id ? null : piece.id));
                                        if (hasGrainGroup) {
                                            setSelectedGrainGroup(current => (current === grainGroup ? null : grainGroup));
                                        } else {
                                            setSelectedGrainGroup(null);
                                        }
                                    }}
                                    isSelected={isSelected}
                                    isSelectedGroup={isSelectedGroup}
                                />
                            );
                        })}
                    </Layer>
                </Stage>
                </>
             ) : (
                <div style={{ width: '100%', height: '500px' }} />
             )}
          </div>
      )}

      {viewMode === 'list' && (
        <div className="overflow-x-auto max-h-[500px] border dark:border-dark-base-300 rounded-md">
            <table className="w-full text-sm text-left">
                <thead className="bg-base-200 dark:bg-dark-base-300 sticky top-0 z-10">
                    <tr>
                        <th className="p-3 font-semibold">Nombre</th>
                        <th className="p-3 font-semibold">Referencia</th>
                        <th className="p-3 font-semibold">Largo Colocado (mm)</th>
                        <th className="p-3 font-semibold">Ancho Colocado (mm)</th>
                        <th className="p-3 font-semibold">Canteado</th>
                        <th className="p-3 font-semibold">Posición X</th>
                        <th className="p-3 font-semibold">Posición Y</th>
                        <th className="p-3 font-semibold">Rotada</th>
                    </tr>
                </thead>
                <tbody>
                    {layout.placedPieces.map((p) => {
                       const originalPiece = pieces.find(op => op.id === p.originalPieceId);
                       const edges = [];
                       if(originalPiece?.edgeTop) edges.push('S');
                       if(originalPiece?.edgeBottom) edges.push('I');
                       if(originalPiece?.edgeLeft) edges.push('Izq');
                       if(originalPiece?.edgeRight) edges.push('Der');
                    
                        return(
                        <tr key={p.id} className="border-b dark:border-dark-base-300 last:border-b-0 hover:bg-base-100 dark:hover:bg-dark-base-100">
                            <td className="p-3 font-medium">{p.name}</td>
                            <td className="p-3 text-content-200 dark:text-dark-content-200">{originalPiece?.reference || '-'}</td>
                            <td className="p-3">{p.width}</td>
                            <td className="p-3">{p.height}</td>
                            <td className="p-3">{edges.join(', ')}</td>
                            <td className="p-3">{p.x}</td>
                            <td className="p-3">{p.y}</td>
                            <td className="p-3">{p.rotated ? 'Sí' : 'No'}</td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      )}
    </div>
  );
};
