// Socratic Performance Coach + Hypothesis Builder + Manual Annotations
import { useState, useMemo, useCallback } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, Empty, fmt } from './shared'
import { pearson, paceStr, paceNum } from '../utils/sportsScience'
import { ChevronDown, MessageSquare, FlaskConical, PenLine, X, Plus } from 'lucide-react'

const THEME_STYLES = {
  pine:   'border-pine-600/40 bg-pine-950/50',
  amber:  'border-amber-600/40 bg-amber-950/50',
  slate:  'border-slate-600/40 bg-slate-950/50',
  neutral:'border-ink-600/30 bg-ink-800/40',
}

// ── Socratic Coach ────────────────────────────────────────────────────────────
function CoachQuestions({ questions }) {
  const [expanded, setExpanded] = useState(new Set([0]))

  if (!questions?.length) return (
    <div className="text-xs text-ink-400 italic px-1">
      Not enough data yet to generate questions. Sync more days of training.
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => setExpanded(prev => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
          })}
          className={`text-left w-full border rounded-xl px-3.5 py-3 transition-all ${THEME_STYLES[q.theme] || THEME_STYLES.neutral}`}
        >
          <div className="flex items-start gap-2.5">
            <span className="text-base flex-shrink-0 mt-0.5">{q.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs leading-relaxed ${expanded.has(i) ? 'text-ink-100' : 'text-ink-200 line-clamp-2'}`}>
                {q.question}
              </p>
              {!expanded.has(i) && (
                <span className="text-2xs text-ink-400 mt-1 block">Tap to expand</span>
              )}
            </div>
          </div>
        </button>
      ))}
      <p className="text-2xs text-ink-500 italic px-1 leading-relaxed">
        Questions are generated from your physiological patterns, not medical advice.
        They are designed to prompt self-reflection, not prescription.
      </p>
    </div>
  )
}

// ── Hypothesis Builder ────────────────────────────────────────────────────────
const METRICS = [
  { id: 'sleep_score',   label: 'Sleep score',           fn: (raw) => (raw?.history?.sleep || []).map(s => ({ date: s.date, v: s.score })) },
  { id: 'sleep_total_h', label: 'Sleep total (h)',        fn: (raw) => (raw?.history?.sleep || []).map(s => ({ date: s.date, v: s.total_s ? s.total_s / 3600 : null })) },
  { id: 'sleep_deep_pct',label: 'Deep sleep %',           fn: (raw) => (raw?.history?.sleep || []).map(s => ({ date: s.date, v: s.total_s ? s.deep_s / s.total_s * 100 : null })) },
  { id: 'hrv',           label: 'HRV (nightly)',          fn: (raw) => (raw?.history?.hrv || []).map(h => ({ date: h.date, v: h.value })) },
  { id: 'resting_hr',    label: 'Resting HR',             fn: (raw) => (raw?.history?.resting_hr || []).map(h => ({ date: h.date, v: h.value })) },
  { id: 'run_pace',      label: 'Next-day run pace (m/s)',fn: (raw) => (raw?.all_activities || []).filter(a => ['running','treadmill_running','track_running','trail_running'].includes(a.type)).map(a => ({ date: a.date, v: a.avg_speed })) },
  { id: 'run_eff',       label: 'Run aerobic efficiency', fn: (raw) => (raw?.all_activities || []).filter(a => ['running','treadmill_running','track_running','trail_running'].includes(a.type) && a.avg_hr && a.avg_speed).map(a => ({ date: a.date, v: a.avg_speed / a.avg_hr * 1000 })) },
  { id: 'body_battery',  label: 'Body Battery peak',      fn: (raw) => (raw?.history?.body_battery || []).map(e => ({ date: e.date, v: e.high })) },
]

function HypothesisBuilder({ raw }) {
  const [xId, setXId] = useState('sleep_score')
  const [yId, setYId] = useState('run_eff')
  const [lag, setLag] = useState(1)   // Y is lagged by N days after X

  const { pts, r } = useMemo(() => {
    const xMeta = METRICS.find(m => m.id === xId)
    const yMeta = METRICS.find(m => m.id === yId)
    if (!xMeta || !yMeta) return { pts: [], r: null }

    const xArr = xMeta.fn(raw).filter(d => d.v != null)
    const yArr = yMeta.fn(raw).filter(d => d.v != null)

    const xMap = Object.fromEntries(xArr.map(d => [d.date, d.v]))
    const yMap = Object.fromEntries(yArr.map(d => [d.date, d.v]))

    const pts = []
    xArr.forEach(({ date, v: xv }) => {
      // Find Y value N days after X date
      const yDate = new Date(date)
      yDate.setDate(yDate.getDate() + lag)
      const yv = yMap[yDate.toISOString().slice(0, 10)]
      if (yv != null) pts.push({ x: xv, y: yv, date })
    })

    if (pts.length < 3) return { pts, r: null }
    const r = pearson(pts.map(p => p.x), pts.map(p => p.y))
    return { pts, r }
  }, [raw, xId, yId, lag])

  const rColor = r == null ? 'text-ink-400'
    : Math.abs(r) > 0.5 ? (r > 0 ? 'text-pine-300' : 'text-amber-300')
    : 'text-ink-300'

  const xMeta = METRICS.find(m => m.id === xId)
  const yMeta = METRICS.find(m => m.id === yId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-1 block">X — predictor</label>
            <select
              value={xId} onChange={e => setXId(e.target.value)}
              className="w-full bg-ink-700 border border-ink-600/50 rounded-lg px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-slate-500"
            >
              {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-1 block">Y — outcome (+{lag}d lag)</label>
            <select
              value={yId} onChange={e => setYId(e.target.value)}
              className="w-full bg-ink-700 border border-ink-600/50 rounded-lg px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-slate-500"
            >
              {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-2xs text-ink-400 uppercase font-bold tracking-wider">Lag (days):</label>
          {[0, 1, 2].map(l => (
            <button key={l}
              onClick={() => setLag(l)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${lag === l ? 'bg-slate-700 text-slate-100' : 'text-ink-400 hover:text-ink-200'}`}
            >
              {l}d
            </button>
          ))}
        </div>
      </div>

      {pts.length > 3 ? (
        <>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 4, right: 8, left: -8, bottom: 16 }}>
                <XAxis dataKey="x" type="number" tick={{ fontSize: 9 }}
                  label={{ value: xMeta?.label, position: 'insideBottom', offset: -10, fontSize: 9, fill: '#56697e' }} />
                <YAxis dataKey="y" type="number" tick={{ fontSize: 9 }}
                  label={{ value: yMeta?.label, angle: -90, position: 'insideLeft', offset: 14, fontSize: 9, fill: '#56697e' }} />
                <ZAxis range={[30, 50]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-ink-800 border border-ink-600/50 rounded-lg px-3 py-2 text-xs shadow-xl">
                        <div className="text-ink-300 mb-1">{d.date}</div>
                        <div className="text-ink-50">{xMeta?.label}: <span className="font-semibold">{fmt(d.x, 1)}</span></div>
                        <div className="text-ink-50">{yMeta?.label} (+{lag}d): <span className="font-semibold">{fmt(d.y, 2)}</span></div>
                      </div>
                    )
                  }}
                />
                <Scatter data={pts} fill="#6a8fba" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-400">Pearson r =</span>
            <span className={`text-sm font-bold tabular ${rColor}`}>{r != null ? r.toFixed(2) : '—'}</span>
            <span className="text-xs text-ink-500">
              ({pts.length} points — {Math.abs(r || 0) > 0.5 ? 'moderate to strong' : Math.abs(r || 0) > 0.3 ? 'weak' : 'negligible'} correlation)
            </span>
          </div>
          <p className="text-2xs text-ink-500 italic leading-relaxed">
            Correlation ≠ causation. N={pts.length} is small. Treat r as a hypothesis signal, not a finding.
          </p>
        </>
      ) : <Empty message={`Not enough overlapping data (${pts.length} pairs)`} />}
    </div>
  )
}

