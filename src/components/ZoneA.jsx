// Zone A — Epistemic Recovery & Readiness (The Daily Pulse)
import { useMemo } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts'
import { Card, MetricTile, Badge, StatRow, Insight, InfoToggle, ChartTooltip, Empty, fmt } from './shared'
import { rolling, stddev, hrvBaseline, durStr } from '../utils/sportsScience'

// ── HRV Panel ─────────────────────────────────────────────────────────────────
export function HRVPanel({ raw }) {
  const histHRV = raw?.history?.hrv || []

  const { chartData, baseline, trend } = useMemo(() => {
    if (histHRV.length < 7) return { chartData: [], baseline: null, trend: null }
    const vals   = histHRV.map(h => h.value)
    const roll7  = rolling(vals, 7)
    const bl     = hrvBaseline(histHRV)
    const last7  = vals.slice(-7).filter(Boolean)
    const prev7  = vals.slice(-14, -7).filter(Boolean)
    const avgNow = last7.reduce((a, b) => a + b, 0) / (last7.length || 1)
    const avgPrev = prev7.reduce((a, b) => a + b, 0) / (prev7.length || 1)
    return {
      chartData: histHRV.map((h, i) => ({
        date: h.date.slice(5),
        hrv: h.value,
        roll7: roll7[i] ? Math.round(roll7[i] * 10) / 10 : null,
      })),
      baseline: bl,
      trend: { delta: avgNow - avgPrev, now: avgNow },
    }
  }, [histHRV])

  const hrv      = raw?.hrv || {}
  const hrvNow   = hrv.last_night || raw?.sleep?.hrv_last_night
  const hrvAvg   = hrv.weekly_avg  || raw?.sleep?.hrv_5day
  const status   = (hrv.status || raw?.sleep?.hrv_status || '').toLowerCase()
  const variant  = status.includes('balanced') || status.includes('good') ? 'pine'
                 : status.includes('low') || status.includes('unbal')     ? 'amber'
                 : 'slate'

  const deviationPct = baseline
    ? ((hrvNow - baseline.mean) / baseline.mean * 100)
    : null

  return (
    <Card
      title="HRV — Autonomic Balance"
      right={status ? <Badge label={status} variant={variant} dot /> : null}
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <MetricTile
          label="Last night"
          value={fmt(hrvNow)}
          unit="ms"
          sub={baseline && deviationPct != null
            ? `${deviationPct > 0 ? '+' : ''}${deviationPct.toFixed(0)}% vs baseline`
            : undefined}
          colorClass={deviationPct == null ? '' : deviationPct < -8 ? 'text-amber-300' : deviationPct > 8 ? 'text-pine-300' : 'text-ink-50'}
        />
        <MetricTile
          label="7-day avg"
          value={fmt(hrvAvg)}
          unit="ms"
          sub={baseline ? `Baseline ${baseline.mean} ± ${baseline.sd}` : undefined}
        />
      </div>

      {chartData.length > 7 ? (
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gHRV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b5270" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b5270" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={14} />
              <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
              {/* ±1 SD reference band */}
              {baseline && (
                <ReferenceArea
                  y1={baseline.mean - baseline.sd}
                  y2={baseline.mean + baseline.sd}
                  fill="#3b5270" fillOpacity={0.12}
                  strokeDasharray="3 3" stroke="#3b5270" strokeOpacity={0.3}
                />
              )}
              {baseline && <ReferenceLine y={baseline.mean} stroke="#3b5270" strokeDasharray="4 2" strokeOpacity={0.5} />}
              <Tooltip
                content={({ active, payload, label }) => (
                  <ChartTooltip
                    active={active} payload={payload} label={label}
                    formatter={(v, n) => n === 'hrv' ? `${v} ms (raw)` : `${v} ms (7d avg)`}
                  />
                )}
              />
              <Area type="monotone" dataKey="hrv" stroke="#3b527080" strokeWidth={1}
                fill="url(#gHRV)" dot={false} name="hrv" />
              <Line type="monotone" dataKey="roll7" stroke="#6a8fba" strokeWidth={2}
                dot={false} name="7d avg" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : <Empty message="Need 7+ days of HRV data" />}

      {trend && (
        <Insight theme={trend.delta > 2 ? 'pine' : trend.delta < -2 ? 'amber' : 'neutral'}>
          7-day avg {trend.delta >= 0 ? '↑' : '↓'} {Math.abs(trend.delta).toFixed(1)} ms vs previous week.{' '}
          {trend.delta > 2 ? 'Recovery trending upward.' : trend.delta < -2 ? 'Autonomic stress accumulating.' : 'Stable.'}
          {baseline && ` Personal baseline: ${baseline.mean} ms.`}
        </Insight>
      )}

      <InfoToggle summary="Why relative HRV matters more than absolute">
        HRV is highly individual — a reading of 40 ms can be low for one person and high for another.
        The <strong>shaded band</strong> on the chart = ±1 standard deviation of your personal 90-day baseline.
        A reading within that band = autonomic equilibrium. Below it = parasympathetic suppression (stress, fatigue, illness).
        Above it = supercompensation or unusually low stress load.
      </InfoToggle>
    </Card>
  )
}

// ── Sleep Architecture ────────────────────────────────────────────────────────
export function SleepPanel({ raw }) {
  const sleep = raw?.sleep || {}
  const histSleep = raw?.history?.sleep || []

  const { stages, sleepDebt, trendData } = useMemo(() => {
    const total = sleep.total_s || 0
    const deep  = sleep.deep_s  || 0
    const rem   = sleep.rem_s   || 0
    const light = sleep.light_s || 0
    const awake = sleep.awake_s || 0

    const TARGET_S = 7 * 3600
    const debt = total ? Math.max(0, TARGET_S - total) : null

    // Stacked bar percentages
    const stages = total ? [
      { label: 'Deep',  seconds: deep,  pct: deep / total,  color: '#3d6b55', textColor: 'text-pine-300' },
      { label: 'REM',   seconds: rem,   pct: rem  / total,  color: '#3b5270', textColor: 'text-slate-300' },
      { label: 'Light', seconds: light, pct: light / total, color: '#243654', textColor: 'text-ink-300' },
      { label: 'Awake', seconds: awake, pct: awake / total, color: '#1c2432', textColor: 'text-ink-400' },
    ] : []

    const trendData = histSleep.slice(-30).map(s => ({
      date:    s.date.slice(5),
      total_h: s.total_s ? Math.round(s.total_s / 360) / 10 : 0,
      deep_h:  s.deep_s  ? Math.round(s.deep_s  / 360) / 10 : 0,
      score:   s.score,
    }))

    return { stages, sleepDebt: debt, trendData }
  }, [sleep, histSleep])

  const hm = s => { if (!s) return '—'; return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m` }
  const scoreV = s => s >= 80 ? 'pine' : s >= 50 ? 'amber' : s != null ? 'amber' : 'neutral'

  return (
    <Card
      title={`Sleep Architecture · ${sleep.date || '—'}`}
      right={sleep.score != null ? <Badge label={sleep.score} variant={scoreV(sleep.score)} /> : null}
    >
      <div className="mb-3">
        <div className="text-5xl font-bold tabular text-ink-50 leading-none mb-0.5">
          {hm(sleep.total_s)}
        </div>
        <div className="text-xs text-ink-300">
          {sleep.avg_spo2 ? `SpO₂ avg ${fmt(sleep.avg_spo2, 0)}%` : ''}
          {sleep.avg_spo2 && sleep.avg_respiration ? ' · ' : ''}
          {sleep.avg_respiration ? `${fmt(sleep.avg_respiration, 1)} brpm` : ''}
          {sleepDebt ? ` · ~${hm(sleepDebt)} sleep debt` : ''}
        </div>
      </div>

      {/* Horizontal stacked bar */}
      {stages.length > 0 && (
        <div className="mb-3">
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {stages.map(s => (
              <div
                key={s.label}
                style={{ flex: s.pct, background: s.color, minWidth: s.pct > 0.01 ? 2 : 0 }}
                title={`${s.label}: ${hm(s.seconds)} (${(s.pct*100).toFixed(0)}%)`}
              />
            ))}
          </div>
          <div className="flex gap-3 mt-2 flex-wrap">
            {stages.map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                <span className={`text-xs ${s.textColor}`}>{s.label} {hm(s.seconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 30-day trend */}
      {trendData.length > 7 && (
        <div className="h-24 mt-3">
          <div className="text-2xs text-ink-400 mb-1 font-semibold uppercase tracking-wider">30-day trend</div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="gSleepDeep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3d6b55" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3d6b55" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSleepTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b5270" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b5270" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={7} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 10]} unit="h" />
              <ReferenceLine y={7} stroke="#3b5270" strokeDasharray="3 2" strokeOpacity={0.6} />
              <Tooltip
                content={({ active, payload, label }) => (
                  <ChartTooltip active={active} payload={payload} label={label}
                    formatter={(v, n) => `${v}h`} />
                )}
              />
              <Area type="monotone" dataKey="total_h" stroke="#3b5270" strokeWidth={1.5}
                fill="url(#gSleepTotal)" dot={false} name="Total" />
              <Area type="monotone" dataKey="deep_h" stroke="#3d6b55" strokeWidth={1.5}
                fill="url(#gSleepDeep)" dot={false} name="Deep" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <InfoToggle summary="Why deep sleep matters most for athletes">
        <strong>Deep sleep (N3)</strong> is when growth hormone peaks (~90% of daily release), muscle protein synthesis
        occurs, and glycogen stores are replenished. Athletes need ≥1.5h (≥15% of total) for full physical recovery.
        <br /><br />
        <strong>REM sleep</strong> consolidates motor patterns and emotional regulation — essential for technique and motivation.
        <br /><br />
        The <strong>blue reference line</strong> = 7h target. Chronic sub-7h sleep is associated with 1.7× higher injury risk.
      </InfoToggle>
    </Card>
  )
}

// ── Body Battery & Stress ─────────────────────────────────────────────────────
export function StressPanel({ raw }) {
  const daily   = raw?.daily || {}
  const bbHist  = raw?.history?.body_battery || []

  const chartData = useMemo(() => (
    bbHist.filter(e => e.high != null || e.low != null).slice(-30).map(e => ({
      date: e.date?.slice(5) || '',
      high: e.high,
      low:  e.low,
      range: e.high != null && e.low != null ? e.high - e.low : null,
    }))
  ), [bbHist])

  const avgRange = chartData.filter(d => d.range != null).slice(-7)
    .reduce((acc, d, _, arr) => acc + d.range / arr.length, 0)

  return (
    <Card title="Body Battery & Daily Stress">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-1">BB Peak</div>
          <div className="text-4xl font-bold tabular text-pine-300">{fmt(daily.body_battery_high)}</div>
          <div className="text-xs text-ink-400">/ 100</div>
        </div>
        <div>
          <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-1">BB Low</div>
          <div className="text-4xl font-bold tabular text-amber-300">{fmt(daily.body_battery_low)}</div>
          <div className="text-xs text-ink-400">/ 100</div>
        </div>
        <div>
          <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-1">Stress avg</div>
          <div className="text-4xl font-bold tabular text-ink-100">{fmt(daily.stress_avg)}</div>
          <div className="text-xs text-ink-400">/ 100</div>
        </div>
      </div>

      {chartData.length > 7 ? (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gBBHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3d6b55" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3d6b55" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gBBLow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b6914" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b6914" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={7} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
              <ReferenceLine y={50} stroke="#2e3d52" strokeDasharray="3 2" />
              <Tooltip
                content={({ active, payload, label }) =>
                  <ChartTooltip active={active} payload={payload} label={label} formatter={v => `${v}`} />}
              />
              <Area type="monotone" dataKey="high" stroke="#3d6b55" strokeWidth={1.5}
                fill="url(#gBBHigh)" dot={false} name="Peak" />
              <Area type="monotone" dataKey="low" stroke="#8b6914" strokeWidth={1.5}
                fill="url(#gBBLow)" dot={false} name="Low" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : <Empty />}

      {avgRange > 0 && (
        <Insight theme={avgRange > 50 ? 'pine' : avgRange > 30 ? 'neutral' : 'amber'}>
          7-day average daily range: {Math.round(avgRange)} points.{' '}
          {avgRange > 50 ? 'Strong daily recovery — sleep is restoring well.' : avgRange < 30 ? 'Narrow range suggests chronic stress without full overnight recovery.' : 'Moderate daily recovery cycle.'}
        </Insight>
      )}
    </Card>
  )
}

// ── Zone A root ────────────────────────────────────────────────────────────────
export function ZoneA({ raw }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <HRVPanel raw={raw} />
        </div>
        <SleepPanel raw={raw} />
      </div>
      <div className="lg:col-span-2">
        <StressPanel raw={raw} />
      </div>
    </div>
  )
}
