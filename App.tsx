
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

import { getOptimalLayout } from './services/geminiService';
import { analyzePieces } from './services/validationService';
import type { Piece, Board, OptimizationResult, Layout } from './types';
import { PlusIcon, TrashIcon, GrainIcon, WandIcon, DownloadIcon, RefreshIcon, CubeIcon, AlertTriangleIcon, FilePlusIcon, SaveIcon, PrinterIcon, TableIcon, SunIcon, MoonIcon, CheckIcon, PencilIcon, SawBladeIcon, RulerIcon, ClockIcon, SparklesIcon, XIcon, UploadIcon, CalculatorIcon, FolderOpenIcon, TagIcon, FileDownloadIcon, FileUploadIcon, RouterIcon } from './components/icons';
import { LayoutDisplay } from './components/LayoutDisplay';

const initialPieces: Piece[] = [
    { id: 'p1', name: 'Puerta', reference: 'P-01', width: 800, height: 400, quantity: 4, hasGrain: true, grainContinuityGroup: 'g-1', edgeTop: true, edgeBottom: true, edgeLeft: true, edgeRight: true },
    { id: 'p2', name: 'Costado', reference: 'C-01', width: 600, height: 300, quantity: 8, hasGrain: false, grainContinuityGroup: '', edgeTop: true, edgeBottom: false, edgeLeft: false, edgeRight: false },
    { id: 'p3', name: 'Balda', reference: 'B-01', width: 500, height: 200, quantity: 10, hasGrain: true, grainContinuityGroup: 'g-2', edgeTop: true, edgeBottom: false, edgeLeft: false, edgeRight: false },
    { id: 'p4', name: 'Frente', reference: 'F-01', width: 700, height: 150, quantity: 6, hasGrain: true, grainContinuityGroup: '', edgeTop: true, edgeBottom: true, edgeLeft: true, edgeRight: true },
];

const standardBoards: Board[] = [
    { name: 'Estándar Melamina (2440x1220)', width: 2440, height: 1220 },
    { name: 'Estándar Contrachapado (2440x1220)', width: 2440, height: 1220 },
    { name: 'Hoja Completa (2800x2100)', width: 2800, height: 2100 },
    { name: 'Media Hoja (1220x1220)', width: 1220, height: 1220 },
    { name: 'HPL (3050x1310x20)', width: 3050, height: 1310 },
];

const initialBoard: Board = standardBoards[0];
const pieceNameOptions = ['Puerta', 'Costado', 'Costado Visto', 'Frente de Cajon', 'Balda', 'Techo', 'Suelo', 'Centro', 'Otro...'];

const newPieceInitialState = { 
    name: pieceNameOptions[0],
    customName: '',
    reference: '',
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
        projectName?: string;
    }
}

