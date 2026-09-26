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

  // Sync display text when stationName prop changes (e.g. on edit) — set
  // during render, not in an effect, to avoid an extra commit per change.
  const [prevStationName, setPrevStationName] = useState(stationName);
  if (stationName !== prevStationName) {
    setPrevStationName(stationName);
    setQuery(stationName);
  }

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
      <label
        className="block text-sm font-medium mb-1"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}
      >
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        placeholder="Search station name or CRS code..."
        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-body)',
          '--tw-ring-color': 'var(--color-accent)',
        } as React.CSSProperties}
      />
      {isLoading && (
        <div className="absolute right-3 top-9 text-xs" style={{ color: 'var(--color-text-muted)' }}>...</div>
      )}
      {error && <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {isOpen && results.length > 0 && (
        <ul
          className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-dropdown)',
          }}
        >
          {results.map((s) => (
            <li
              key={s.crs}
              onClick={() => handleSelect(s)}
              className="cursor-pointer px-3 py-2 text-sm transition-colors"
              style={{ color: 'var(--color-text)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span className="font-medium">{s.name}</span>{' '}
              <span style={{ color: 'var(--color-text-muted)' }}>({s.crs})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
