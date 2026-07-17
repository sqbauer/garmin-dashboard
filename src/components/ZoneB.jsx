// Zone B — Cardiorespiratory & Chronic Load (The Engine)
import { useMemo } from 'react'
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts'
import { Card, Badge, Insight, InfoToggle, ChartTooltip, Empty, fmt } from './shared'
import { tsbPhase, tsbBarColor, rolling } from '../utils/sportsScience'

// ── Banister Fitness-Fatigue Model ────────────────────────────────────────────
// Two synchronized subplots:
//   Upper: CTL (blue fill) + ATL (amber line) — gap = accumulated fatigue
//   Lower: TSB bars (colored by phase, zero-anchored)

export function BanisterChart({ banister }) {
  const recent = banister?.slice(-1)[0]
  const phase  = tsbPhase(recent?.tsb)

  // Downsample to last 90 days for display
  const data = useMemo(() => (banister || []).slice(-90), [banister])

  if (!data.length) return <Empty message="Not enough activity data for Banister model" />

  return (
    <Card
      title="Fitness–Fatigue Model (Banister)"
      right={recent ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-300 tabular">TSB {recent.tsb > 0 ? '+' : ''}{recent.tsb}</span>
          <Badge label={phase.label} variant={phase.color} dot />
        </div>
      ) : null}
    >
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-0.5">Fitness (CTL)</div>
          <div className="text-3xl font-bold tabular text-slate-300">{fmt(recent?.ctl, 1)}</div>
        </div>
        <div>
          <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-0.5">Fatigue (ATL)</div>
          <div className="text-3xl font-bold tabular text-amber-300">{fmt(recent?.atl, 1)}</div>
        </div>
        <div>
          <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-0.5">Form (TSB)</div>
          <div className={`text-3xl font-bold tabular ${phase.color === 'pine' ? 'text-pine-300' : phase.color === 'amber' ? 'text-amber-300' : 'text-slate-300'}`}>
            {recent?.tsb != null ? (recent.tsb > 0 ? '+' : '') + recent.tsb : '—'}
          </div>
        </div>
      </div>

      {/* Upper subplot: CTL + ATL */}
      <div className="text-2xs text-ink-400 mb-1 font-semibold uppercase tracking-wider">
        Fitness (CTL) vs Fatigue (ATL) — 90 days
      </div>
      <div className="h-40 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gCTL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b5270" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#3b5270" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={13} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip
              content={({ active, payload, label }) => (
                <ChartTooltip active={active} payload={payload} label={label}
                  formatter={(v, n) => `${v} ${n === 'tss' ? 'TSS/day' : ''}`} />
              )}
            />
            {/* TSS daily bars — subtle backdrop */}
            <Bar dataKey="tss" fill="#1c2432" name="Daily TSS" yAxisId="right" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} hide />
            {/* CTL fill */}
            <Area type="monotone" dataKey="ctl" stroke="#6a8fba" strokeWidth={2}
              fill="url(#gCTL)" dot={false} name="CTL (fitness)" />
            {/* ATL line — rides on top of CTL; gap = fatigue */}
            <Line type="monotone" dataKey="atl" stroke="#c4961a" strokeWidth={2}
              dot={false} name="ATL (fatigue)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Lower subplot: TSB bars */}
      <div className="text-2xs text-ink-400 mb-1 font-semibold uppercase tracking-wider">
        Form (TSB) — training stress balance
      </div>
      <div className="h-32 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 0, left: -20, bottom: 0 }} barSize={3}>
            {/* Phase zones (reference areas) */}
            <defs>
              <pattern id="diagStripe" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                <line x1="0" y="0" x2="0" y2="4" stroke="#8b6914" strokeWidth="1" strokeOpacity="0.2" />
              </pattern>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={13} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 9 }} domain={[-50, 30]} />
            <ReferenceLine y={0} stroke="#3e5068" strokeWidth={1} />
            {/* Phase band annotations */}
            <ReferenceLine y={-30} stroke="#8b6914" strokeDasharray="3 3" strokeOpacity={0.4}
              label={{ value: 'Overreach', fill: '#8b6914', fontSize: 8, position: 'insideRight' }} />
            <ReferenceLine y={5} stroke="#3d6b55" strokeDasharray="3 3" strokeOpacity={0.4}
              label={{ value: 'Peak', fill: '#3d6b55', fontSize: 8, position: 'insideRight' }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                const ph = tsbPhase(d?.tsb)
                return (
                  <div className="bg-ink-800 border border-ink-600/50 rounded-lg px-3 py-2 text-xs shadow-xl">
                    <div className="text-ink-300 mb-1">{label}</div>
                    <div className="text-ink-50 font-semibold">TSB {d?.tsb > 0 ? '+' : ''}{d?.tsb}</div>
                    <div className={`font-semibold ${ph.color === 'pine' ? 'text-pine-300' : ph.color === 'amber' ? 'text-amber-300' : 'text-slate-300'}`}>
                      {ph.label}
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="tsb" name="TSB">
              {data.map((entry, i) => (
                <Cell key={i} fill={tsbBarColor(entry.tsb)} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {[
          { label: 'Race Ready',   range: '+5 to +25',  color: 'bg-pine-800  text-pine-300'  },
          { label: 'Productive',   range: '-30 to -10', color: 'bg-pine-900  text-pine-400'  },
          { label: 'Transitioning',range: '-10 to +5',  color: 'bg-slate-900 text-slate-300' },
          { label: 'Overreaching', range: '< -30',      color: 'bg-amber-950 text-amber-300' },
        ].map(z => (
          <div key={z.label} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border border-ink-600/30 text-xs ${z.color}`}>
            <span className="font-semibold">{z.label}</span>
            <span className="text-ink-400">({z.range})</span>
          </div>
        ))}
      </div>

      <InfoToggle summary="Banister model vs ACWR — why it matters">
        <strong>Fitness (CTL)</strong> uses a 42-day exponential decay — slower, like aerobic adaptation (mitochondria, stroke volume).
        <br /><br />
        <strong>Fatigue (ATL)</strong> uses a 7-day decay — faster, like neuromuscular and glycogen fatigue.
        <br /><br />
        <strong>Form (TSB = CTL − ATL)</strong> tells you what ACWR cannot: you can be <em>fit and buried</em> (TSB −20, productive training)
        or <em>fit and fresh</em> (TSB +15, race-ready). ACWR collapses these into the same number.
        <br /><br />
        The <strong>visual gap</strong> between the ATL line and the CTL fill in the upper chart <em>is</em> your accumulated fatigue — readable without axis labels.
      </InfoToggle>
    </Card>
  )
}

// ── VO2max & Aerobic Efficiency ───────────────────────────────────────────────
export function VO2Panel({ raw }) {
  const allActs = raw?.all_activities || []
  const RUN_TYPES = new Set(['running', 'treadmill_running', 'track_running', 'trail_running'])

  const { vo2Data, effData, aeSummary } = useMemo(() => {
    const runs = allActs
      .filter(a => RUN_TYPES.has(a.type) && a.avg_hr && a.avg_speed)
      .sort((a, b) => a.date.localeCompare(b.date))

    const vo2Pts = runs.filter(a => a.vo2max).map(a => ({
      date: a.date.slice(5),
      vo2:  Math.round(a.vo2max * 10) / 10,
    }))

    const vo2Vals = vo2Pts.map(p => p.vo2)
    const vo2Roll = rolling(vo2Vals, 5)
    const vo2Data = vo2Pts.map((p, i) => ({ ...p, roll: vo2Roll[i] ? Math.round(vo2Roll[i] * 10) / 10 : null }))

    const effPts = runs.filter(a => a.distance_m > 500).map(a => ({
      date: a.date.slice(5),
      eff:  Math.round(a.avg_speed / a.avg_hr * 10000) / 10,
    }))
    const effVals = effPts.map(p => p.eff)
    const effRoll = rolling(effVals, 5)
    const effData = effPts.map((p, i) => ({ ...p, roll: effRoll[i] ? Math.round(effRoll[i] * 10) / 10 : null }))

    const first5 = effVals.slice(0, 5).filter(Boolean)
    const last5  = effVals.slice(-5).filter(Boolean)
    const avgF   = first5.reduce((a, b) => a + b, 0) / (first5.length || 1)
    const avgL   = last5.reduce((a, b) => a + b, 0) / (last5.length || 1)
    const aeSummary = avgF > 0 ? (avgL - avgF) / avgF * 100 : 0

    return { vo2Data, effData, aeSummary }
  }, [allActs])

  const today = raw?.vo2max || {}

  return (
    <Card title="VO₂ max & Aerobic Efficiency">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-0.5">VO₂ max (running)</div>
          <div className="text-4xl font-bold tabular text-pine-300">{fmt(today.running, 1)}</div>
          <div className="text-xs text-ink-400">ml/kg/min</div>
        </div>
        {today.cycling && (
          <div>
            <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-0.5">VO₂ max (cycling)</div>
            <div className="text-4xl font-bold tabular text-slate-300">{fmt(today.cycling, 1)}</div>
            <div className="text-xs text-ink-400">ml/kg/min</div>
          </div>
        )}
      </div>

      {vo2Data.length > 3 && (
        <>
          <div className="text-2xs text-ink-400 mb-1 font-semibold uppercase tracking-wider">VO₂ max trend</div>
          <div className="h-32 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vo2Data} margin={{ top: 2, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(vo2Data.length / 6))} />
                <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                <Tooltip content={({ active, payload, label }) =>
                  <ChartTooltip active={active} payload={payload} label={label}
                    formatter={v => `${v} ml/kg/min`} />} />
                <Bar dataKey="vo2" fill="#3b5270" fillOpacity={0.4} name="VO₂ max" />
                <Line type="monotone" dataKey="roll" stroke="#6a8fba" strokeWidth={2.5}
                  dot={false} name="5-run avg" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {effData.length > 3 && (
        <>
          <div className="text-2xs text-ink-400 mb-1 font-semibold uppercase tracking-wider">
            Aerobic efficiency — speed ÷ HR
            {aeSummary !== 0 && (
              <span className={`ml-2 ${aeSummary > 3 ? 'text-pine-300' : aeSummary < -3 ? 'text-amber-300' : 'text-ink-400'}`}>
                ({aeSummary > 0 ? '+' : ''}{aeSummary.toFixed(1)}% vs baseline)
              </span>
            )}
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={effData} margin={{ top: 2, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(effData.length / 6))} />
                <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                <Tooltip content={({ active, payload, label }) =>
                  <ChartTooltip active={active} payload={payload} label={label}
                    formatter={v => `${v} (speed/HR ×10)`} />} />
                <Bar dataKey="eff" fill="#3d6b55" fillOpacity={0.35} name="Efficiency" />
                <Line type="monotone" dataKey="roll" stroke="#7abf95" strokeWidth={2.5}
                  dot={false} name="5-run avg" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Insight theme={aeSummary > 3 ? 'pine' : aeSummary < -3 ? 'amber' : 'neutral'}>
            Aerobic efficiency {aeSummary >= 0 ? '+' : ''}{aeSummary.toFixed(1)}% vs first runs in dataset.{' '}
            {aeSummary > 3
              ? 'Your cardiovascular system is covering more ground per heartbeat — aerobic base building.'
              : aeSummary < -3
              ? 'Efficiency declining — check for accumulated fatigue, heat, or significant altitude change.'
              : 'Stable — consistent but not yet showing clear adaptation trend.'}
          </Insight>
        </>
      )}

      <InfoToggle summary="How aerobic efficiency is calculated">
        <strong>Aerobic efficiency = average speed ÷ average heart rate</strong> for each run (×1000 for readability).
        <br /><br />
        A rising trend means you're covering more ground per heartbeat — the hallmark of aerobic adaptation.
        It's more honest than pace alone because pace varies with effort; this metric strips that out.
        <br /><br />
        <em>Confounding factors:</em> heat raises HR by ~1 bpm per °C above 20°C, hills increase HR without proportional speed gain,
        and illness suppresses efficiency before you feel unwell. Always compare same-conditions runs.
      </InfoToggle>
    </Card>
  )
}

// ── Zone B root ────────────────────────────────────────────────────────────────
export function ZoneB({ raw, banister }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <BanisterChart banister={banister} />
      <VO2Panel raw={raw} />
    </div>
  )
}
