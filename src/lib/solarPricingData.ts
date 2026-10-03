export interface SolarBrandOption {
  id: string;
  name: string;
  tier: 'TIER_1' | 'PREMIUM' | 'BUDGET';
  wattages: number[];
  defaultCellType: string;
  approxRatePerWatt: number; // in INR
}

export interface InverterBrandOption {
  id: string;
  name: string;
  phases: ('1-Phase' | '3-Phase')[];
  ratingsKw: number[];
  approxRatePerKw: number;
}

export const SOLAR_BRANDS: SolarBrandOption[] = [
  { id: 'tata', name: 'Tata Powar Solar', tier: 'TIER_1', wattages: [550, 540, 450], defaultCellType: 'Bifacial DCR', approxRatePerWatt: 24.5 },
  { id: 'adani', name: 'Adani Solar', tier: 'TIER_1', wattages: [550, 545, 575], defaultCellType: 'TopCon Bifacial', approxRatePerWatt: 24.0 },
  { id: 'waaree', name: 'Waaree Energies', tier: 'TIER_1', wattages: [550, 540, 575], defaultCellType: 'Mono PERC DCR', approxRatePerWatt: 23.5 },
  { id: 'vikram', name: 'Vikram Solar', tier: 'TIER_1', wattages: [550, 545, 450], defaultCellType: 'Mono PERC DCR', approxRatePerWatt: 23.5 },
  { id: 'rayzon', name: 'Rayzon Solar', tier: 'PREMIUM', wattages: [550, 575], defaultCellType: 'TopCon Bifacial', approxRatePerWatt: 23.0 },
  { id: 'goldi', name: 'Goldi Solar', tier: 'PREMIUM', wattages: [540, 550], defaultCellType: 'Mono PERC', approxRatePerWatt: 22.5 },
  { id: 'loom', name: 'Loom Solar', tier: 'PREMIUM', wattages: [450, 550], defaultCellType: 'Bifacial Shark', approxRatePerWatt: 26.0 },
  { id: 'utl', name: 'UTL Solar', tier: 'BUDGET', wattages: [330, 440, 540], defaultCellType: 'Polycrystalline', approxRatePerWatt: 21.0 },
  { id: 'microtek', name: 'Microtek Solar', tier: 'BUDGET', wattages: [400, 540], defaultCellType: 'Mono PERC', approxRatePerWatt: 22.0 },
];

export const INVERTER_BRANDS: InverterBrandOption[] = [
  { id: 'growatt', name: 'Growatt (Dual MPPT WiFi)', phases: ['1-Phase', '3-Phase'], ratingsKw: [1, 2, 3, 3.3, 4, 5, 6, 8, 10, 15, 20], approxRatePerKw: 7500 },
  { id: 'deye', name: 'Deye Hybrid/On-Grid', phases: ['1-Phase', '3-Phase'], ratingsKw: [3, 3.3, 5, 6, 8, 10, 12, 15], approxRatePerKw: 8500 },
  { id: 'solis', name: 'Solis (Ginlong)', phases: ['1-Phase', '3-Phase'], ratingsKw: [1, 2, 3, 4, 5, 6, 8, 10, 15], approxRatePerKw: 7200 },
  { id: 'havells', name: 'Havells Enviro', phases: ['1-Phase', '3-Phase'], ratingsKw: [3, 3.3, 5, 6, 10], approxRatePerKw: 8200 },
  { id: 'polycab', name: 'Polycab Solar', phases: ['1-Phase', '3-Phase'], ratingsKw: [3, 5, 10], approxRatePerKw: 7400 },
  { id: 'sungrow', name: 'Sungrow Commercial', phases: ['3-Phase'], ratingsKw: [5, 10, 15, 20], approxRatePerKw: 8000 },
  { id: 'luminous', name: 'Luminous Solar Inverter', phases: ['1-Phase'], ratingsKw: [1, 2, 3, 5], approxRatePerKw: 7800 },
  { id: 'microtek_inv', name: 'Microtek Solar PCU', phases: ['1-Phase'], ratingsKw: [1, 2, 3.5, 5], approxRatePerKw: 7500 },
  { id: 'utl_inv', name: 'UTL Gamma Plus / Alfa', phases: ['1-Phase'], ratingsKw: [1, 2, 3, 5], approxRatePerKw: 7000 },
];

export const SOLAR_KW_OPTIONS = [1, 2, 3, 3.3, 4, 5, 6, 8, 10, 12, 15, 20];
export const SOLAR_SYSTEM_TYPES = ['ON_GRID', 'OFF_GRID', 'HYBRID'] as const;
export const CELL_TYPES = [
  'Bifacial (Dual Glass DCR)',
  'Mono PERC (Single Glass DCR)',
  'TopCon Bifacial (N-Type)',
  'Polycrystalline (Budget)',
  'DCR PM Surya Ghar Certified',
];
