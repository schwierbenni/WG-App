export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left panel — decorative, desktop only */}
      <div
        className="hidden lg:flex lg:w-[420px] lg:shrink-0 lg:flex-col lg:justify-between p-10 relative overflow-hidden"
        style={{ background: 'var(--sidebar-bg)' }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-10"
          style={{ background: 'var(--brand-500)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-32 -left-16 h-48 w-48 rounded-full opacity-10"
          style={{ background: 'var(--accent-500)' }}
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-8 right-8 h-36 w-36 rounded-full opacity-5"
          style={{ background: 'var(--brand-500)' }}
          aria-hidden="true"
        />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
              style={{ background: 'var(--brand-600)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>
            <span
              className="text-xl font-extrabold text-white"
              style={{ fontFamily: 'var(--font-syne, system-ui)' }}
            >
              FlatMate
            </span>
          </div>
          <h2
            className="text-3xl font-extrabold text-white leading-tight mb-3"
            style={{ fontFamily: 'var(--font-syne, system-ui)' }}
          >
            Deine WG.<br />Organisiert.
          </h2>
          <p className="text-[var(--sidebar-text)] text-base leading-relaxed">
            Dienste, Ausgaben, Einkaufslisten — alles an einem Ort.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-4">
          {[
            { emoji: '✅', label: 'Dienste & Aufgaben verwalten' },
            { emoji: '💰', label: 'Ausgaben fair aufteilen' },
            { emoji: '🛒', label: 'Einkaufslisten teilen' },
            { emoji: '📢', label: 'Schwarzes Brett für alle' },
          ].map(({ emoji, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xl">{emoji}</span>
              <span className="text-sm font-medium text-[var(--sidebar-text)]">{label}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-[var(--sidebar-text)] opacity-40">
          © {new Date().getFullYear()} FlatMate
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile brand */}
        <div className="mb-8 lg:hidden text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--brand-600)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>
            <span
              className="text-2xl font-extrabold text-brand-600"
              style={{ fontFamily: 'var(--font-syne, system-ui)' }}
            >
              FlatMate
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">WG-Verwaltung leicht gemacht</p>
        </div>

        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
