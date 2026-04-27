export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'yd';
export type AreaUnit = 'm2' | 'ft2' | 'tsubo';
export type System = 'metric' | 'imperial' | 'jp';

// Strict conversion constants
const MM_PER_INCH = 25.4;
const MM_PER_FOOT = 304.8; // 12 * 25.4
const MM_PER_YARD = 914.4; // 36 * 25.4

// 1坪 = 3.305785 m² (建設業標準)
const M2_PER_TSUBO = 3.305785;
const FT2_PER_M2 = 1 / (0.3048 * 0.3048); // exactly

function toMillimeters(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm': return value;
    case 'cm': return value * 10;
    case 'm': return value * 1000;
    case 'in': return value * MM_PER_INCH;
    case 'ft': return value * MM_PER_FOOT;
    case 'yd': return value * MM_PER_YARD;
  }
}

function fromMillimeters(mm: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm': return mm;
    case 'cm': return mm / 10;
    case 'm': return mm / 1000;
    case 'in': return mm / MM_PER_INCH;
    case 'ft': return mm / MM_PER_FOOT;
    case 'yd': return mm / MM_PER_YARD;
  }
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  return fromMillimeters(toMillimeters(value, from), to);
}

function toSquareMeters(value: number, unit: AreaUnit): number {
  switch (unit) {
    case 'm2': return value;
    case 'ft2': return value / FT2_PER_M2;
    case 'tsubo': return value * M2_PER_TSUBO;
  }
}

function fromSquareMeters(m2: number, unit: AreaUnit): number {
  switch (unit) {
    case 'm2': return m2;
    case 'ft2': return m2 * FT2_PER_M2;
    case 'tsubo': return m2 / M2_PER_TSUBO;
  }
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  if (from === to) return value;
  return fromSquareMeters(toSquareMeters(value, from), to);
}

export function formatLength(value: number, unit: LengthUnit, locale?: string): string {
  const resolvedLocale = locale ?? 'en';
  const rounded = parseFloat(value.toPrecision(6));
  switch (unit) {
    case 'mm': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 1 }).format(rounded)} mm`;
    case 'cm': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 1 }).format(rounded)} cm`;
    case 'm': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 3 }).format(rounded)} m`;
    case 'in': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 2 }).format(rounded)}"`;
    case 'ft': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 2 }).format(rounded)}'`;
    case 'yd': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 2 }).format(rounded)} yd`;
  }
}

export function formatArea(value: number, unit: AreaUnit, locale?: string): string {
  const resolvedLocale = locale ?? 'en';
  const rounded = parseFloat(value.toPrecision(6));
  switch (unit) {
    case 'm2': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 2 }).format(rounded)} m²`;
    case 'ft2': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 2 }).format(rounded)} ft²`;
    case 'tsubo': return `${new Intl.NumberFormat(resolvedLocale, { maximumFractionDigits: 2 }).format(rounded)} 坪`;
  }
}

export function getDefaultSystem(locale: string): System {
  const lang = locale.toLowerCase();
  if (lang === 'ja' || lang.startsWith('ja-')) return 'jp';
  if (lang === 'en-us' || lang === 'en-us') return 'imperial';
  if (lang === 'en-gb') return 'imperial';
  if (lang === 'en-au') return 'imperial';
  if (lang.startsWith('en-')) return 'imperial';
  return 'metric';
}
