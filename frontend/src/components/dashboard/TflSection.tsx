import type { TflLineSummary } from '../../api/types';
import { TFL_LINE_COLOURS } from '../../data/tflLines';
import { SectionError } from './SectionCard';

function TflLineRow({ line }: { line: TflLineSummary }) {
  const colour = TFL_LINE_COLOURS[line.lineId] ?? '#666';
  const isGoodService = line.status.toLowerCase().includes('good service');
  return (
    <div className="flex items-start gap-3 py-2">
      <span
        className="mt-0.5 inline-block h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: colour, boxShadow: `0 0 0 2px ${colour}33` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{line.lineName}</span>
          <span
            className="text-xs font-medium"
            style={{ color: isGoodService ? 'var(--color-success)' : 'var(--color-warning)' }}
          >
            {line.status}
          </span>
        </div>
        {line.reason && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{line.reason}</p>
        )}
      </div>
    </div>
  );
}

export function TflSection({
  tfl,
  onRetry,
}: {
  tfl: { data?: TflLineSummary[]; error?: string };
  onRetry: () => void;
}) {
  if (tfl.error) {
    return <SectionError message={`TfL service error: ${tfl.error}`} onRetry={onRetry} />;
  }
  const lines = tfl.data ?? [];
  if (lines.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No TfL lines configured</p>;
  }
  return (
    <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
      {lines.map((line) => (
        <TflLineRow key={line.lineId} line={line} />
      ))}
    </div>
  );
}
