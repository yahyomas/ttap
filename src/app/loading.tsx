/** Shown instantly on navigation while the server renders the next page. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between border-b border-border py-4">
        <div className="h-6 w-40 animate-pulse rounded bg-border/60" />
        <div className="hidden gap-2 sm:flex">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-7 w-20 animate-pulse rounded-lg bg-border/40" />)}
        </div>
      </div>
      <div className="py-6">
        <div className="mb-6 h-8 w-56 animate-pulse rounded bg-border/60" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}
        </div>
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-border/30" />)}
        </div>
      </div>
    </div>
  );
}