// ── Manual Annotations ────────────────────────────────────────────────────────
const ANNOTATION_TAGS = [
  'High work stress', 'Poor nutrition', 'Alcohol', 'Altitude',
  'Illness onset', 'Late meal', 'Heat', 'Travel/jet lag', 'Overreaching (planned)', 'Great feeling',
]

function Annotations() {
  const [annotations, setAnnotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('garmin_annotations') || '[]') }
    catch { return [] }
  })
  const [date, setDate]  = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote]  = useState('')
  const [tags, setTags]  = useState([])

  const save = useCallback(() => {
    if (!date) return
    const ann = { id: Date.now(), date, note, tags, createdAt: new Date().toISOString() }
    const next = [ann, ...annotations].slice(0, 50)  // cap at 50
    setAnnotations(next)
    localStorage.setItem('garmin_annotations', JSON.stringify(next))
    setNote(''); setTags([])
  }, [date, note, tags, annotations])

  const remove = useCallback(id => {
    const next = annotations.filter(a => a.id !== id)
    setAnnotations(next)
    localStorage.setItem('garmin_annotations', JSON.stringify(next))
  }, [annotations])

  const toggleTag = t => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-ink-700/40 rounded-xl p-3 flex flex-col gap-2 border border-ink-600/30">
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bg-ink-700 border border-ink-600/50 rounded-lg px-2 py-1.5 text-xs text-ink-100 outline-none flex-shrink-0" />
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Optional note…"
            className="flex-1 bg-ink-700 border border-ink-600/50 rounded-lg px-2 py-1.5 text-xs text-ink-100 placeholder-ink-500 outline-none" />
        </div>
        <div className="flex flex-wrap gap-1">
          {ANNOTATION_TAGS.map(t => (
            <button key={t} onClick={() => toggleTag(t)}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${tags.includes(t) ? 'bg-slate-800 border-slate-600 text-slate-200' : 'border-ink-600/40 text-ink-400 hover:text-ink-200'}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={save}
          className="self-end flex items-center gap-1.5 px-3 py-1.5 bg-pine-800 hover:bg-pine-700 border border-pine-700/50 rounded-lg text-xs text-pine-100 font-semibold transition-colors">
          <Plus size={11} /> Add marker
        </button>
      </div>

      {annotations.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {annotations.slice(0, 10).map(a => (
            <div key={a.id} className="flex items-start gap-2 bg-ink-700/30 rounded-lg px-2.5 py-2 border border-ink-600/20 group">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-ink-300 tabular">{a.date}</div>
                {a.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.tags.map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-slate-900/60 rounded text-2xs text-slate-300 border border-slate-700/30">{t}</span>
                    ))}
                  </div>
                )}
                {a.note && <p className="text-xs text-ink-400 mt-1">{a.note}</p>}
              </div>
              <button onClick={() => remove(a.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-500 hover:text-amber-400 mt-0.5">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-500 italic">No annotations yet. Tag qualitative events that Garmin can't track — life stress, altitude, illness.</p>
      )}
    </div>
  )
}

// ── Coach Panel root ──────────────────────────────────────────────────────────
export function CoachPanel({ coachQs, raw }) {
  const [tab, setTab] = useState('coach')

  const TABS = [
    { id: 'coach',  label: 'Coach',      Icon: MessageSquare },
    { id: 'hypo',   label: 'Hypotheses', Icon: FlaskConical  },
    { id: 'notes',  label: 'Notes',      Icon: PenLine       },
  ]

  return (
    <div className="bg-ink-800/80 border border-ink-600/30 rounded-2xl flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-ink-600/30">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors
              ${tab === id ? 'text-pine-300 border-b-2 border-pine-500' : 'text-ink-400 hover:text-ink-200'}`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'coach' && (
          <>
            <p className="text-xs text-ink-400 mb-3 leading-relaxed">
              Based on today's physiological snapshot — questions to reflect on, not verdicts.
            </p>
            <CoachQuestions questions={coachQs} />
          </>
        )}
        {tab === 'hypo' && (
          <>
            <p className="text-xs text-ink-400 mb-3 leading-relaxed">
              Select two metrics and a time lag to test a hypothesis. Does better sleep predict higher next-day efficiency?
            </p>
            <HypothesisBuilder raw={raw} />
          </>
        )}
        {tab === 'notes' && (
          <>
            <p className="text-xs text-ink-400 mb-3 leading-relaxed">
              Tag qualitative variables Garmin can't measure — high work stress, alcohol, altitude, illness.
            </p>
            <Annotations />
          </>
        )}
      </div>
    </div>
  )
}
