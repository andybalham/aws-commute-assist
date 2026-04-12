export interface TflLine {
  id: string;
  name: string;
  colour: string;
}

export const TFL_LINES: readonly TflLine[] = [
  { id: 'bakerloo', name: 'Bakerloo', colour: '#B36305' },
  { id: 'central', name: 'Central', colour: '#E32017' },
  { id: 'circle', name: 'Circle', colour: '#FFD300' },
  { id: 'district', name: 'District', colour: '#00782A' },
  { id: 'elizabeth', name: 'Elizabeth', colour: '#6950A1' },
  { id: 'hammersmith-city', name: 'Hammersmith & City', colour: '#F3A9BB' },
  { id: 'jubilee', name: 'Jubilee', colour: '#A0A5A9' },
  { id: 'metropolitan', name: 'Metropolitan', colour: '#9B0056' },
  { id: 'northern', name: 'Northern', colour: '#000000' },
  { id: 'piccadilly', name: 'Piccadilly', colour: '#003688' },
  { id: 'victoria', name: 'Victoria', colour: '#0098D4' },
  { id: 'waterloo-city', name: 'Waterloo & City', colour: '#95CDBA' },
  { id: 'dlr', name: 'DLR', colour: '#00A4A7' },
  { id: 'london-overground', name: 'London Overground', colour: '#EE7C0E' },
  { id: 'tram', name: 'Tram', colour: '#84B817' },
] as const;

export const TFL_LINE_COLOURS: Record<string, string> = Object.fromEntries(
  TFL_LINES.map((l) => [l.id, l.colour])
);

export const TFL_LINE_NAMES: Record<string, string> = Object.fromEntries(
  TFL_LINES.map((l) => [l.id, l.name])
);
