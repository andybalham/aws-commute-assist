const TFL_LINES = [
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

// London terminus CRS codes where TfL lines are relevant
const LONDON_TERMINI = new Set([
  'BFR', // London Blackfriars
  'CST', // London Cannon Street
  'CHX', // London Charing Cross
  'CTK', // City Thameslink
  'EUS', // London Euston
  'FST', // London Fenchurch Street
  'KGX', // London Kings Cross
  'LST', // London Liverpool Street
  'LBG', // London Bridge
  'MYB', // London Marylebone
  'MOG', // Moorgate
  'OLD', // Old Street
  'PAD', // London Paddington
  'STP', // London St Pancras International
  'VIC', // London Victoria
  'WAT', // London Waterloo
  'WAE', // London Waterloo East
]);

export function isLondonTerminus(crs: string): boolean {
  return LONDON_TERMINI.has(crs.toUpperCase());
}

interface TflLineSelectorProps {
  selected: string[];
  onChange: (lines: string[]) => void;
}

export function TflLineSelector({ selected, onChange }: TflLineSelectorProps) {
  function toggle(lineId: string) {
    if (selected.includes(lineId)) {
      onChange(selected.filter((id) => id !== lineId));
    } else {
      onChange([...selected, lineId]);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">TfL Lines to Monitor</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TFL_LINES.map((line) => (
          <label
            key={line.id}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
              selected.includes(line.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(line.id)}
              onChange={() => toggle(line.id)}
              className="sr-only"
            />
            <span
              className="inline-block h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: line.colour }}
            />
            <span>{line.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
