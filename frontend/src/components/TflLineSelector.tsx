import { TFL_LINES } from '../data/tflLines';

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
      <label
        className="block text-sm font-medium mb-2"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}
      >
        TfL Lines to Monitor
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TFL_LINES.map((line) => {
          const isSelected = selected.includes(line.id);
          return (
            <label
              key={line.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all"
              style={{
                borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                backgroundColor: isSelected ? 'var(--color-accent-soft)' : 'var(--color-bg-card)',
                color: 'var(--color-text)',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(line.id)}
                className="sr-only"
              />
              <span
                className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: line.colour,
                  boxShadow: isSelected ? `0 0 0 2px var(--color-bg-card), 0 0 0 3px ${line.colour}` : 'none',
                }}
              />
              <span>{line.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
