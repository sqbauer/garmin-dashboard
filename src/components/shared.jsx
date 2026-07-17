// ── Shared primitives ─────────────────────────────────────────────────────────
import { useState } from 'react'

// Card — minimal surface with optional title and right-slot
export function Card({ title, right, children, className = '', padding = true }) {
  return (
    <div className={`bg-ink-750 rounded-xl border border-ink-600/40 ${padding ? 'p-4' : ''} ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xs font-bold tracking-widest uppercase text-ink-300">{title}</span>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

// MetricTile — a single large number with label and unit
export function MetricTile({ label, value, unit, sub, colorClass = '' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-bold tracking-widest uppercase text-ink-300">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-5xl font-bold tabular leading-none ${colorClass}`}>{value ?? '—'}</span>
        {unit && <span className="text-sm text-ink-300 font-medium">{unit}</span>}
      </div>
      {sub && <span className="text-xs text-ink-300 mt-0.5">{sub}</span>}
    </div>
  )
}

// Badge — colored status chip
const BADGE_STYLES = {
  pine:   'bg-pine-900/60 text-pine-300 border-pine-700/40',
  amber:  'bg-amber-900/60 text-amber-300 border-amber-700/40',
  slate:  'bg-slate-900/60 text-slate-300 border-slate-700/40',
  good:   'bg-pine-900/60 text-pine-300 border-pine-700/40',
  warn:   'bg-amber-900/60 text-amber-300 border-amber-700/40',
  neutral:'bg-ink-700/60 text-ink-200 border-ink-600/40',
}

export function Badge({ label, variant = 'neutral', dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${BADGE_STYLES[variant] || BADGE_STYLES.neutral}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {label}
    </span>
  )
}

// Stat row — key/value pair
export function StatRow({ label, value, unit }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 border-b border-ink-600/20 last:border-0">
      <span className="text-xs text-ink-300">{label}</span>
      <span className="text-xs font-semibold tabular text-ink-100">
        {value ?? '—'}{unit ? <span className="text-ink-300 font-normal ml-0.5">{unit}</span> : null}
      </span>
    </div>
  )
}

// Divider
export function Divider({ className = '' }) {
  return <div className={`h-px bg-ink-600/30 my-1 ${className}`} />
}

// Section label
export function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-2xs font-bold tracking-widest uppercase text-ink-400">{children}</span>
      <div className="flex-1 h-px bg-ink-600/30" />
    </div>
  )
}

// Tooltip wrapper for charts
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ink-800 border border-ink-600/50 rounded-lg px-3 py-2 shadow-xl text-xs">
      {label && <div className="text-ink-300 mb-1 font-medium">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-ink-300">{p.name}:</span>
          <span className="text-ink-50 font-semibold tabular">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// Info expandable
export function InfoToggle({ summary, children }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-200 transition-colors w-full text-left"
      >
        <span className={`transition-transform duration-150 text-[9px] ${isOpen ? 'rotate-90' : ''}`}>▶</span>
        {summary}
      </button>
      {isOpen && (
        <div className="mt-2 pl-3 border-l border-ink-600/40 text-xs text-ink-300 leading-relaxed animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

// Empty state
export function Empty({ message = 'No data available' }) {
  return (
    <div className="flex items-center justify-center h-24 text-xs text-ink-400 italic">{message}</div>
  )
}

// Insight bar — contextual, left-border colored
const INSIGHT_STYLES = {
  pine:    'border-pine-500  bg-pine-950/60 text-pine-200',
  amber:   'border-amber-500 bg-amber-950/60 text-amber-200',
  slate:   'border-slate-500 bg-slate-950/60 text-slate-200',
  neutral: 'border-ink-500  bg-ink-800/60 text-ink-200',
}

export function Insight({ children, theme = 'neutral' }) {
  return (
    <div className={`border-l-2 px-3 py-2 rounded-r-lg text-xs leading-relaxed ${INSIGHT_STYLES[theme] || INSIGHT_STYLES.neutral}`}>
      {children}
    </div>
  )
}

// Fmt helpers (exported so components don't need to import sportsScience just for display)
export const fmt  = (v, d = 0) => v == null ? '—' : Number(v).toLocaleString('en', { maximumFractionDigits: d })
export const fmtPct = v => v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`
