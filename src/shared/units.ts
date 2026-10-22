/** Unit conversion with factors to a base unit per category. Temperature is handled separately. */
export interface UnitDef {
  id: string;
  label: string;
  factor: number;
}

export const UNIT_CATEGORIES: Record<string, { label: string; units: UnitDef[] }> = {
  length: {
    label: 'Length',
    units: [
      { id: 'mm', label: 'Millimetres', factor: 0.001 },
      { id: 'cm', label: 'Centimetres', factor: 0.01 },
      { id: 'm', label: 'Metres', factor: 1 },
      { id: 'km', label: 'Kilometres', factor: 1000 },
      { id: 'in', label: 'Inches', factor: 0.0254 },
      { id: 'ft', label: 'Feet', factor: 0.3048 },
      { id: 'yd', label: 'Yards', factor: 0.9144 },
      { id: 'mi', label: 'Miles', factor: 1609.344 },
      { id: 'nmi', label: 'Nautical miles', factor: 1852 },
    ],
  },
  mass: {
    label: 'Mass',
    units: [
      { id: 'mg', label: 'Milligrams', factor: 1e-6 },
      { id: 'g', label: 'Grams', factor: 0.001 },
      { id: 'kg', label: 'Kilograms', factor: 1 },
      { id: 't', label: 'Tonnes', factor: 1000 },
      { id: 'oz', label: 'Ounces', factor: 0.028349523125 },
      { id: 'lb', label: 'Pounds', factor: 0.45359237 },
      { id: 'st', label: 'Stones', factor: 6.35029318 },
    ],
  },
  volume: {
    label: 'Volume',
    units: [
      { id: 'ml', label: 'Millilitres', factor: 0.001 },
      { id: 'l', label: 'Litres', factor: 1 },
      { id: 'm3', label: 'Cubic metres', factor: 1000 },
      { id: 'tsp', label: 'Teaspoons (US)', factor: 0.00492892159375 },
      { id: 'tbsp', label: 'Tablespoons (US)', factor: 0.01478676478125 },
      { id: 'floz', label: 'Fluid ounces (US)', factor: 0.0295735295625 },
      { id: 'cup', label: 'Cups (US)', factor: 0.2365882365 },
      { id: 'gal', label: 'Gallons (US)', factor: 3.785411784 },
      { id: 'impgal', label: 'Gallons (UK)', factor: 4.54609 },
    ],
  },
  area: {
    label: 'Area',
    units: [
      { id: 'm2', label: 'Square metres', factor: 1 },
      { id: 'km2', label: 'Square kilometres', factor: 1e6 },
      { id: 'ha', label: 'Hectares', factor: 10000 },
      { id: 'ft2', label: 'Square feet', factor: 0.09290304 },
      { id: 'ac', label: 'Acres', factor: 4046.8564224 },
      { id: 'mi2', label: 'Square miles', factor: 2589988.110336 },
    ],
  },
  speed: {
    label: 'Speed',
    units: [
      { id: 'mps', label: 'Metres per second', factor: 1 },
      { id: 'kmh', label: 'Kilometres per hour', factor: 1 / 3.6 },
      { id: 'mph', label: 'Miles per hour', factor: 0.44704 },
      { id: 'kn', label: 'Knots', factor: 1852 / 3600 },
    ],
  },
  time: {
    label: 'Time',
    units: [
      { id: 's', label: 'Seconds', factor: 1 },
      { id: 'min', label: 'Minutes', factor: 60 },
      { id: 'h', label: 'Hours', factor: 3600 },
      { id: 'd', label: 'Days', factor: 86400 },
      { id: 'wk', label: 'Weeks', factor: 604800 },
    ],
  },
  data: {
    label: 'Data',
    units: [
      { id: 'B', label: 'Bytes', factor: 1 },
      { id: 'KB', label: 'Kilobytes (1000)', factor: 1e3 },
      { id: 'MB', label: 'Megabytes (1000²)', factor: 1e6 },
      { id: 'GB', label: 'Gigabytes (1000³)', factor: 1e9 },
      { id: 'KiB', label: 'Kibibytes (1024)', factor: 1024 },
      { id: 'MiB', label: 'Mebibytes (1024²)', factor: 1024 ** 2 },
      { id: 'GiB', label: 'Gibibytes (1024³)', factor: 1024 ** 3 },
    ],
  },
  temperature: {
    label: 'Temperature',
    units: [
      { id: 'C', label: 'Celsius', factor: 1 },
      { id: 'F', label: 'Fahrenheit', factor: 1 },
      { id: 'K', label: 'Kelvin', factor: 1 },
    ],
  },
};

function toKelvin(v: number, unit: string): number {
  if (unit === 'C') return v + 273.15;
  if (unit === 'F') return ((v - 32) * 5) / 9 + 273.15;
  return v;
}
function fromKelvin(k: number, unit: string): number {
  if (unit === 'C') return k - 273.15;
  if (unit === 'F') return ((k - 273.15) * 9) / 5 + 32;
  return k;
}

export function convert(value: number, category: string, from: string, to: string): number {
  const cat = UNIT_CATEGORIES[category];
  if (!cat) throw new Error('Unknown category');
  if (category === 'temperature') {
    const k = toKelvin(value, from);
    if (k < 0) throw new Error('Below absolute zero');
    return fromKelvin(k, to);
  }
  const f = cat.units.find((u) => u.id === from);
  const t = cat.units.find((u) => u.id === to);
  if (!f || !t) throw new Error('Unknown unit');
  return (value * f.factor) / t.factor;
}
