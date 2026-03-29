import { useState, useRef, useEffect, useCallback } from 'react';
import { searchStations } from '../api/profilesApi';
import type { StationMatch } from '../api/types';

interface StationAutocompleteProps {
  label: string;
  value: string;
  stationName: string;
  onChange: (crs: string, name: string) => void;
  error?: string;
}

export function StationAutocomplete({
  label,
  value,
  stationName,
  onChange,
  error,
}: StationAutocompleteProps) {
  const [query, setQuery] = useState(stationName);
  const [results, setResults] = useState<StationMatch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display text when stationName prop changes (e.g. on edit)
  useEffect(() => {
    setQuery(stationName);
  }, [stationName]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const matches = await searchStations(q);
      setResults(matches);
      setIsOpen(matches.length > 0);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleInput(text: string) {
    setQuery(text);
    // Clear selected value when user types
    if (value) {
      onChange('', '');
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(text), 300);
  }

  function handleSelect(station: StationMatch) {
    setQuery(`${station.name} (${station.crs})`);
    onChange(station.crs, station.name);
    setIsOpen(false);
    setResults([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        placeholder="Search station name or CRS code..."
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
      />
      {isLoading && (
        <div className="absolute right-3 top-9 text-xs text-gray-400">...</div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {isOpen && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {results.map((s) => (
            <li
              key={s.crs}
              onClick={() => handleSelect(s)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
            >
              <span className="font-medium">{s.name}</span>{' '}
              <span className="text-gray-400">({s.crs})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
