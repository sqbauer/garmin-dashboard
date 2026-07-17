// Zone C — Tactical Session Analysis
import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, Cell, ZAxis,
} from 'recharts'
import { Card, Badge, StatRow, Insight, InfoToggle, ChartTooltip, Empty, fmt } from './shared'
import { paceStr, paceNum, durStr } from '../utils/sportsScience'

const RUN_TYPES = new Set(['running', 'treadmill_running', 'track_running', 'trail_running'])
const ACT_ICON  = t => ({ running:'🏃', cycling:'🚴', swimming:'🏊', walking:'🚶',
  hiking:'🥾', strength_training:'🏋️', yoga:'🧘', indoor_cycling:'🚴',
  treadmill_running:'🏃', track_running:'🏃', trail_running:'🏃', open_water_swimming:'🏊' }[t] || '⚡')

// ── Lap splits chart ──────────────────────────────────────────────────────────
function LapChart({ laps }) {
  if (!laps?.length) return <Empty message="No lap data" />

  const maxHR = Math.max(...laps.map(l => l.avg_hr || 0))
  const minHR = Math.min(...laps.filter(l => l.avg_hr).map(l => l.avg_hr))

  const data = laps.map(l => ({
    lap:    `${l.lap}`,
    paceN:  l.avg_speed ? paceNum(l.avg_speed) : null,
    paceS:  l.avg_speed ? paceStr(l.avg_speed) : '—',
    hr:     l.avg_hr || null,
    dist:   l.distance_m ? (l.distance_m / 1000).toFixed(2) : '—',
    elev:   l.elevation_gain != null ? Math.round(l.elevation_gain) : null,
    // HR heat color
    hrColor: l.avg_hr && maxHR > minHR
      ? `hsl(${Math.round((1 - (l.avg_hr - minHR) / (maxHR - minHR)) * 120)},55%,45%)`
      : '#3b5270',
  }))

  return (
    <>
      <div className="h-36 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="lap" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="pace" tick={{ fontSize: 9 }} reversed
              tickFormatter={v => paceStr(1000 / v / 60) || ''} domain={['auto', 'auto']} />
            <YAxis yAxisId="hr" orientation="right" tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-ink-800 border border-ink-600/50 rounded-lg px-3 py-2 text-xs shadow-xl">
                    <div className="text-ink-300 mb-1">Lap {label} · {d.dist} km</div>
                    <div className="text-ink-50">Pace <span className="font-semibold text-slate-200">{d.paceS} /km</span></div>
                    {d.hr && <div className="text-ink-50">HR <span className="font-semibold" style={{ color: d.hrColor }}>{d.hr} bpm</span></div>}
                    {d.elev != null && <div className="text-ink-300">Elev ↑ {d.elev}m</div>}
                  </div>
                )
              }}
            />
            <Bar dataKey="paceN" yAxisId="pace" radius={[2, 2, 0, 0]} name="Pace">
              {data.map((_, i) => (
                <Cell key={i} fill="#3b5270" fillOpacity={0.7} />
              ))}
            </Bar>
            <Line yAxisId="hr" type="monotone" dataKey="hr" stroke="#c4961a"
              strokeWidth={2} dot={{ r: 3, fill: '#c4961a', strokeWidth: 0 }} name="HR" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Splits table */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs tabular">
          <thead>
            <tr className="text-2xs font-bold uppercase tracking-widest text-ink-400 border-b border-ink-600/30">
              <th className="text-left py-2 px-1">Lap</th>
              <th className="text-right py-2 px-1">km</th>
              <th className="text-right py-2 px-1">Pace</th>
              <th className="text-right py-2 px-1">Avg HR</th>
              <th className="text-right py-2 px-1">Max HR</th>
              <th className="text-right py-2 px-1">Elev↑</th>
            </tr>
          </thead>
          <tbody>
            {laps.map(lap => {
              const pc = paceStr(lap.avg_speed)
              const hrColor = lap.avg_hr && maxHR > minHR
                ? `hsl(${Math.round((1 - (lap.avg_hr - minHR) / (maxHR - minHR)) * 120)},55%,45%)`
                : undefined
              return (
                <tr key={lap.lap} className="border-b border-ink-700/30 hover:bg-ink-700/20 transition-colors">
                  <td className="py-1.5 px-1 text-ink-400">Lap {lap.lap}</td>
                  <td className="py-1.5 px-1 text-right text-ink-200">{lap.distance_m ? (lap.distance_m / 1000).toFixed(2) : '—'}</td>
                  <td className="py-1.5 px-1 text-right font-semibold text-ink-100">{pc || '—'} <span className="text-ink-400 font-normal">/km</span></td>
                  <td className="py-1.5 px-1 text-right font-semibold" style={{ color: hrColor }}>{lap.avg_hr || '—'} <span className="text-ink-400 font-normal">bpm</span></td>
                  <td className="py-1.5 px-1 text-right text-ink-300">{lap.max_hr || '—'}</td>
                  <td className="py-1.5 px-1 text-right text-ink-300">{lap.elevation_gain != null ? Math.round(lap.elevation_gain) + 'm' : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Activity selector + detail ────────────────────────────────────────────────
export function SessionDetail({ raw }) {
  const [selected, setSelected] = useState(0)
  const activities = raw?.recent_activities || []

  const act = activities[selected]

  const distKm   = act?.distance_m ? (act.distance_m / 1000).toFixed(2) : null
  const pace     = act?.avg_speed   ? paceStr(act.avg_speed) : null
  const isRun    = act && RUN_TYPES.has(act.type)

  return (
    <Card title="Session Deep Dive" padding={false}>
      {/* Activity selector */}
      <div className="flex gap-1 overflow-x-auto p-3 pb-0">
        {activities.map((a, i) => (
          <button
            key={a.id || i}
            onClick={() => setSelected(i)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all
              ${i === selected
                ? 'bg-slate-800 border border-slate-600/60 text-slate-200'
                : 'bg-ink-700/50 border border-ink-600/30 text-ink-300 hover:text-ink-100'}`}
          >
            <span>{ACT_ICON(a.type)}</span>
            <span>{a.date?.slice(5) || ''}</span>
            {a.distance_m && <span className="text-ink-400">{(a.distance_m/1000).toFixed(1)}k</span>}
          </button>
        ))}
      </div>

      {act ? (
        <div className="p-4">
          {/* Activity header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ACT_ICON(act.type)}</span>
              <div>
                <div className="text-sm font-semibold text-ink-50">{act.name || act.type || 'Activity'}</div>
                <div className="text-xs text-ink-400">{(act.start_time || act.date || '').replace('T', ' ').slice(0, 16)}</div>
              </div>
            </div>
            {act.aerobic_effect && (
              <Badge label={`AE ${Number(act.aerobic_effect).toFixed(1)}`} variant="slate" />
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { k: 'Duration',   v: durStr(act.duration_s),                    u: ''       },
              { k: 'Distance',   v: distKm,                                     u: 'km'     },
              { k: isRun ? 'Avg Pace' : 'Avg Speed', v: pace || (act.avg_speed ? `${(act.avg_speed * 3.6).toFixed(1)}` : null), u: isRun ? '/km' : 'km/h' },
              { k: 'Avg HR',     v: act.avg_hr,                                 u: 'bpm'    },
              { k: 'Max HR',     v: act.max_hr,                                 u: 'bpm'    },
              { k: 'Calories',   v: act.calories ? Math.round(act.calories) : null, u: 'kcal' },
              { k: 'Elev Gain',  v: act.elevation_gain != null ? Math.round(act.elevation_gain) : null, u: 'm' },
              { k: 'Cadence',    v: act.avg_cadence ? Math.round(act.avg_cadence) : null, u: 'spm' },
              { k: 'Training Load', v: act.training_load ? Math.round(act.training_load) : null, u: '' },
            ].filter(s => s.v != null && s.v !== '—').map(s => (
              <div key={s.k} className="bg-ink-700/50 rounded-lg p-2.5">
                <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider">{s.k}</div>
                <div className="text-xl font-bold tabular text-ink-50 leading-tight mt-0.5">
                  {s.v}<span className="text-xs text-ink-400 font-normal ml-0.5">{s.u}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Lap splits (runs only) */}
          {isRun && act.laps?.length > 1 && (
            <div className="mb-2">
              <div className="text-2xs text-ink-400 uppercase font-bold tracking-wider mb-2">
                Lap Splits — {act.laps.length} laps · pace (bars) + HR (amber line)
              </div>
              <LapChart laps={act.laps} />
            </div>
          )}
        </div>
      ) : <Empty message="No recent activities" />}
    </Card>
  )
}

// ── Lap Pace vs HR scatter over time ─────────────────────────────────────────
export function LapScatter({ raw }) {
  const lapsHistory = raw?.laps_history || []

  const { pts, minT, maxT } = useMemo(() => {
    const filtered = lapsHistory.filter(l => l.avg_speed && l.avg_hr && (l.distance_m || 0) >= 400)
    if (!filtered.length) return { pts: [], minT: 0, maxT: 1 }

    const dates = filtered.map(l => new Date(l.date).getTime())
    const minT  = Math.min(...dates)
    const maxT  = Math.max(...dates)
    return {
      pts: filtered.map(l => ({
        x:    paceNum(l.avg_speed),
        y:    l.avg_hr,
        date: l.date,
        pace: paceStr(l.avg_speed),
        dist: l.distance_m ? (l.distance_m / 1000).toFixed(2) : '?',
        t:    (new Date(l.date).getTime() - minT) / (maxT - minT || 1),
      })),
      minT,
      maxT,
    }
  }, [lapsHistory])

  if (pts.length < 5) return <Empty message="Need 5+ runs to show lap scatter — trigger a data refresh" />

  return (
    <Card title="Lap Pace vs Heart Rate — Aerobic Development Over Time">
      <div className="text-xs text-ink-300 mb-3 leading-relaxed">
        Each dot = one km/lap. <span className="text-ink-500">Lighter</span> = older ·{' '}
        <span className="text-slate-300 font-medium">Darker purple</span> = recent.{' '}
        Fitness shows as dots shifting toward the <strong className="text-pine-300">bottom-left</strong> (faster at lower HR).
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, left: -12, bottom: 20 }}>
            <XAxis
              dataKey="x" type="number" name="Pace"
              label={{ value: 'Pace (min/km) — left = faster', position: 'insideBottom', offset: -12, fontSize: 9, fill: '#56697e' }}
              tickFormatter={v => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`}
              tick={{ fontSize: 9 }} domain={['auto', 'auto']}
            />
            <YAxis
              dataKey="y" type="number" name="HR"
              label={{ value: 'HR (bpm)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 9, fill: '#56697e' }}
              tick={{ fontSize: 9 }} domain={['auto', 'auto']}
            />
            <ZAxis range={[30, 60]} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload
                return (
                  <div className="bg-ink-800 border border-ink-600/50 rounded-lg px-3 py-2 text-xs shadow-xl">
                    <div className="text-ink-300 mb-1">{d.date}</div>
                    <div className="text-ink-50">Pace <span className="font-semibold">{d.pace} /km</span></div>
                    <div className="text-ink-50">HR <span className="font-semibold">{d.y} bpm</span></div>
                    <div className="text-ink-400">Lap dist: {d.dist} km</div>
                  </div>
                )
              }}
            />
            <Scatter
              data={pts}
              shape={props => {
                const { cx, cy, payload } = props
                const t = payload.t
                const opacity = 0.15 + t * 0.75
                return (
                  <circle
                    cx={cx} cy={cy} r={5}
                    fill={`rgba(123,110,246,${opacity.toFixed(2)})`}
                    stroke={`rgba(123,110,246,${(opacity * 1.3).toFixed(2)})`}
                    strokeWidth={1}
                  />
                )
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <InfoToggle summary="Reading the scatter — how fitness shows up over time">
        <strong>X-axis</strong>: pace in min/km — leftward = faster. <strong>Y-axis</strong>: heart rate for that lap.
        <br /><br />
        <strong>Aerobic development</strong> appears as dots shifting toward the bottom-left corner over time —
        the same pace costs fewer beats, or you run faster at the same heart rate.
        <br /><br />
        <strong>Color time-coding:</strong> the lightest dots are your oldest laps; the darkest purple are most recent.
        If your recent cluster is to the lower-left of your old cluster, your aerobic base is measurably stronger.
        <br /><br />
        <em>Note:</em> heat, altitude, and fatigue all shift dots upward temporarily — these are confounds, not fitness regression.
      </InfoToggle>
    </Card>
  )
}

// ── Zone C root ────────────────────────────────────────────────────────────────
export function ZoneC({ raw }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <SessionDetail raw={raw} />
      <LapScatter raw={raw} />
    </div>
  )
}