// Loading Component with Visual Effects
const LoadingView: React.FC<{ machine: Machine }> = ({ machine }) => {
    const [messageIndex, setMessageIndex] = useState(0);
    
    const messages = machine === 'cnc' ? [
        "Importando vectores de piezas...",
        "Calculando rutas de fresado (Nesting)...",
        "Optimizando trayectoria de herramienta...",
        "Verificando colisiones y espacios...",
        "Generando G-Code simulado..."
    ] : [
        "Analizando geometría de piezas...",
        "Calculando anidamiento óptimo...",
        "Verificando restricciones de veta...",
        "Optimizando cortes de guillotina...",
        "Minimizando desperdicio de material...",
        "Generando diagramas de corte..."
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % messages.length);
        }, 2000);
        return () => clearInterval(interval);
    }, [messages.length]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center w-full">
            <div className="relative mb-8">
                {/* Board Representation */}
                <div className="w-64 h-40 bg-base-300 dark:bg-dark-base-300 rounded-lg overflow-hidden border-2 border-base-300 dark:border-dark-base-300 relative shadow-inner">
                    {/* Background Grid for CNC */}
                    {machine === 'cnc' && (
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.2 }}></div>
                    )}

                    {/* Ghost Pieces appearing */}
                    <div className="absolute top-2 left-2 w-16 h-24 bg-brand-primary/20 rounded animate-pulse"></div>
                    <div className="absolute bottom-2 right-2 w-24 h-12 bg-brand-secondary/20 rounded animate-pulse delay-100"></div>
                    
                    {/* Machine Specific Animation */}
                    {machine === 'seccionadora' ? (
                        // Saw Line
                         <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-[scan_2s_ease-in-out_infinite]" 
                         style={{ animation: 'scan 3s ease-in-out infinite' }}></div>
                    ) : (
                        // CNC Router Head
                        <div className="absolute w-4 h-4 border-2 border-brand-primary rounded-full bg-white dark:bg-dark-base-100 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-[cncMove_4s_linear_infinite]"
                             style={{ top: '50%', left: '50%', animation: 'cncMove 4s ease-in-out infinite' }}>
                             <div className="w-1 h-1 bg-brand-primary rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                        </div>
                    )}
                </div>
                
                {/* Icon Overlay */}
                <div className="absolute -bottom-6 -right-6 bg-base-100 dark:bg-dark-base-200 p-2 rounded-full shadow-lg border border-base-200 dark:border-dark-base-300">
                     {machine === 'cnc' ? 
                        <RouterIcon className="w-10 h-10 text-brand-primary animate-pulse" /> : 
                        <SawBladeIcon className="w-10 h-10 text-brand-primary animate-spin" />
                     }
                </div>
            </div>

            <h3 className="text-xl font-bold text-content-100 dark:text-dark-content-100 animate-pulse">
                {machine === 'cnc' ? 'Generando Nesting CNC' : 'Optimizando Corte'}
            </h3>
            
            <div className="h-6 mt-2 overflow-hidden relative w-full max-w-xs">
                <p key={messageIndex} className="text-content-200 dark:text-dark-content-200 text-sm animate-fade-in-up absolute w-full transition-all duration-500">
                    {messages[messageIndex]}
                </p>
            </div>
             <style>{`
                @keyframes scan {
                    0% { left: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { left: 100%; opacity: 0; }
                }
                @keyframes cncMove {
                    0% { top: 10%; left: 10%; }
                    25% { top: 10%; left: 80%; }
                    50% { top: 80%; left: 80%; }
                    75% { top: 80%; left: 10%; }
                    100% { top: 10%; left: 10%; }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.5s ease-out forwards;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

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
    onExport: (project: SavedProject) => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ isOpen, onClose, projects, onLoad, onDelete, onExport, onImport }) => {
    const importInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
            <div className="bg-base-100 dark:bg-dark-base-200 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-base-300 dark:border-dark-base-300 flex justify-between items-center">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FolderOpenIcon className="w-6 h-6 text-brand-primary"/> Mis Proyectos
                    </h3>
                    <div className="flex items-center gap-2">
                        <button onClick={() => importInputRef.current?.click()} className="text-sm px-3 py-1.5 bg-base-200 dark:bg-dark-base-300 hover:bg-base-300 rounded flex items-center gap-1">
                            <FileUploadIcon className="w-4 h-4" /> Importar Respaldo
                        </button>
                        <input type="file" ref={importInputRef} onChange={onImport} accept=".json" className="hidden" />
                        <button onClick={onClose}><XIcon /></button>
                    </div>
                </div>
                <div className="p-4 overflow-y-auto flex-grow">
                    {projects.length === 0 ? (
                        <div className="text-center py-10 text-content-200 dark:text-dark-content-200">
                            <p>No tienes proyectos guardados.</p>
                            <p className="text-sm mt-2">Utiliza "Guardar como..." para añadir proyectos aquí o importa un archivo JSON.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {projects.sort((a, b) => b.createdAt - a.createdAt).map(p => (
                                <div key={p.id} className="bg-base-200 dark:bg-dark-base-300 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-base-300 dark:hover:bg-dark-base-100 transition-colors gap-3">
                                    <div>
                                        <h4 className="font-bold text-lg">{p.name}</h4>
                                        <p className="text-xs text-content-200 dark:text-dark-content-200">
                                            {new Date(p.createdAt).toLocaleDateString()} • {p.data.pieces.length} Piezas • {p.data.board.name}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button onClick={() => onLoad(p)} className="flex-1 sm:flex-none bg-brand-primary text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90">
                                            Cargar
                                        </button>
                                        <button onClick={() => onExport(p)} title="Exportar a Archivo JSON" className="flex-1 sm:flex-none bg-base-100 dark:bg-dark-base-200 px-3 py-1.5 rounded text-sm font-medium hover:bg-base-300 dark:hover:bg-dark-base-100 flex items-center justify-center">
                                            <FileDownloadIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => onDelete(p.id)} title="Eliminar" className="flex-1 sm:flex-none bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50">
                                            <TrashIcon className="w-4 h-4"/>
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

const SaveProjectModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (name: string) => void; 
    currentName: string;
}> = ({ isOpen, onClose, onSave, currentName }) => {
    const [name, setName] = useState(currentName);
    
    // Reset name when modal opens
    useEffect(() => {
        if (isOpen) setName(currentName);
    }, [isOpen, currentName]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) onSave(name);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
            <div className="bg-base-100 dark:bg-dark-base-200 rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 dark:text-dark-content-100">Guardar Proyecto Como...</h3>
                <form onSubmit={handleSubmit}>
                    <label className="block text-sm font-medium mb-2 text-content-200 dark:text-dark-content-200">Nombre del Proyecto</label>
                    <input 
                        autoFocus
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)}
                        className="w-full p-2 bg-base-200 dark:bg-dark-base-300 border border-base-300 dark:border-dark-base-300 rounded-md mb-6 focus:ring-2 focus:ring-brand-primary outline-none"
                        placeholder="Ej. Armario Dormitorio"
                    />
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md hover:bg-base-200 dark:hover:bg-dark-base-300 transition-colors">Cancelar</button>
                        <button type="submit" disabled={!name.trim()} className="bg-brand-primary text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [kerf, setKerf] = useState<number>(4);
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
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  
  // Project State
  const [projectName, setProjectName] = useState<string>("Proyecto Sin Título");
  
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
        const { board: savedBoard, pieces: savedPieces, kerf: savedKerf, machine: savedMachine, forceGuillotineCuts: savedForceGuillotine, cncSpeed: savedCncSpeed, costs: savedCosts, projectName: savedName } = JSON.parse(savedProject);
        if (savedBoard) setBoard(savedBoard);
        if (savedPieces) {
             const loadedPieces = savedPieces.map((p: any) => ({
                ...p,
                edgeTop: p.edgeTop || false,
                edgeBottom: p.edgeBottom || false,
                edgeLeft: p.edgeLeft || false,
                edgeRight: p.edgeRight || false,
                reference: p.reference || '',
            }));
            setPieces(loadedPieces);
        }
        if (savedKerf) setKerf(savedKerf);
        if (savedMachine) setMachine(savedMachine);
        if (savedForceGuillotine !== undefined) setForceGuillotineCuts(savedForceGuillotine);
        if (savedCncSpeed) setCncSpeed(savedCncSpeed);
        if (savedCosts) setCosts(savedCosts);
        if (savedName) setProjectName(savedName);
        
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
              const projectData = { board, pieces, kerf, machine, forceGuillotineCuts, cncSpeed, costs, projectName };
              localStorage.setItem('deskspace_project', JSON.stringify(projectData));
          } catch (e) {
              console.error("Failed to auto-save project", e);
          }
      }, 1000); // Debounce save by 1s

      return () => clearTimeout(timeoutId);
  }, [board, pieces, kerf, machine, forceGuillotineCuts, cncSpeed, costs, projectName]);

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
    const { width, height, quantity, reference } = newPiece;
    const numWidth = parseInt(width, 10);
    const numHeight = parseInt(height, 10);
    const numQuantity = parseInt(quantity, 10);

    if (finalName && numWidth > 0 && numHeight > 0 && numQuantity > 0) {
      const pieceData = {
          ...newPiece,
          name: finalName,
          reference: reference || '',
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
        reference: piece.reference || '',
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
                      const reference = cols.length > 5 ? cols[5].trim() : '';

                      if (!isNaN(width) && !isNaN(height) && !isNaN(quantity)) {
                          newPieces.push({
                              id: `p-csv-${Date.now()}-${i}`,
                              name,
                              reference,
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
  
  const handleGenerateReport = async (action: 'download' | 'print') => {
    if (!editedResult) return;
    setIsExporting(true);

    try {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const writableWidth = pageWidth - (margin * 2);

        // Helper for consistent header
        const addHeader = (pdfDoc: jsPDF) => {
            pdfDoc.setFontSize(16);
            pdfDoc.setTextColor(30, 64, 175); // Brand Blue
            pdfDoc.setFont("helvetica", "bold");
            pdfDoc.text("DeskSpace Optimizer", margin, 10);
            
            pdfDoc.setFontSize(8);
            pdfDoc.setTextColor(128);
            pdfDoc.setFont("helvetica", "normal");
            pdfDoc.text(`Generado: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth - margin, 10, { align: 'right' });

            pdfDoc.setDrawColor(220);
            pdfDoc.setLineWidth(0.5);
            pdfDoc.line(margin, 12, pageWidth - margin, 12);
        };

        // --- PAGE 1: GLOBAL SUMMARY ---
        addHeader(doc);

        doc.setFontSize(22);
        doc.setTextColor(40);
        doc.text(projectName, pageWidth / 2, margin + 15, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text('Resumen de Optimización de Corte', pageWidth / 2, margin + 23, { align: 'center' });

        // Global Stats Table
        const summaryBody = [
            ['Tablero Base', `${board.name} (${board.width} x ${board.height} mm)`],
            ['Máquina / Kerf', `${machine === 'seccionadora' ? 'Seccionadora' : 'CNC'} / ${kerf} mm`],
            ['Total Tableros', editedResult.totalBoards.toString()],
            ['Desperdicio Global', `${editedResult.estimatedWastePercentage.toFixed(2)}%`],
            ['Corte Lineal Total', `${(editedResult.totalCorteMetrosLineales / 1000).toFixed(2)} m`],
            ['Canto Total', `${totalEdgeBandingMeters.toFixed(2)} m`],
        ];
        
        if (estimatedTotalCost > 0) {
            summaryBody.push(['Costo Estimado', `$${estimatedTotalCost.toFixed(2)}`]);
        }

        autoTable(doc, {
            startY: margin + 30,
            head: [['Parámetro Global', 'Valor']],
            body: summaryBody,
            theme: 'striped',
            headStyles: { fillColor: [44, 62, 80], textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3 },
            margin: { left: margin, right: margin }
        });

        // Global Parts List (What needs to be cut in total)
        const piecesBody = pieces.map(p => {
             return [p.name, p.reference || '-', `${p.width} x ${p.height}`, p.quantity.toString(), p.hasGrain ? 'Sí' : 'No'];
        });

        doc.text('Lista de Pedido (Piezas Requeridas)', margin, (doc as any).lastAutoTable.finalY + 10);

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 12,
            head: [['Pieza', 'Ref', 'Dimensiones', 'Cant.', 'Veta']],
            body: piecesBody,
            theme: 'grid',
            headStyles: { fillColor: [52, 73, 94], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 2 },
            margin: { left: margin, right: margin }
        });

        // --- PER BOARD PAGES ---
        const currentActiveTab = activeLayoutTab;

        for (let i = 0; i < editedResult.layouts.length; i++) {
            doc.addPage(); // New page for each board
            addHeader(doc);
            
            let currentY = margin + 5; // Start a bit lower due to header

            // Activate tab to render canvas
            setActiveLayoutTab(i);
            // Increase delay to 500ms to ensure rendering
            await new Promise(resolve => setTimeout(resolve, 500));

            const layoutElement = document.getElementById(`layout-display-${i}`);
            
            // Header for Board
            doc.setFontSize(16);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            const headerText = `Tablero ${i + 1} de ${editedResult.totalBoards}`;
            doc.text(headerText, margin, currentY + 5);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Desperdicio: ${editedResult.layouts[i].boardWastePercentage.toFixed(2)}%  |  Cortes: ${editedResult.layouts[i].numberOfCutsForLayout || 0}`, margin, currentY + 12);

            currentY += 15;

            // Render Image
            if (layoutElement) {
                 const canvas = await html2canvas(layoutElement, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true
                });
                
                const imgData = canvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(imgData);
                
                // Max height for image (leave space for table below)
                const maxImgHeight = pageHeight * 0.55; 
                const availableWidth = writableWidth;
                
                let pdfImgWidth = availableWidth;
                let pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;

                if (pdfImgHeight > maxImgHeight) {
                    pdfImgHeight = maxImgHeight;
                    pdfImgWidth = (imgProps.width * pdfImgHeight) / imgProps.height;
                }

                const centerX = (pageWidth - pdfImgWidth) / 2;
                doc.addImage(imgData, 'PNG', centerX, currentY, pdfImgWidth, pdfImgHeight);
                currentY += pdfImgHeight + 10;
            }

            // Cut List Table for this specific board
            const layout = editedResult.layouts[i];
            const cutListBody = layout.placedPieces.map(p => {
                const original = pieces.find(op => op.id === p.originalPieceId);
                const edges = [];
                if (original?.edgeTop) edges.push('S');
                if (original?.edgeBottom) edges.push('I');
                if (original?.edgeLeft) edges.push('Izq');
                if (original?.edgeRight) edges.push('Der');
                
                return [
                    p.name,
                    original?.reference || '-',
                    `${p.width} x ${p.height}`,
                    `${p.x}, ${p.y}`,
                    p.rotated ? 'Sí' : 'No',
                    edges.join(', ') || '-'
                ];
            });

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text('Lista de Corte - Este Tablero', margin, currentY);

            autoTable(doc, {
                startY: currentY + 3,
                head: [['Pieza', 'Ref', 'Dim (mm)', 'Pos (X,Y)', 'Rot', 'Canto']],
                body: cutListBody,
                theme: 'grid',
                headStyles: { fillColor: [44, 62, 80], textColor: 255 },
                styles: { fontSize: 9, cellPadding: 2 },
                margin: { left: margin, right: margin }
            });
        }

        // Restore active tab
        setActiveLayoutTab(currentActiveTab);

        if (action === 'download') {
            doc.save(`${projectName.replace(/\s+/g, '_')}_Report.pdf`);
        } else {
             // Print using iframe approach to bypass pop-up blockers
             const pdfBlob = doc.output('blob');
             const blobUrl = URL.createObjectURL(pdfBlob);
             
             const iframe = document.createElement('iframe');
             iframe.style.display = 'none';
             iframe.src = blobUrl;
             document.body.appendChild(iframe);
             
             iframe.onload = () => {
                 setTimeout(() => {
                     iframe.contentWindow?.focus();
                     iframe.contentWindow?.print();
                     // Clean up blob URL after print dialog is likely open/closed
                     // Note: We can't know exactly when print is done, but blob stays valid.
                 }, 500);
             };
        }

    } catch (e) {
        console.error("Error generating report:", e);
        setError("Error al generar el reporte PDF. Por favor intenta de nuevo.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleGenerateLabels = () => {
    if (!editedResult) return;
    setIsExporting(true);

    try {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [50, 30] // Standard small sticker size (50mm x 30mm)
        });

        let first = true;

        editedResult.layouts.forEach((layout, boardIdx) => {
            layout.placedPieces.forEach((piece) => {
                if (!first) doc.addPage();
                first = false;

                const original = pieces.find(op => op.id === piece.originalPieceId);

                // --- Sticker Design ---
                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text(piece.name.substring(0, 15), 2, 5); // Crop long names

                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                if (original?.reference) {
                    doc.text(`Ref: ${original.reference}`, 2, 9);
                }
                
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text(`${piece.width} x ${piece.height}`, 25, 16, { align: 'center' });
                
                // Visual Edge Banding Indicators (Cross shape)
                const cx = 40; 
                const cy = 15;
                const size = 6;
                
                doc.setLineWidth(0.5);
                // Center Box
                doc.rect(cx - size/2, cy - size/2, size, size);
                
                doc.setFontSize(5);
                if (original?.edgeTop) {
                    doc.setFillColor(0,0,0);
                    doc.rect(cx - size/2, cy - size/2 - 2, size, 2, 'F');
                }
                if (original?.edgeBottom) {
                     doc.setFillColor(0,0,0);
                     doc.rect(cx - size/2, cy + size/2, size, 2, 'F');
                }
                if (original?.edgeLeft) {
                    doc.setFillColor(0,0,0);
                    doc.rect(cx - size/2 - 2, cy - size/2, 2, size, 'F');
                }
                if (original?.edgeRight) {
                    doc.setFillColor(0,0,0);
                    doc.rect(cx + size/2, cy - size/2, 2, size, 'F');
                }

                // Footer info
                doc.setFontSize(5);
                doc.text(`${projectName.substring(0, 20)}`, 2, 28);
                doc.text(`T${boardIdx + 1}`, 45, 28);
            });
        });

        doc.save(`${projectName}_Etiquetas.pdf`);
    } catch (e) {
        console.error(e);
        setError("Error generando etiquetas.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("¿Estás seguro de que quieres reiniciar todo el proyecto? Se perderán los cambios no guardados.")) {
        setPieces(JSON.parse(JSON.stringify(initialPieces)));
        setBoard(initialBoard);
        setKerf(4);
        setMachine('seccionadora');
        setForceGuillotineCuts(true);
        setCncSpeed(5000);
        setResult(null);
        setEditedResult(null);
        setProjectName("Proyecto Sin Título");
        setCosts({ boardPrice: 0, edgePricePerMeter: 0, cncHourlyRate: 0 });
    }
  };

  const handleManualUpdate = () => {
    if (editedResult) {
        setSaveMessage('Estado guardado correctamente.');
        setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  // Project Library Handlers
  const handleSaveProjectToLibrary = (name: string) => {
      const newProject: SavedProject = {
          id: Date.now().toString(),
          name: name,
          createdAt: Date.now(),
          data: {
              board,
              pieces,
              kerf,
              machine,
              forceGuillotineCuts,
              cncSpeed,
              costs,
              customBoards,
              projectName: name
          }
      };
      
      const updatedProjects = [...savedProjects, newProject];
      try {
        localStorage.setItem('deskspace_saved_projects', JSON.stringify(updatedProjects));
        setSavedProjects(updatedProjects);
        setProjectName(name);
        setIsSaveModalOpen(false);
        setSaveMessage("Proyecto guardado en biblioteca.");
        setTimeout(() => setSaveMessage(''), 3000);
      } catch (e) {
        alert("Error al guardar: El almacenamiento local está lleno. Intenta exportar proyectos antiguos y eliminarlos.");
      }
  };

  const handleLoadProject = (project: SavedProject) => {
      if (window.confirm("Cargar este proyecto reemplazará el trabajo actual. ¿Continuar?")) {
          setBoard(project.data.board);
          setPieces(project.data.pieces);
          setKerf(project.data.kerf);
          setMachine(project.data.machine);
          setForceGuillotineCuts(project.data.forceGuillotineCuts);
          setCncSpeed(project.data.cncSpeed || 5000);
          setCosts(project.data.costs || { boardPrice: 0, edgePricePerMeter: 0, cncHourlyRate: 0 });
          setCustomBoards(project.data.customBoards || []);
          setProjectName(project.data.projectName || project.name);
          setResult(null);
          setEditedResult(null);
          setIsProjectLibraryOpen(false);
      }
  };

  const handleDeleteProject = (id: string) => {
      if (window.confirm("¿Eliminar este proyecto permanentemente?")) {
          const updated = savedProjects.filter(p => p.id !== id);
          setSavedProjects(updated);
          localStorage.setItem('deskspace_saved_projects', JSON.stringify(updated));
      }
  };

  const handleExportProject = (project: SavedProject) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${project.name.replace(/\s+/g, '_')}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const input = e.target;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const importedProject = JSON.parse(event.target?.result as string);
              if (importedProject && importedProject.data) {
                  // Ensure ID is unique upon import
                  importedProject.id = Date.now().toString();
                  const updated = [...savedProjects, importedProject];
                  setSavedProjects(updated);
                  localStorage.setItem('deskspace_saved_projects', JSON.stringify(updated));
                  alert("Proyecto importado correctamente.");
              } else {
                  alert("Formato de archivo inválido.");
              }
          } catch (err) {
              console.error(err);
              alert("Error al leer el archivo.");
          } finally {
               input.value = ''; // Reset input
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${theme === 'dark' ? 'bg-dark-base-100 text-dark-content-100' : 'bg-base-200 text-content-100'}`}>
      {/* Header */}
      <header className="bg-white dark:bg-dark-base-200 shadow-sm border-b border-base-300 dark:border-dark-base-300 print:hidden sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-brand-primary text-white p-1.5 rounded-lg">
                <CubeIcon className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">
              <span className="text-brand-primary">DeskSpace</span> Optimizer
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setIsProjectLibraryOpen(true)} className="p-2 text-content-200 dark:text-dark-content-200 hover:bg-base-200 dark:hover:bg-dark-base-300 rounded-full transition-colors relative group">
                <FolderOpenIcon />
                <span className="absolute top-full mt-1 right-0 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Mis Proyectos</span>
            </button>
            <button onClick={() => setIsPricingModalOpen(true)} className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-all">
                <SparklesIcon className="w-4 h-4" />
                <span>PRO</span>
            </button>
            <div className="h-6 w-px bg-base-300 dark:bg-dark-base-300 mx-1"></div>
            <button 
              onClick={toggleTheme} 
              className="p-2 text-content-200 dark:text-dark-content-200 hover:bg-base-200 dark:hover:bg-dark-base-300 rounded-full transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-64px)] overflow-hidden flex flex-col sm:flex-row gap-6">
        
        {/* Left Control Column - Scrollable */}
        <div id="control-column" className="w-full sm:w-1/3 lg:w-1/4 flex flex-col gap-6 overflow-y-auto pr-2 pb-20 sm:pb-0 h-full scrollbar-hide">
            
            {/* Project Title Input */}
            <div className="bg-white dark:bg-dark-base-200 p-4 rounded-lg shadow-sm border border-base-300 dark:border-dark-base-300">
                <label className="block text-xs font-semibold uppercase tracking-wider text-content-200 dark:text-dark-content-200 mb-2">Proyecto</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="text" 
                        value={projectName} 
                        onChange={(e) => setProjectName(e.target.value)} 
                        className="w-full bg-base-200 dark:bg-dark-base-300 border-none rounded px-3 py-2 font-medium focus:ring-2 focus:ring-brand-primary"
                        placeholder="Nombre del proyecto..."
                    />
                    <button onClick={() => setIsSaveModalOpen(true)} className="p-2 text-brand-primary hover:bg-base-200 dark:hover:bg-dark-base-300 rounded" title="Guardar como...">
                        <SaveIcon />
                    </button>
                </div>
            </div>

            {/* Board Configuration */}
            <div className="bg-white dark:bg-dark-base-200 p-4 rounded-lg shadow-sm border border-base-300 dark:border-dark-base-300">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold flex items-center gap-2">
                        <RulerIcon className="text-brand-primary"/> Material
                    </h2>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Tablero Base</label>
                        <select 
                            className="w-full p-2 bg-base-200 dark:bg-dark-base-300 rounded border border-base-300 dark:border-dark-base-300 text-sm"
                            value={board.name}
                            onChange={(e) => {
                                const selected = [...standardBoards, ...customBoards].find(b => b.name === e.target.value);
                                if (selected) setBoard(selected);
                            }}
                        >
                            <optgroup label="Estándar">
                                {standardBoards.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                            </optgroup>
                            {customBoards.length > 0 && (
                                <optgroup label="Personalizados">
                                    {customBoards.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                                </optgroup>
                            )}
                        </select>
                         {!isAddingCustom ? (
                            <button onClick={() => setIsAddingCustom(true)} className="text-xs text-brand-primary mt-1 hover:underline">+ Crear medida personalizada</button>
                        ) : (
                            <div className="mt-2 p-2 bg-base-200 dark:bg-dark-base-300 rounded animate-fade-in-up">
                                <input placeholder="Nombre (ej. Retal Taller)" className="w-full text-xs p-1 mb-1 rounded" value={customBoardData.name} onChange={e => setCustomBoardData({...customBoardData, name: e.target.value})} />
                                <div className="flex gap-1 mb-1">
                                    <input type="number" placeholder="Largo" className="w-1/2 text-xs p-1 rounded" value={customBoardData.width} onChange={e => setCustomBoardData({...customBoardData, width: e.target.value})} />
                                    <input type="number" placeholder="Ancho" className="w-1/2 text-xs p-1 rounded" value={customBoardData.height} onChange={e => setCustomBoardData({...customBoardData, height: e.target.value})} />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setIsAddingCustom(false)} className="text-xs opacity-70">Cancelar</button>
                                    <button onClick={() => {
                                        if(customBoardData.name && customBoardData.width && customBoardData.height) {
                                            const newB = { name: `${customBoardData.name} (${customBoardData.width}x${customBoardData.height})`, width: Number(customBoardData.width), height: Number(customBoardData.height) };
                                            setCustomBoards([...customBoards, newB]);
                                            setBoard(newB);
                                            setIsAddingCustom(false);
                                            // Save to local storage specifically
                                            localStorage.setItem('deskspace_custom_boards', JSON.stringify([...customBoards, newB]));
                                        }
                                    }} className="text-xs bg-brand-primary text-white px-2 py-1 rounded">Guardar</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="block text-sm font-medium mb-1">Kerf (mm)</label>
                            <input 
                                type="number" 
                                value={kerf} 
                                onChange={(e) => setKerf(Number(e.target.value))}
                                className="w-full p-2 bg-base-200 dark:bg-dark-base-300 rounded border border-base-300 dark:border-dark-base-300 text-sm"
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">Máquina</label>
                            <select 
                                value={machine} 
                                onChange={(e) => setMachine(e.target.value as Machine)}
                                className="w-full p-2 bg-base-200 dark:bg-dark-base-300 rounded border border-base-300 dark:border-dark-base-300 text-sm"
                            >
                                <option value="seccionadora">Seccionadora</option>
                                <option value="cnc">CNC / Router</option>
                            </select>
                        </div>
                    </div>

                    {machine === 'cnc' && (
                         <div>
                            <label className="block text-sm font-medium mb-1">Velocidad (mm/min)</label>
                            <input 
                                type="number" 
                                value={cncSpeed} 
                                onChange={(e) => setCncSpeed(Number(e.target.value))}
                                className="w-full p-2 bg-base-200 dark:bg-dark-base-300 rounded border border-base-300 dark:border-dark-base-300 text-sm"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="guillotine"
                            checked={forceGuillotineCuts}
                            onChange={(e) => setForceGuillotineCuts(e.target.checked)}
                            className="rounded text-brand-primary focus:ring-brand-primary"
                        />
                        <label htmlFor="guillotine" className="text-sm">Forzar cortes de guillotina (rectos)</label>
                    </div>
                </div>
            </div>

             {/* Financials */}
             <div className="bg-white dark:bg-dark-base-200 p-4 rounded-lg shadow-sm border border-base-300 dark:border-dark-base-300">
                <h2 className="font-bold flex items-center gap-2 mb-3">
                    <CalculatorIcon className="text-brand-secondary"/> Costos y Presupuesto
                </h2>
                <div className="grid grid-cols-1 gap-3 text-sm">
                    <div>
                        <label className="block text-xs text-content-200 dark:text-dark-content-200 mb-1">Precio por Tablero</label>
                        <div className="relative">
                            <span className="absolute left-2 top-1.5 opacity-50">$</span>
                            <input type="number" className="w-full pl-6 p-1.5 bg-base-200 dark:bg-dark-base-300 rounded border border-base-300 dark:border-dark-base-300" 
                                value={costs.boardPrice || ''} onChange={e => setCosts({...costs, boardPrice: parseFloat(e.target.value) || 0})} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-1/2">
                            <label className="block text-xs text-content-200 dark:text-dark-content-200 mb-1">Precio Canto/m</label>
                            <input type="number" className="w-full p-1.5 bg-base-200 dark:bg-dark-base-300 rounded border border-base-300 dark:border-dark-base-300" 
                                value={costs.edgePricePerMeter || ''} onChange={e => setCosts({...costs, edgePricePerMeter: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div className="w-1/2">
                            <label className="block text-xs text-content-200 dark:text-dark-content-200 mb-1">Costo Hora MQ</label>
                            <input type="number" className="w-full p-1.5 bg-base-200 dark:bg-dark-base-300 rounded border border-base-300 dark:border-dark-base-300" 
                                value={costs.cncHourlyRate || ''} onChange={e => setCosts({...costs, cncHourlyRate: parseFloat(e.target.value) || 0})} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Pieces Input */}
            <div className="bg-white dark:bg-dark-base-200 p-4 rounded-lg shadow-sm border border-base-300 dark:border-dark-base-300 flex-grow flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold flex items-center gap-2">
                        <CubeIcon className="text-brand-primary"/> Piezas
                    </h2>
                     <button onClick={() => fileInputRef.current?.click()} className="text-xs flex items-center gap-1 text-brand-primary hover:underline">
                        <UploadIcon className="w-3 h-3"/> Importar CSV
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleCSVUpload} accept=".csv" className="hidden" />
                </div>

                <div className="bg-base-200 dark:bg-dark-base-300 p-3 rounded-lg mb-4 space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-grow">
                             <label className="block text-xs font-medium mb-1">Nombre</label>
                             <select name="name" value={newPiece.name} onChange={handleInputChange} className="w-full p-1.5 rounded text-sm bg-white dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300">
                                {pieceNameOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                             </select>
                             {newPiece.name === 'Otro...' && (
                                 <input type="text" name="customName" placeholder="Nombre personalizado" value={newPiece.customName} onChange={handleInputChange} className="w-full mt-1 p-1.5 rounded text-sm bg-white dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300" autoFocus />
                             )}
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-medium mb-1">Ref.</label>
                            <input type="text" name="reference" value={newPiece.reference} onChange={handleInputChange} className="w-full p-1.5 rounded text-sm bg-white dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300" placeholder="#A1" />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="w-1/3">
                            <label className="block text-xs font-medium mb-1">Largo</label>
                            <input type="number" name="width" value={newPiece.width} onChange={handleInputChange} className="w-full p-1.5 rounded text-sm bg-white dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300" placeholder="mm" />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-medium mb-1">Ancho</label>
                            <input type="number" name="height" value={newPiece.height} onChange={handleInputChange} className="w-full p-1.5 rounded text-sm bg-white dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300" placeholder="mm" />
                        </div>
                         <div className="w-1/3">
                            <label className="block text-xs font-medium mb-1">Cant.</label>
                            <input type="number" name="quantity" value={newPiece.quantity} onChange={handleInputChange} className="w-full p-1.5 rounded text-sm bg-white dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300" />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <input type="checkbox" name="hasGrain" id="hasGrain" checked={newPiece.hasGrain} onChange={handleInputChange} className="rounded text-brand-primary" />
                            <label htmlFor="hasGrain" className="text-sm flex items-center gap-1 cursor-pointer"><GrainIcon className="w-4 h-4"/> Respetar Veta</label>
                        </div>
                        {newPiece.hasGrain && (
                            <input type="text" name="grainContinuityGroup" value={newPiece.grainContinuityGroup} onChange={handleInputChange} placeholder="Grupo Continuidad (opcional)" className="w-full p-1.5 rounded text-sm bg-white dark:bg-dark-base-100 border border-base-300 dark:border-dark-base-300" />
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1">Canteado</label>
                        <div className="flex justify-between gap-1">
                             {['Top', 'Bottom', 'Left', 'Right'].map(side => (
                                 <label key={side} className={`flex-1 text-center py-1 rounded text-xs cursor-pointer select-none border ${newPiece[`edge${side}` as keyof typeof newPiece] ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white dark:bg-dark-base-100 border-base-300 dark:border-dark-base-300'}`}>
                                     <input type="checkbox" name={`edge${side}`} checked={newPiece[`edge${side}` as keyof typeof newPiece] as boolean} onChange={handleInputChange} className="hidden" />
                                     {side === 'Top' ? 'Sup' : side === 'Bottom' ? 'Inf' : side === 'Left' ? 'Izq' : 'Der'}
                                 </label>
                             ))}
                        </div>
                    </div>

                    <button onClick={handleAddPiece} className="w-full bg-content-100 dark:bg-dark-content-100 text-base-100 dark:text-dark-base-100 py-2 rounded-md hover:opacity-90 transition-opacity flex justify-center items-center gap-2">
                        {editingPieceId ? <PencilIcon /> : <PlusIcon />} {editingPieceId ? 'Actualizar Pieza' : 'Añadir Pieza'}
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto space-y-2">
                    {pieces.map((piece) => (
                        <div key={piece.id} className="flex items-center justify-between p-2 bg-base-100 dark:bg-dark-base-300 rounded border border-base-200 dark:border-dark-base-300 group hover:shadow-sm transition-shadow">
                            <div>
                                <div className="font-medium text-sm">
                                    {piece.quantity}x {piece.name} <span className="text-xs text-content-200 dark:text-dark-content-200 font-normal">({piece.width}x{piece.height})</span>
                                </div>
                                <div className="text-xs text-content-200 dark:text-dark-content-200 flex items-center gap-2">
                                     {piece.reference && <span className="bg-brand-secondary/10 text-brand-secondary px-1 rounded">{piece.reference}</span>}
                                     {piece.hasGrain && <span title="Veta" className="flex items-center"><GrainIcon className="w-3 h-3"/></span>}
                                     {piece.grainContinuityGroup && <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded">Grupo: {piece.grainContinuityGroup}</span>}
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditPiece(piece)} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><PencilIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleDeletePiece(piece.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                    {pieces.length === 0 && <div className="text-center text-sm text-content-200 dark:text-dark-content-200 py-4 italic">No hay piezas añadidas</div>}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
                <button 
                    onClick={handleOptimize} 
                    disabled={isLoading}
                    className="w-full bg-brand-primary text-white py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 font-bold text-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    <WandIcon /> {isLoading ? 'Optimizando...' : 'Optimizar'}
                </button>
                <div className="flex gap-2">
                     <button onClick={handleManualUpdate} className="flex-1 bg-white dark:bg-dark-base-200 text-content-100 dark:text-dark-content-100 border border-base-300 dark:border-dark-base-300 py-2 rounded-lg hover:bg-base-200 dark:hover:bg-dark-base-300 transition-colors flex justify-center items-center gap-2">
                        <SaveIcon className="w-5 h-5"/> Guardar Estado
                    </button>
                    <button onClick={handleReset} className="flex-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-2 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors flex justify-center items-center gap-2 border border-transparent">
                        <RefreshIcon /> Reiniciar
                    </button>
                </div>
                {saveMessage && <div className="text-center text-xs text-green-600 dark:text-green-400 font-medium animate-pulse">{saveMessage}</div>}
            </div>

        </div>

        {/* Right Results Column */}
        <div id="results-column" className="w-full sm:w-2/3 lg:w-3/4 flex flex-col h-full bg-white dark:bg-dark-base-200 rounded-lg shadow-sm border border-base-300 dark:border-dark-base-300 overflow-hidden relative">
            
            {isLoading ? (
                <LoadingView machine={machine} />
            ) : editedResult ? (
                <div className="flex flex-col h-full">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-base-300 dark:border-dark-base-300 flex flex-wrap justify-between items-center gap-4 bg-base-100 dark:bg-dark-base-300/50">
                        <div className="flex flex-col">
                            <h2 className="text-lg font-bold">Resultados</h2>
                            <div className="text-sm text-content-200 dark:text-dark-content-200 flex gap-4">
                                <span>{editedResult.totalBoards} Tablero(s)</span>
                                <span>{editedResult.estimatedWastePercentage.toFixed(2)}% Desperdicio</span>
                                {estimatedTotalCost > 0 && <span className="font-semibold text-brand-secondary">Costo: ${estimatedTotalCost.toFixed(2)}</span>}
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={handleGenerateLabels} disabled={isExporting} className="px-3 py-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm">
                                <TagIcon /> Etiquetas
                            </button>
                             <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 mx-1 self-center"></div>
                             <button onClick={() => handleGenerateReport('print')} disabled={isExporting} className="px-3 py-2 bg-content-100 dark:bg-dark-content-100 text-base-100 dark:text-dark-base-100 rounded-md shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 text-sm">
                                <PrinterIcon /> Imprimir
                            </button>
                            <button onClick={() => handleGenerateReport('download')} disabled={isExporting} className="px-3 py-2 bg-brand-secondary text-white rounded-md shadow-sm hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm">
                                <DownloadIcon /> PDF
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex overflow-x-auto border-b border-base-300 dark:border-dark-base-300 bg-base-200 dark:bg-dark-base-300 px-2 scrollbar-hide">
                         <button 
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeLayoutTab === 0 && !result ? 'border-brand-primary text-brand-primary' : 'border-transparent text-content-200 hover:text-content-100'}`}
                            onClick={() => setActiveLayoutTab(0)}
                         >
                            Resumen
                         </button>
                        {editedResult.layouts.map((_, idx) => (
                            <button 
                                key={idx}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeLayoutTab === idx ? 'border-brand-primary text-brand-primary bg-white dark:bg-dark-base-200 rounded-t' : 'border-transparent text-content-200 hover:text-content-100'}`}
                                onClick={() => setActiveLayoutTab(idx)}
                            >
                                Tablero {idx + 1}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-grow overflow-y-auto p-4 bg-base-100 dark:bg-dark-base-100">
                         {activeLayoutTab < editedResult.layouts.length && (
                             <div id={`layout-display-${activeLayoutTab}`} className="h-full flex flex-col">
                                 <LayoutDisplay 
                                    board={board}
                                    layout={editedResult.layouts[activeLayoutTab]} 
                                    pieces={pieces}
                                    onLayoutChange={handleLayoutChange}
                                    theme={theme}
                                    kerf={kerf}
                                    machine={machine}
                                    isActive={true}
                                 />
                             </div>
                         )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-content-200 dark:text-dark-content-200 p-8 text-center opacity-60">
                    <CubeIcon className="w-16 h-16 mb-4 text-base-300 dark:text-dark-base-300" />
                    <h3 className="text-xl font-bold mb-2">Listo para Optimizar</h3>
                    <p className="max-w-md">Añade tus piezas en el panel izquierdo y pulsa "Optimizar" para generar el plan de corte ideal.</p>
                    {isProjectLoaded && <div className="mt-4 text-green-500 font-medium animate-pulse">Proyecto cargado correctamente</div>}
                </div>
            )}
            
            {/* Warnings Toast */}
            {warnings.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-lg shadow-lg animate-fade-in-up z-20">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-yellow-800 dark:text-yellow-400 text-sm mb-1">Advertencias de Validación</h4>
                            <ul className="list-disc list-inside text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                                {warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                                {warnings.length > 3 && <li>...y {warnings.length - 3} más.</li>}
                            </ul>
                        </div>
                        <button onClick={() => setWarnings([])} className="ml-auto text-yellow-500 hover:text-yellow-700"><XIcon className="w-4 h-4" /></button>
                    </div>
                </div>
            )}
            
            {/* Error Toast */}
            {error && (
                <div className="absolute bottom-4 left-4 right-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 p-4 rounded-lg shadow-lg animate-fade-in-up z-20">
                    <div className="flex items-center gap-3">
                        <AlertTriangleIcon className="text-red-600 dark:text-red-500 flex-shrink-0" />
                        <span className="text-red-800 dark:text-red-300 text-sm font-medium">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700"><XIcon className="w-4 h-4" /></button>
                    </div>
                </div>
            )}
        </div>
      </main>

      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
      <SaveProjectModal 
        isOpen={isSaveModalOpen} 
        onClose={() => setIsSaveModalOpen(false)} 
        onSave={handleSaveProjectToLibrary}
        currentName={projectName}
      />
      <ProjectLibraryModal 
        isOpen={isProjectLibraryOpen}
        onClose={() => setIsProjectLibraryOpen(false)}
        projects={savedProjects}
        onLoad={handleLoadProject}
        onDelete={handleDeleteProject}
        onExport={handleExportProject}
        onImport={handleImportProject}
      />
    </div>
  );
};

export default App;
