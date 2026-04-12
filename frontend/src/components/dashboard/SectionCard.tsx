export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h2
        className="text-base font-semibold mb-3"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

export function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="rounded-lg border p-3 text-sm"
      style={{
        backgroundColor: 'var(--color-danger-soft)',
        borderColor: 'var(--color-danger)',
        color: 'var(--color-danger)',
      }}
    >
      {message}
      {onRetry && (
        <>
          {' '}
          <button onClick={onRetry} className="underline opacity-80 hover:opacity-100 cursor-pointer">
            Retry
          </button>
        </>
      )}
    </div>
  );
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-4 rounded skeleton-pulse ${className}`}
      style={{ backgroundColor: 'var(--color-bg-inset)' }}
    />
  );
}

export function RailSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function WeatherSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-inset)' }}>
          <SkeletonLine className="w-2/3" />
          <SkeletonLine className="w-1/2" />
          <SkeletonLine className="w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function TflSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full skeleton-pulse" style={{ backgroundColor: 'var(--color-bg-inset)' }} />
          <SkeletonLine className="flex-1" />
        </div>
      ))}
    </div>
  );
}
