
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

import { getOptimalLayout } from './services/geminiService';
import { analyzePieces } from './services/validationService';
import type { Piece, Board, OptimizationResult, Layout } from './types';
import { PlusIcon, TrashIcon, GrainIcon, WandIcon, DownloadIcon, RefreshIcon, CubeIcon, AlertTriangleIcon, FilePlusIcon, SaveIcon, PrinterIcon, TableIcon, SunIcon, MoonIcon, CheckIcon, PencilIcon, SawBladeIcon, RulerIcon, ClockIcon, SparklesIcon, XIcon, UploadIcon, CalculatorIcon, FolderOpenIcon, TagIcon } from './components/icons';
import { LayoutDisplay } from './components/LayoutDisplay';

const initialPieces: Piece[] = [
    { id: 'p1', name: 'Puerta', width: 800, height: 400, quantity: 4, hasGrain: true, grainContinuityGroup: 'g-1', edgeTop: true, edgeBottom: true, edgeLeft: true, edgeRight: true },
    { id: 'p2', name: 'Costado', width: 600, height: 300, quantity: 8, hasGrain: false, grainContinuityGroup: '', edgeTop: true, edgeBottom: false, edgeLeft: false, edgeRight: false },
    { id: 'p3', name: 'Balda', width: 500, height: 200, quantity: 10, hasGrain: true, grainContinuityGroup: 'g-2', edgeTop: true, edgeBottom: false, edgeLeft: false, edgeRight: false },
    { id: 'p4', name: 'Frente', width: 700, height: 150, quantity: 6, hasGrain: true, grainContinuityGroup: '', edgeTop: true, edgeBottom: true, edgeLeft: true, edgeRight: true },
];

const standardBoards: Board[] = [
    { name: 'Estándar Melamina (2440x1220)', width: 2440, height: 1220 },
    { name: 'Estándar Contrachapado (2440x1220)', width: 2440, height: 1220 },
    { name: 'Hoja Completa (2800x2100)', width: 2800, height: 2100 },
    { name: 'Media Hoja (1220x1220)', width: 1220, height: 1220 },
];

const initialBoard: Board = standardBoards[0];
const pieceNameOptions = ['Puerta', 'Costado', 'Costado Visto', 'Frente de Cajon', 'Balda', 'Techo', 'Suelo', 'Centro', 'Otro...'];

const newPieceInitialState = { 
    name: pieceNameOptions[0],
    customName: '',
    width: '', 
    height: '', 
    quantity: '1', 
    hasGrain: false, 
    grainContinuityGroup: '',
    edgeTop: false,
    edgeBottom: false,
    edgeLeft: false,
    edgeRight: false,
};


type Theme = 'light' | 'dark';
type Machine = 'seccionadora' | 'cnc';

interface SavedProject {
    id: string;
    name: string;
    createdAt: number;
    data: {
        board: Board;
        pieces: Piece[];
        kerf: number;
        machine: Machine;
        forceGuillotineCuts: boolean;
        cncSpeed: number;
        costs: {
            boardPrice: number;
            edgePricePerMeter: number;
            cncHourlyRate: number;
        };
        customBoards: Board[];
    }
}

const PricingModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const plans = [
        {
            name: "Hobby",
            price: "Gratis",
            description: "Perfecto para entusiastas y proyectos personales pequeños.",
            features: [
                "Hasta 15 piezas por proyecto",
                "5 optimizaciones al día",
                "Optimización estándar",
                "Soporte por comunidad",
            ],
            cta: "Empezar Gratis",
            popular: false,
        },
        {
            name: "Profesional",
            price: "$19/mes",
            description: "Para profesionales y talleres que buscan la máxima eficiencia.",
            features: [
                "Piezas y proyectos ilimitados",
                "Optimizaciones ilimitadas",
                "Algoritmo de optimización avanzado",
                "Continuidad de veta y CNC",
                "Exportación a PDF y reportes",
                "Soporte prioritario por email",
            ],
            cta: "Actualizar a Pro",
            popular: true,
        },
        {
            name: "Empresarial",
            price: "Contacto",
            description: "Soluciones a medida para operaciones a gran escala.",
            features: [
                "Todas las funciones de Pro",
                "Gestión de equipos y usuarios",
                "Soporte dedicado 24/7",
                "Integraciones y acceso API",
                "Marca personalizada en reportes",
            ],
            cta: "Contactar Ventas",
            popular: false,
        },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
            <div className="bg-base-100 dark:bg-dark-base-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8 relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-content-200 dark:text-dark-content-200 hover:bg-base-200 dark:hover:bg-dark-base-300 transition-colors">
                    <XIcon />
                </button>
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold">Elige el Plan Perfecto Para Ti</h2>
                    <p className="mt-2 text-content-200 dark:text-dark-content-200">Desbloquea todo el potencial para llevar tus proyectos al siguiente nivel.</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {plans.map((plan) => (
                        <div key={plan.name} className={`relative p-6 rounded-lg shadow-md flex flex-col ${plan.popular ? 'border-2 border-brand-primary' : 'border border-base-300 dark:border-dark-base-300'}`}>
                            {plan.popular && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                                    MÁS POPULAR
                                </div>
                            )}
                            <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                            <p className="text-3xl font-bold mb-4">{plan.price}</p>
                            <p className="text-sm text-content-200 dark:text-dark-content-200 mb-6 flex-grow">{plan.description}</p>
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-3 text-sm">
                                        <CheckIcon className="w-5 h-5 text-brand-secondary flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <button className={`w-full mt-auto p-3 rounded-lg font-semibold transition-colors ${plan.popular ? 'bg-brand-primary text-white hover:opacity-90' : 'bg-base-200 dark:bg-dark-base-300 hover:bg-base-300 dark:hover:bg-dark-base-100'}`}>
                                {plan.cta}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ProjectLibraryModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void;
    projects: SavedProject[];
    onLoad: (project: SavedProject) => void;
    onDelete: (id: string) => void;
}> = ({ isOpen, onClose, projects, onLoad, onDelete }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
            <div className="bg-base-100 dark:bg-dark-base-200 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-base-300 dark:border-dark-base-300 flex justify-between items-center">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FolderOpenIcon className="w-6 h-6 text-brand-primary"/> Mis Proyectos
                    </h3>
                    <button onClick={onClose}><XIcon /></button>
                </div>
                <div className="p-4 overflow-y-auto flex-grow">
                    {projects.length === 0 ? (
                        <div className="text-center py-10 text-content-200 dark:text-dark-content-200">
                            <p>No tienes proyectos guardados.</p>
                            <p className="text-sm mt-2">Utiliza "Guardar como..." para añadir proyectos aquí.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {projects.sort((a, b) => b.createdAt - a.createdAt).map(p => (
                                <div key={p.id} className="bg-base-200 dark:bg-dark-base-300 p-3 rounded-lg flex justify-between items-center hover:bg-base-300 dark:hover:bg-dark-base-100 transition-colors">
                                    <div>
                                        <h4 className="font-bold text-lg">{p.name}</h4>
                                        <p className="text-xs text-content-200 dark:text-dark-content-200">
                                            {new Date(p.createdAt).toLocaleDateString()} • {p.data.pieces.length} Piezas • {p.data.board.name}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => onLoad(p)} className="bg-brand-primary text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90">
                                            Cargar
                                        </button>
                                        <button onClick={() => onDelete(p.id)} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 p-1.5 rounded">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [kerf, setKerf] = useState<number>(3);
  const [machine, setMachine] = useState<Machine>('seccionadora');
  const [forceGuillotineCuts, setForceGuillotineCuts] = useState(true);
  const [cncSpeed, setCncSpeed] = useState<number>(5000);
  const [pieces, setPieces] = useState<Piece[]>(initialPieces);
  const [newPiece, setNewPiece] = useState(newPieceInitialState);
  const [editingPieceId, setEditingPieceId] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [editedResult, setEditedResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeLayoutTab, setActiveLayoutTab] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [theme, setTheme] = useState<Theme>('light');
  const [customBoards, setCustomBoards] = useState<Board[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customBoardData, setCustomBoardData] = useState({ name: '', width: '', height: '' });
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  
  // Project Library State
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isProjectLibraryOpen, setIsProjectLibraryOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Costs state
  const [costs, setCosts] = useState({
    boardPrice: 0,
    edgePricePerMeter: 0,
    cncHourlyRate: 0
  });
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) setTheme(savedTheme);
    else if (prefersDark) setTheme('dark');
  }, []);
  
  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');

  // Load project on mount
  useEffect(() => {
    try {
      const savedProject = localStorage.getItem('deskspace_project');
      if (savedProject) {
        const { board: savedBoard, pieces: savedPieces, kerf: savedKerf, machine: savedMachine, forceGuillotineCuts: savedForceGuillotine, cncSpeed: savedCncSpeed, costs: savedCosts } = JSON.parse(savedProject);
        if (savedBoard) setBoard(savedBoard);
        if (savedPieces) {
             const loadedPieces = savedPieces.map((p: any) => ({
                ...p,
                edgeTop: p.edgeTop || false,
                edgeBottom: p.edgeBottom || false,
                edgeLeft: p.edgeLeft || false,
                edgeRight: p.edgeRight || false,
            }));
            setPieces(loadedPieces);
        }
        if (savedKerf) setKerf(savedKerf);
        if (savedMachine) setMachine(savedMachine);
        if (savedForceGuillotine !== undefined) setForceGuillotineCuts(savedForceGuillotine);
        if (savedCncSpeed) setCncSpeed(savedCncSpeed);
        if (savedCosts) setCosts(savedCosts);
        
        setIsProjectLoaded(true);
        setTimeout(() => setIsProjectLoaded(false), 3000);
      }
      const savedCustomBoards = localStorage.getItem('deskspace_custom_boards');
      if (savedCustomBoards) {
        setCustomBoards(JSON.parse(savedCustomBoards));
      }
      const library = localStorage.getItem('deskspace_saved_projects');
      if (library) {
          setSavedProjects(JSON.parse(library));
      }
    } catch (e) {
      console.error("Failed to load project from localStorage", e);
      localStorage.removeItem('deskspace_project');
      localStorage.removeItem('deskspace_custom_boards');
    }
  }, []);

  // Auto-save project when changes occur
  useEffect(() => {
      const timeoutId = setTimeout(() => {
          try {
              const projectData = { board, pieces, kerf, machine, forceGuillotineCuts, cncSpeed, costs };
              localStorage.setItem('deskspace_project', JSON.stringify(projectData));
          } catch (e) {
              console.error("Failed to auto-save project", e);
          }
      }, 1000); // Debounce save by 1s

      return () => clearTimeout(timeoutId);
  }, [board, pieces, kerf, machine, forceGuillotineCuts, cncSpeed, costs]);

  const totalEdgeBandingMeters = useMemo(() => {
    if (!pieces || pieces.length === 0) {
        return 0;
    }

    const totalLengthMm = pieces.reduce((total, piece) => {
        let pieceLength = 0;
        if (piece.edgeTop) pieceLength += piece.width;
        if (piece.edgeBottom) pieceLength += piece.width;
        if (piece.edgeLeft) pieceLength += piece.height;
        if (piece.edgeRight) pieceLength += piece.height;
        return total + (pieceLength * piece.quantity);
    }, 0);

    return totalLengthMm / 1000;
  }, [pieces]);

  // Costs Calculation
  const estimatedTotalCost = useMemo(() => {
      if (!editedResult) return 0;
      
      const materialCost = editedResult.totalBoards * costs.boardPrice;
      const edgeCost = totalEdgeBandingMeters * costs.edgePricePerMeter;
      
      let machiningCost = 0;
      if (machine === 'cnc' && editedResult.layouts) {
          const totalMinutes = editedResult.layouts.reduce((acc, l) => acc + (l.estimatedCncTimeMinutes || 0), 0);
          machiningCost = (totalMinutes / 60) * costs.cncHourlyRate;
      } else if (machine === 'seccionadora') {
          // Rough estimate for saw: e.g. 30 seconds per cut (very approximate)
          const estimatedHours = (editedResult.totalNumberOfCuts || 0) * 0.5 / 60; 
           machiningCost = estimatedHours * costs.cncHourlyRate; // Reuse rate field for general machine rate
      }

      return materialCost + edgeCost + machiningCost;
  }, [editedResult, totalEdgeBandingMeters, costs, machine]);


  const existingGrainGroups = useMemo(() => {
    const groups = new Set(pieces.map(p => p.grainContinuityGroup).filter(Boolean));
    return Array.from(groups) as string[];
  }, [pieces]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setNewPiece(prev => {
        const newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
        
        // If 'hasGrain' is unchecked, clear the grain group as it's no longer relevant
        if (name === 'hasGrain' && !checked) {
            newState.grainContinuityGroup = '';
        }
        
        return newState;
    });
  };


  const handleAddPiece = () => {
    const finalName = newPiece.name === 'Otro...' ? newPiece.customName : newPiece.name;
    const { width, height, quantity } = newPiece;
    const numWidth = parseInt(width, 10);
    const numHeight = parseInt(height, 10);
    const numQuantity = parseInt(quantity, 10);

    if (finalName && numWidth > 0 && numHeight > 0 && numQuantity > 0) {
      const pieceData = {
          ...newPiece,
          name: finalName,
          width: numWidth,
          height: numHeight,
          quantity: numQuantity
      };
      delete (pieceData as any).customName;


      if (editingPieceId) {
        setPieces(pieces.map(p => p.id === editingPieceId ? { ...p, ...pieceData } : p));
        setEditingPieceId(null);
      } else {
        const pieceToAdd: Piece = {
          ...pieceData,
          id: `p-${Date.now()}`,
        };
        setPieces([...pieces, pieceToAdd]);
      }
      setNewPiece(newPieceInitialState);
    }
  };

  const handleEditPiece = (piece: Piece) => {
    setEditingPieceId(piece.id);
    const isStandardName = pieceNameOptions.includes(piece.name);
    setNewPiece({
        name: isStandardName ? piece.name : 'Otro...',
        customName: isStandardName ? '' : piece.name,
        width: String(piece.width),
        height: String(piece.height),
        quantity: String(piece.quantity),
        hasGrain: piece.hasGrain,
        grainContinuityGroup: piece.grainContinuityGroup || '',
        edgeTop: piece.edgeTop,
        edgeBottom: piece.edgeBottom,
        edgeLeft: piece.edgeLeft,
        edgeRight: piece.edgeRight,
    });
  };

  const handleDeletePiece = (id: string) => setPieces(pieces.filter(p => p.id !== id));

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const csvContent = event.target?.result as string;
              const lines = csvContent.split(/\r\n|\n/).filter(line => line.trim() !== '');
              // Assume CSV format: Name, Width, Height, Quantity, HasGrain (Optional)
              
              const newPieces: Piece[] = [];
              
              // Skip header if it looks like text
              let startIdx = 0;
              if (lines.length > 0 && isNaN(parseInt(lines[0].split(',')[1]))) {
                  startIdx = 1;
              }

              for (let i = startIdx; i < lines.length; i++) {
                  const cols = lines[i].split(',');
                  if (cols.length >= 3) {
                      const name = cols[0].trim() || 'Pieza CSV';
                      const width = parseInt(cols[1]);
                      const height = parseInt(cols[2]);
                      const quantity = cols[3] ? parseInt(cols[3]) : 1;
                      const hasGrain = cols[4] ? cols[4].toLowerCase().includes('s') || cols[4].toLowerCase().includes('y') || cols[4] === '1' : false;

                      if (!isNaN(width) && !isNaN(height) && !isNaN(quantity)) {
                          newPieces.push({
                              id: `p-csv-${Date.now()}-${i}`,
                              name,
                              width,
                              height,
                              quantity,
                              hasGrain,
                              edgeTop: false,
                              edgeBottom: false,
                              edgeLeft: false,
                              edgeRight: false,
                              grainContinuityGroup: ''
                          });
                      }
                  }
              }

              if (newPieces.length > 0) {
                  setPieces(prev => [...prev, ...newPieces]);
                  setSaveMessage(`Importadas ${newPieces.length} piezas.`);
                  setTimeout(() => setSaveMessage(''), 3000);
              } else {
                  setError("No se encontraron piezas válidas en el archivo CSV.");
                  setTimeout(() => setError(null), 3000);
              }

          } catch (err) {
              console.error("Error parsing CSV", err);
              setError("Error al leer el archivo CSV.");
          } finally {
             if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const handleOptimize = async () => {
    if (pieces.length === 0) {
      setError("Añade al menos una pieza para optimizar.");
      return;
    }
    setError(null);
    setResult(null);
    setEditedResult(null);
    setIsLoading(true);

    setWarnings(analyzePieces(pieces));

    try {
      const res = await getOptimalLayout(board, pieces, kerf, machine, forceGuillotineCuts, machine === 'cnc' ? cncSpeed : undefined);
      setResult(res);
      setEditedResult(JSON.parse(JSON.stringify(res))); // Deep copy for editing
      setActiveLayoutTab(0);
    } catch (e: any) {
      setError(e.message || "Ocurrió un error desconocido.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLayoutChange = (newLayout: Layout) => {
    if (editedResult) {
        const newLayouts = editedResult.layouts.map(l => l.boardIndex === newLayout.boardIndex ? newLayout : l);
        setEditedResult({ ...editedResult, layouts: newLayouts });
    }
  };
  
  const handleExportPDF = async () => {
    if (!editedResult) return;
    setIsExporting(true);

    const doc = new jsPDF({
        orientation: board.width > board.height ? 'l' : 'p',
        unit: 'mm',
        format: [board.width, board.height]
    });
    const margin = 10;
    
    // Title Page
    doc.setFontSize(22);
    doc.text('Plan de Corte Optimizado', doc.internal.pageSize.getWidth() / 2, margin + 10, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Proyecto generado el ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() / 2, margin + 20, { align: 'center' });

    const summaryData = [
            ['Tablero', `${board.name || 'Personalizado'} (${board.width}x${board.height}mm)`],
            ['Espesor de corte (Kerf)', `${kerf}mm`],
            ['Máquina', machine],
            ['Total de Tableros', editedResult.totalBoards.toString()],
            ['Desperdicio Estimado', `${editedResult.estimatedWastePercentage.toFixed(2)}%`],
            ['Corte Lineal Total', `${(editedResult.totalCorteMetrosLineales / 1000).toFixed(2)}m`],
            ['Número de Cortes', `${editedResult.totalNumberOfCuts || 'N/A'}`],
            ['Canto Total (Lineal)', `${totalEdgeBandingMeters.toFixed(2)}m`],
        ];

    if (estimatedTotalCost > 0) {
        summaryData.push(['Costo Total Estimado', `$${estimatedTotalCost.toFixed(2)}`]);
    }

    autoTable(doc, {
        startY: margin + 30,
        head: [['Parámetro', 'Valor']],
        body: summaryData,
        theme: 'striped'
    });

    autoTable(doc, {
        head: [['ID', 'Nombre', 'Dimensiones (LxA)', 'Cant.', 'Veta', 'Canteado']],
        body: pieces.map(p => {
             const edges = [];
             if (p.edgeTop) edges.push('S');
             if (p.edgeBottom) edges.push('I');
             if (p.edgeLeft) edges.push('Izq');
             if (p.edgeRight) edges.push('Der');
             return [p.id.slice(0, 4), p.name, `${p.width}x${p.height}`, p.quantity, p.hasGrain ? 'Sí' : 'No', edges.join(', ')]
        }),
        theme: 'grid'
    });

    const currentActiveTab = activeLayoutTab;

    for (let i = 0; i < editedResult.layouts.length; i++) {
        doc.addPage([board.width, board.height], board.width > board.height ? 'l' : 'p');
        
        setActiveLayoutTab(i);

        // Wait for React to re-render and browser to paint. This is more reliable than a fixed timeout.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 100)));

        const layoutElement = document.getElementById(`layout-display-${i}`);
        
        if (layoutElement && layoutElement.clientWidth > 0 && layoutElement.clientHeight > 0) {
            const canvas = await html2canvas(layoutElement, {
                scale: 2,
                backgroundColor: theme === 'dark' ? '#0F172A' : '#F9FAFB',
                allowTaint: true, // Fix for potential Konva canvas tainting issues
                useCORS: true, 
            });
            const imgData = canvas.toDataURL('image/png');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const imgWidth = pageWidth - margin * 2;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let finalImgHeight = imgHeight;
            let finalImgWidth = imgWidth;

            if (imgHeight > pageHeight - margin * 2) {
                finalImgHeight = pageHeight - margin * 2;
                finalImgWidth = canvas.width * finalImgHeight / canvas.height;
            }

            const x = (pageWidth - finalImgWidth) / 2;
            const y = margin + 10;
            
            doc.setFontSize(16);
            doc.text(`Layout del Tablero ${i + 1}`, margin, margin);
            doc.addImage(imgData, 'PNG', x, y, finalImgWidth, finalImgHeight);
        } else {
            console.error(`Error: Could not capture layout for board ${i + 1}. Element not found or has zero dimensions.`);
            doc.setFontSize(12);
            doc.setTextColor(255, 0, 0);
            doc.text(`Error: No se pudo renderizar la imagen para el Tablero ${i + 1}.`, margin, margin + 20);
            doc.setTextColor(0, 0, 0);
        }
    }
    
    setActiveLayoutTab(currentActiveTab);
    doc.save(`plan-de-corte-${Date.now()}.pdf`);
    setIsExporting(false);
  };

  const handleGenerateLabels = () => {
    if (!editedResult) return;
    
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const labelsPerPage = 24; // 3x8 grid approx
    const cols = 4;
    const rows = 6;
    const marginX = 10;
    const marginY = 10;
    const labelWidth = (297 - marginX * 2) / cols; // A4 Landscape Width
    const labelHeight = (210 - marginY * 2) / rows; // A4 Landscape Height

    let currentLabel = 0;
    let page = 1;
    doc.setFontSize(10);

    editedResult.layouts.forEach(layout => {
        layout.placedPieces.forEach(piece => {
            if (currentLabel >= cols * rows) {
                doc.addPage();
                currentLabel = 0;
                page++;
            }

            const originalPiece = pieces.find(p => p.id === piece.originalPieceId);
            const col = currentLabel % cols;
            const row = Math.floor(currentLabel / cols);
            const x = marginX + col * labelWidth;
            const y = marginY + row * labelHeight;

            // Draw Label Border (Optional: remove for pre-cut sticker sheets)
            doc.setDrawColor(200, 200, 200);
            doc.rect(x + 2, y + 2, labelWidth - 4, labelHeight - 4);

            // Content
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(piece.name.substring(0, 15), x + 5, y + 10);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`${piece.width} x ${piece.height} mm`, x + 5, y + 16);

            // Edge Indicators
            const edges = [];
            if (originalPiece?.edgeTop) edges.push('Sup');
            if (originalPiece?.edgeBottom) edges.push('Inf');
            if (originalPiece?.edgeLeft) edges.push('Izq');
            if (originalPiece?.edgeRight) edges.push('Der');

            if (edges.length > 0) {
                 doc.setFontSize(8);
                 doc.setTextColor(50, 50, 50);
                 doc.text(`Cantos: ${edges.join(', ')}`, x + 5, y + 22);
            }

            // Board ID
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`T${layout.boardIndex + 1} | ID: ${piece.id.substring(0, 4)}`, x + 5, y + labelHeight - 6);

            currentLabel++;
        });
    });

    doc.save(`etiquetas-${Date.now()}.pdf`);
  };

  const handleSaveAsProject = () => {
      const projectName = prompt("Nombre del proyecto:");
      if (!projectName) return;

      const newProject: SavedProject = {
          id: `proj-${Date.now()}`,
          name: projectName,
          createdAt: Date.now(),
          data: {
              board,
              pieces,
              kerf,
              machine,
              forceGuillotineCuts,
              cncSpeed,
              costs,
              customBoards
          }
      };

      const updatedProjects = [...savedProjects, newProject];
      setSavedProjects(updatedProjects);
      localStorage.setItem('deskspace_saved_projects', JSON.stringify(updatedProjects));
      setSaveMessage(`Proyecto "${projectName}" guardado.`);
      setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleLoadProject = (project: SavedProject) => {
      if (window.confirm(`¿Cargar "${project.name}"? Se perderán los cambios no guardados del proyecto actual.`)) {
          setBoard(project.data.board);
          setPieces(project.data.pieces);
          setKerf(project.data.kerf);
          setMachine(project.data.machine);
          setForceGuillotineCuts(project.data.forceGuillotineCuts);
          setCncSpeed(project.data.cncSpeed);
          setCosts(project.data.costs);
          if(project.data.customBoards) setCustomBoards(project.data.customBoards);
          
          // Reset results
          setResult(null);
          setEditedResult(null);
          setIsProjectLibraryOpen(false);
          setSaveMessage(`Proyecto "${project.name}" cargado.`);
          setTimeout(() => setSaveMessage(''), 3000);
      }
  };

  const handleDeleteProject = (id: string) => {
      if (window.confirm("¿Seguro que quieres eliminar este proyecto permanentemente?")) {
          const updated = savedProjects.filter(p => p.id !== id);
          setSavedProjects(updated);
          localStorage.setItem('deskspace_saved_projects', JSON.stringify(updated));
      }
  };
  
  // The existing manual save is really just saving the 'current' unnamed project state
  const handleManualSave = () => {
      const projectData = { board, pieces, kerf, machine, forceGuillotineCuts, cncSpeed, costs };
      localStorage.setItem('deskspace_project', JSON.stringify(projectData));
      setSaveMessage('¡Proyecto actual actualizado!');
      setTimeout(() => setSaveMessage(''), 3000);
  }

  const handleResetProject = () => {
      if (window.confirm("¿Estás seguro de que quieres reiniciar el proyecto? Se borrarán todos los datos actuales y la copia guardada.")) {
          localStorage.removeItem('deskspace_project');
          // Reset all states to defaults
          setBoard(initialBoard);
          setPieces(initialPieces);
          setKerf(3);
          setMachine('seccionadora');
          setForceGuillotineCuts(true);
          setCncSpeed(5000);
          setResult(null);
          setEditedResult(null);
          setNewPiece(newPieceInitialState);
          setEditingPieceId(null);
          setWarnings([]);
          setCosts({ boardPrice: 0, edgePricePerMeter: 0, cncHourlyRate: 0 });
      }
  };

  const handleBoardSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (selectedValue === 'add_custom') {
        setIsAddingCustom(true);
    } else {
        setIsAddingCustom(false);
        const allBoards = [...standardBoards, ...customBoards];
        const selected = allBoards.find(b => `${b.name}-${b.width}x${b.height}` === selectedValue);
        if(selected) setBoard(selected);
    }
  };

  const handleAddCustomBoard = () => {
    const { name, width, height } = customBoardData;
    const numWidth = parseInt(width, 10);
    const numHeight = parseInt(height, 10);
    if(name && numWidth > 0 && numHeight > 0) {
        const newBoard = { name, width: numWidth, height: numHeight };
        const updatedCustomBoards = [...customBoards, newBoard];
        setCustomBoards(updatedCustomBoards);
        localStorage.setItem('deskspace_custom_boards', JSON.stringify(updatedCustomBoards));
        setBoard(newBoard);
        setCustomBoardData({ name: '', width: '', height: '' });
        setIsAddingCustom(false);
    }
  };


  return (
    <div className="flex flex-col h-screen font-sans">
      <ProjectLibraryModal 
        isOpen={isProjectLibraryOpen} 
        onClose={() => setIsProjectLibraryOpen(false)} 
        projects={savedProjects}
        onLoad={handleLoadProject}
        onDelete={handleDeleteProject}
      />
      <header className="bg-base-100 dark:bg-dark-base-200 shadow-md p-3 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3">
          <CubeIcon className="w-8 h-8 text-brand-primary" />
          <h1 className="text-xl font-bold text-content-100 dark:text-dark-content-100 hidden sm:block">OPTIMIZADOR AVANZADO DESKPACE</h1>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsProjectLibraryOpen(true)} className="px-3 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-300 transition-colors flex items-center gap-2 text-sm font-semibold">
                <FolderOpenIcon className="w-5 h-5"/>
                <span className="hidden sm:inline">Mis Proyectos</span>
            </button>
            <button onClick={() => setIsPricingModalOpen(true)} className="px-3 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-300 transition-colors flex items-center gap-2 text-sm font-semibold text-brand-primary">
                <SparklesIcon className="w-5 h-5"/>
                <span className="hidden sm:inline">Mejorar Plan</span>
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-base-300 dark:hover:bg-dark-base-300 transition-colors">
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
        </div>
      </header>
      
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* Control Column */}
        <div id="control-column" className="w-full md:w-1/3 lg:w-1/4 xl:w-1/5 p-4 overflow-y-auto bg-base-100 dark:bg-dark-base-200 border-r border-base-300 dark:border-dark-base-300 print:hidden">
          {/* Project Settings */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Configuración del Proyecto</h2>
            {isProjectLoaded && (
                <div className="mb-3 p-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-md flex items-center gap-2">
                    <CheckIcon className="w-4 h-4"/> Restaurado auto-guardado
                </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tablero</label>
                <select onChange={handleBoardSelectChange} value={isAddingCustom ? 'add_custom' : `${board.name}-${board.width}x${board.height}`} className="w-full p-2 bg-base-200 dark:bg-dark-base-300 border border-base-300 dark:border-dark-base-300 rounded-md">
                    <optgroup label="Estándar">
                        {standardBoards.map(b => <option key={`${b.name}-${b.width}x${b.height}`} value={`${b.name}-${b.width}x${b.height}`}>{`${b.name} (${b.width}x${b.height})`}</option>)}
                    </optgroup>
                    {customBoards.length > 0 && <optgroup label="Personalizados">
                        {customBoards.map(b => <option key={`${b.name}-${b.width}x${b.height}`} value={`${b.name}-${b.width}x${b.height}`}>{`${b.name} (${b.width}x${b.height})`}</option>)}
                    </optgroup>}
                    <option value="add_custom">Añadir personalizado...</option>
                </select>
              </div>
              {isAddingCustom && (
                  <div className="p-3 border border-dashed rounded-md space-y-2">
                      <input type="text" placeholder="Nombre (e.g. Retal Taller)" value={customBoardData.name} onChange={e => setCustomBoardData({...customBoardData, name: e.target.value})} className="w-full p-2 bg-base-200 dark:bg-dark-base-300 border-base-300 dark:border-dark-base-300 rounded-md" />
                      <div className="flex gap-2">
                        <input type="number" placeholder="Largo (mm)" value={customBoardData.width} onChange={e => setCustomBoardData({...customBoardData, width: e.target.value})} className="w-1/2 p-2 bg-base-200 dark:bg-dark-base-300 border-base-300 dark:border-dark-base-300 rounded-md" />
                        <input type="number" placeholder="Ancho (mm)" value={customBoardData.height} onChange={e => setCustomBoardData({...customBoardData, height: e.target.value})} className="w-1/2 p-2 bg-base-200 dark:bg-dark-base-300 border-base-300 dark:border-dark-base-300 rounded-md" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleAddCustomBoard} className="w-full bg-brand-primary text-white p-2 rounded-md text-sm">Guardar Tablero</button>
                        <button onClick={() => setIsAddingCustom(false)} className="w-full bg-base-300 dark:bg-dark-base-300 p-2 rounded-md text-sm">Cancelar</button>
                      </div>
                  </div>
              )}
              <div className="flex items-center gap-4">
                  <div className="flex-1">
                      <label htmlFor="kerf" className="block text-sm font-medium mb-1">Corte (Kerf) mm</label>
                      <input id="kerf" type="number" value={kerf} onChange={e => setKerf(parseFloat(e.target.value))} className="w-full p-2 bg-base-200 dark:bg-dark-base-300 border border-base-300 dark:border-dark-base-300 rounded-md" />
                  </div>
              </div>
              <div>
                  <label className="block text-sm font-medium mb-1">Máquina</label>
                  <div className="flex gap-2">
                      <button onClick={() => setMachine('seccionadora')} className={`flex-1 p-2 rounded-md text-sm transition-colors ${machine === 'seccionadora' ? 'bg-brand-primary text-white' : 'bg-base-200 dark:bg-dark-base-300 hover:bg-base-300'}`}>Seccionadora</button>
                      <button onClick={() => setMachine('cnc')} className={`flex-1 p-2 rounded-md text-sm transition-colors ${machine === 'cnc' ? 'bg-brand-primary text-white' : 'bg-base-200 dark:bg-dark-base-300 hover:bg-base-300'}`}>CNC</button>
                  </div>
              </div>
               {machine === 'cnc' && (
                  <div>
                      <label htmlFor="cncSpeed" className="block text-sm font-medium mb-1">Velocidad CNC (mm/min)</label>
                      <input id="cncSpeed" type="number" value={cncSpeed} onChange={e => setCncSpeed(parseInt(e.target.value))} className="w-full p-2 bg-base-200 dark:bg-dark-base-300 border border-base-300 dark:border-dark-base-300 rounded-md" />
                  </div>
              )}
              {machine === 'seccionadora' && (
                   <div className="flex items-center">
                    <input type="checkbox" id="guillotine" checked={forceGuillotineCuts} onChange={(e) => setForceGuillotineCuts(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"/>
                    <label htmlFor="guillotine" className="ml-2 block text-sm">Forzar cortes de guillotina</label>
                </div>
              )}
            </div>
          </section>

          <hr className="my-6 border-base-300 dark:border-dark-base-300"/>

          <section>
              <h2 className="text-lg font-semibold mb-3">Costos (Presupuesto)</h2>
              <div className="space-y-3">
                  <div>
                      <label className="block text-xs font-medium mb-1">Precio por Tablero</label>
                      <input type="number" value={costs.boardPrice} onChange={e => setCosts({...costs, boardPrice: parseFloat(e.target.value)})} className="w-full p-2 text-sm bg-base-200 dark:bg-dark-base-300 border border-base-300 dark:border-dark-base-300 rounded-md" placeholder="0.00" />
                  </div>
                  <div>
                      <label className="block text-xs font-medium mb-1">Precio Canto / Metro</label>
                      <input type="number" value={costs.edgePricePerMeter} onChange={e => setCosts({...costs, edgePricePerMeter: parseFloat(e.target.value)})} className="w-full p-2 text-sm bg-base-200 dark:bg-dark-base-300 border border-base-300 dark:border-dark-base-300 rounded-md" placeholder="0.00" />
                  </div>
                  <div>
                      <label className="block text-xs font-medium mb-1">Costo Máquina / Hora</label>
                      <input type="number" value={costs.cncHourlyRate} onChange={e => setCosts({...costs, cncHourlyRate: parseFloat(e.target.value)})} className="w-full p-2 text-sm bg-base-200 dark:bg-dark-base-300 border border-base-300 dark:border-dark-base-300 rounded-md" placeholder="0.00" />
                  </div>
              </div>
          </section>

          <hr className="my-6 border-base-300 dark:border-dark-base-300"/>

          {/* Pieces Management */}
          <section>
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">Lista de Piezas</h2>
                <button onClick={() => fileInputRef.current?.click()} className="text-xs flex items-center gap-1 bg-base-200 dark:bg-dark-base-300 px-2 py-1 rounded hover:bg-base-300">
                    <UploadIcon className="w-3 h-3"/> Importar CSV
                </button>
                <input type="file" ref={fileInputRef} onChange={handleCSVUpload} accept=".csv" className="hidden" />
            </div>

            <div className="space-y-2 mb-4">
              {pieces.map(p => {
                const edges = [];
                if (p.edgeTop) edges.push('S');
                if (p.edgeBottom) edges.push('I');
                if (p.edgeLeft) edges.push('Izq');
                if (p.edgeRight) edges.push('Der');
                return (
                <div key={p.id} className="bg-base-200 dark:bg-dark-base-300 p-2 rounded-md flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{p.name} <span className="text-sm font-normal text-content-200 dark:text-dark-content-200">x{p.quantity}</span></p>
                    <p className="text-sm text-content-200 dark:text-dark-content-200">
                        {p.width} x {p.height} mm 
                        {p.hasGrain && <GrainIcon className="inline w-4 h-4 ml-1" />}
                        {edges.length > 0 && <span className="ml-2 text-blue-600 dark:text-blue-400 text-xs font-mono">C: {edges.join(',')}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEditPiece(p)} className="p-1.5 hover:text-brand-primary"><PencilIcon /></button>
                    <button onClick={() => handleDeletePiece(p.id)} className="p-1.5 hover:text-red-500"><TrashIcon /></button>
                  </div>
                </div>
              )})}
            </div>
            
            <div className="bg-base-200 dark:bg-dark-base-300 p-3 rounded-lg space-y-3">
              <h3 className="font-semibold text-md">{editingPieceId ? 'Editar Pieza' : 'Añadir Pieza'}</h3>
              <select name="name" value={newPiece.name} onChange={handleInputChange} className="w-full p-2 bg-base-100 dark:bg-dark-base-200 border-base-300 dark:border-dark-base-300 rounded-md">
                {pieceNameOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {newPiece.name === 'Otro...' && 
                <input type="text" name="customName" placeholder="Nombre personalizado" value={newPiece.customName} onChange={handleInputChange} className="w-full p-2 bg-base-100 dark:bg-dark-base-200 border-base-300 dark:border-dark-base-300 rounded-md" />
              }
              <div className="flex gap-2">
                <input type="number" name="width" placeholder="Largo (mm)" value={newPiece.width} onChange={handleInputChange} className="w-1/2 p-2 bg-base-100 dark:bg-dark-base-200 border-base-300 dark:border-dark-base-300 rounded-md" />
                <input type="number" name="height" placeholder="Ancho (mm)" value={newPiece.height} onChange={handleInputChange} className="w-1/2 p-2 bg-base-100 dark:bg-dark-base-200 border-base-300 dark:border-dark-base-300 rounded-md" />
              </div>
              <input type="number" name="quantity" placeholder="Cantidad" value={newPiece.quantity} onChange={handleInputChange} className="w-full p-2 bg-base-100 dark:bg-dark-base-200 border-base-300 dark:border-dark-base-300 rounded-md" />
              
              <div>
                <label className="block text-sm font-medium mb-1">Canteado</label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex items-center gap-2 p-2 bg-base-100 dark:bg-dark-base-200 rounded-md"><input type="checkbox" name="edgeTop" checked={newPiece.edgeTop} onChange={handleInputChange} className="h-4 w-4 rounded text-brand-primary"/> Superior</label>
                    <label className="flex items-center gap-2 p-2 bg-base-100 dark:bg-dark-base-200 rounded-md"><input type="checkbox" name="edgeBottom" checked={newPiece.edgeBottom} onChange={handleInputChange} className="h-4 w-4 rounded text-brand-primary"/> Inferior</label>
                    <label className="flex items-center gap-2 p-2 bg-base-100 dark:bg-dark-base-200 rounded-md"><input type="checkbox" name="edgeLeft" checked={newPiece.edgeLeft} onChange={handleInputChange} className="h-4 w-4 rounded text-brand-primary"/> Izquierdo</label>
                    <label className="flex items-center gap-2 p-2 bg-base-100 dark:bg-dark-base-200 rounded-md"><input type="checkbox" name="edgeRight" checked={newPiece.edgeRight} onChange={handleInputChange} className="h-4 w-4 rounded text-brand-primary"/> Derecho</label>
                </div>
              </div>

              <div className="flex items-center">
                <input type="checkbox" name="hasGrain" id="hasGrain" checked={newPiece.hasGrain} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"/>
                <label htmlFor="hasGrain" className="ml-2 block text-sm">Tiene Veta (No rotar)</label>
              </div>

              {newPiece.hasGrain && (
                <input 
                    list="grain-groups"
                    type="text" 
                    name="grainContinuityGroup" 
                    placeholder="Grupo veta continua (opcional)" 
                    value={newPiece.grainContinuityGroup} 
                    onChange={handleInputChange} 
                    className="w-full p-2 bg-base-100 dark:bg-dark-base-200 border-base-300 dark:border-dark-base-300 rounded-md" 
                />
              )}
              <datalist id="grain-groups">
                  {existingGrainGroups.map(group => <option key={group} value={group} />)}
              </datalist>

              <button onClick={handleAddPiece} className="w-full bg-brand-secondary text-white p-2 rounded-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                <PlusIcon className="w-5 h-5" />
                {editingPieceId ? 'Actualizar Pieza' : 'Añadir Pieza'}
              </button>
            </div>
          </section>
          
          <hr className="my-6 border-base-300 dark:border-dark-base-300"/>

          <section className="space-y-3">
              <button onClick={handleOptimize} disabled={isLoading} className="w-full bg-brand-primary text-white p-3 rounded-lg flex items-center justify-center gap-2 text-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                  <WandIcon className="w-6 h-6" />
                  Optimizar
              </button>
              <div className="grid grid-cols-2 gap-2">
                 <button onClick={handleSaveAsProject} className="bg-base-200 dark:bg-dark-base-300 p-2 rounded-md flex items-center justify-center gap-2 hover:bg-base-300 dark:hover:bg-dark-base-100 transition-colors text-xs sm:text-sm">
                    <SaveIcon/> Guardar Como...
                </button>
                <button onClick={handleManualSave} className="bg-base-200 dark:bg-dark-base-300 p-2 rounded-md flex items-center justify-center gap-2 hover:bg-base-300 dark:hover:bg-dark-base-100 transition-colors text-xs sm:text-sm">
                    <CheckIcon/> Actualizar
                </button>
              </div>
              <button onClick={handleResetProject} className="w-full bg-base-200 dark:bg-dark-base-300 p-2 rounded-md flex items-center justify-center gap-2 hover:bg-base-300 dark:hover:bg-dark-base-100 transition-colors text-red-600 dark:text-red-400 text-sm">
                 <RefreshIcon/> Reiniciar
              </button>
              {saveMessage && <div className="text-green-600 dark:text-green-400 text-sm flex items-center gap-2 justify-center animate-fade-in"><CheckIcon/>{saveMessage}</div>}
          </section>

        </div>

        {/* Results Column */}
        <main id="results-column" className="flex-grow w-full md:w-2/3 lg:w-3/4 xl:w-4/5 p-4 md:p-6 overflow-y-auto bg-base-200 dark:bg-dark-base-100">
          <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <WandIcon className="w-16 h-16 text-brand-primary animate-pulse" />
              <p className="mt-4 text-xl font-semibold">Optimizando, por favor espera...</p>
              <p className="text-content-200 dark:text-dark-content-200">El algoritmo está buscando la mejor distribución para tus piezas.</p>
            </div>
          )}
          {isExporting && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-dark-base-200 p-6 rounded-lg shadow-xl text-center">
                    <DownloadIcon className="w-12 h-12 mx-auto text-brand-primary animate-bounce" />
                    <p className="mt-4 font-semibold text-lg">Generando PDF...</p>
                </div>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg relative max-w-md">
                <strong className="font-bold flex items-center gap-2"><AlertTriangleIcon />¡Error!</strong>
                <span className="block sm:inline mt-2">{error}</span>
              </div>
            </div>
          )}
          {!isLoading && !error && editedResult && (
            <div className="space-y-6">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Resultados de la Optimización</h2>
                    <p className="text-content-200 dark:text-dark-content-200">Se han generado {editedResult.layouts.length} tableros.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleGenerateLabels} className="px-4 py-2 bg-base-100 dark:bg-dark-base-200 rounded-md flex items-center gap-2 text-sm font-semibold hover:bg-base-300 dark:hover:bg-dark-base-300 border border-base-300 dark:border-dark-base-300"><TagIcon /> Etiquetas</button>
                    <button onClick={() => window.print()} className="px-4 py-2 bg-base-100 dark:bg-dark-base-200 rounded-md flex items-center gap-2 text-sm font-semibold hover:bg-base-300 dark:hover:bg-dark-base-300 border border-base-300 dark:border-dark-base-300"><PrinterIcon /> Imprimir</button>
                    <button onClick={handleExportPDF} className="px-4 py-2 bg-base-100 dark:bg-dark-base-200 rounded-md flex items-center gap-2 text-sm font-semibold hover:bg-base-300 dark:hover:bg-dark-base-300 border border-base-300 dark:border-dark-base-300"><DownloadIcon /> PDF</button>
                </div>
              </header>

              {warnings.length > 0 && (
                <div className="p-4 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200">
                    <p className="font-bold flex items-center gap-2"><AlertTriangleIcon/>Advertencias de Fabricación</p>
                    <ul className="list-disc list-inside mt-2 text-sm">
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-center">
                <div className="p-4 bg-base-100 dark:bg-dark-base-200 rounded-lg"><p className="text-sm text-content-200 dark:text-dark-content-200 flex items-center justify-center gap-1.5"><CubeIcon className="w-4 h-4"/>Total Tableros</p><p className="text-2xl font-bold">{editedResult.totalBoards}</p></div>
                <div className="p-4 bg-base-100 dark:bg-dark-base-200 rounded-lg"><p className="text-sm text-content-200 dark:text-dark-content-200 flex items-center justify-center gap-1.5"><TrashIcon className="w-4 h-4"/>Desperdicio</p><p className="text-2xl font-bold">{editedResult.estimatedWastePercentage.toFixed(2)}%</p></div>
                <div className="p-4 bg-base-100 dark:bg-dark-base-200 rounded-lg"><p className="text-sm text-content-200 dark:text-dark-content-200 flex items-center justify-center gap-1.5"><SawBladeIcon className="w-4 h-4"/>Corte Lineal</p><p className="text-2xl font-bold">{(editedResult.totalCorteMetrosLineales/1000).toFixed(2)} m</p></div>
                <div className="p-4 bg-base-100 dark:bg-dark-base-200 rounded-lg"><p className="text-sm text-content-200 dark:text-dark-content-200 flex items-center justify-center gap-1.5"><SawBladeIcon className="w-4 h-4"/>Nº de Cortes</p><p className="text-2xl font-bold">{editedResult.totalNumberOfCuts || 'N/A'}</p></div>
                 <div className="p-4 bg-base-100 dark:bg-dark-base-200 rounded-lg"><p className="text-sm text-content-200 dark:text-dark-content-200 flex items-center justify-center gap-1.5"><RulerIcon className="w-4 h-4"/>Canto Total</p><p className="text-2xl font-bold">{totalEdgeBandingMeters.toFixed(2)} m</p></div>
              </div>

              {estimatedTotalCost > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                      <div>
                          <p className="text-green-800 dark:text-green-300 font-semibold flex items-center gap-2"><CalculatorIcon className="w-5 h-5"/>Estimación de Costos del Proyecto</p>
                          <p className="text-xs text-green-700 dark:text-green-400 mt-1">Incluye material, canto y tiempo estimado de mecanizado.</p>
                      </div>
                      <p className="text-3xl font-bold text-green-700 dark:text-green-400">${estimatedTotalCost.toFixed(2)}</p>
                  </div>
              )}

              <div>
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                    {editedResult.layouts.map((layout, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveLayoutTab(index)}
                        className={`${
                          activeLayoutTab === index
                            ? 'border-brand-primary text-brand-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                        } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                      >
                        Tablero {index + 1}
                      </button>
                    ))}
                  </nav>
                </div>
                <div className="mt-4">
                  {editedResult.layouts.map((layout, index) => (
                    <div key={index} id={`layout-display-${index}`} style={{ display: activeLayoutTab === index ? 'block' : 'none' }}>
                       <LayoutDisplay 
                            board={board} 
                            layout={layout}
                            pieces={pieces}
                            onLayoutChange={handleLayoutChange} 
                            theme={theme}
                            kerf={kerf}
                            machine={machine}
                            isActive={activeLayoutTab === index}
                        />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
           {!isLoading && !error && !result && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <CubeIcon className="w-20 h-20 text-gray-400 dark:text-gray-600" />
                    <h2 className="mt-4 text-2xl font-semibold">Bienvenido al Optimizador de Corte</h2>
                    <p className="mt-2 text-content-200 dark:text-dark-content-200 max-w-md">
                        Configura las dimensiones de tu tablero, añade las piezas que necesitas cortar o impórtalas desde un CSV y haz clic en "Optimizar" para generar un plan de corte eficiente y un presupuesto.
                    </p>
                </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default App;
