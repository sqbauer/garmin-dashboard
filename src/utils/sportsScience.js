// ── Banister Fitness-Fatigue Model ────────────────────────────────────────────
// Fitness (CTL) = chronic training load, τ = 42 days  (aerobic adaptation)
// Fatigue (ATL) = acute training load,   τ = 7 days   (neuromuscular fatigue)
// Form   (TSB)  = CTL − ATL               (training stress balance / "form")

const TAU_CTL = 42
const TAU_ATL = 7

// Decay factors per day
const K_CTL = Math.exp(-1 / TAU_CTL)   // ≈ 0.9764
const K_ATL = Math.exp(-1 / TAU_ATL)   // ≈ 0.8669

/**
 * Given a date-keyed map of daily TSS values, compute Banister curves
 * for the last N days ending today.
 * Returns array of { date, tss, ctl, atl, tsb } sorted oldest→newest.
 */
export function computeBanister(actsByDate, days = 90) {
  const end   = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days - 1)   // seed with an extra day

  let ctl = 0
  let atl = 0
  const result = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds  = d.toISOString().slice(0, 10)
    const tss = actsByDate[ds] || 0

    ctl = K_CTL * ctl + (1 - K_CTL) * tss
    atl = K_ATL * atl + (1 - K_ATL) * tss

    // Only output the last `days` days
    const daysAgo = Math.round((end - d) / 86400000)
    if (daysAgo <= days) {
      result.push({
        date: ds,
        tss:  Math.round(tss),
        ctl:  Math.round(ctl * 10) / 10,
        atl:  Math.round(atl * 10) / 10,
        tsb:  Math.round((ctl - atl) * 10) / 10,
      })
    }
  }
  return result
}

/** Classify TSB into a named training phase */
export function tsbPhase(tsb) {
  if (tsb == null) return { label: '—', color: 'slate' }
  if (tsb >  25)   return { label: 'Deconditioning',   color: 'amber'  }
  if (tsb >   5)   return { label: 'Race Ready',        color: 'pine'   }
  if (tsb > -10)   return { label: 'Transitioning',     color: 'slate'  }
  if (tsb > -30)   return { label: 'Productive',        color: 'pine'   }
  return              { label: 'Overreaching',          color: 'amber'  }
}

/** Bar fill for TSB: positive = pine, negative = amber */
export function tsbBarColor(tsb) {
  if (tsb == null) return '#3b5270'
  if (tsb > 5)     return '#3d6b55'
  if (tsb > -10)   return '#3b5270'
  if (tsb > -30)   return '#5a9470'
  return '#8b6914'
}

// ── Training Stress Score estimation ─────────────────────────────────────────
// Uses Garmin training_load if available, otherwise estimates from
// duration and HR using a heart-rate reserve approach.

export function estimateTSS(activity, restingHR = 55, maxHR = 185) {
  if (activity.training_load) return activity.training_load

  const dur = activity.duration_s
  const hr  = activity.avg_hr
  if (!dur || !hr) return (dur || 0) / 3600 * 30  // rough proxy: 30 TSS/hour

  const hrr    = maxHR - restingHR
  const fraction = Math.max(0, (hr - restingHR) / hrr)
  return (dur / 3600) * fraction * 100
}

/** Build date→TSS map from all_activities array */
export function buildTSSMap(allActivities, restHR = 55, maxHR = 185) {
  const map = {}
  ;(allActivities || []).forEach(a => {
    const tss = estimateTSS(a, restHR, maxHR)
    map[a.date] = (map[a.date] || 0) + tss
  })
  return map
}

// ── Rolling statistics ────────────────────────────────────────────────────────

export function rolling(arr, window) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - window + 1), i + 1).filter(v => v != null)
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null
  })
}

export function stddev(arr) {
  const valid = arr.filter(v => v != null)
  if (valid.length < 2) return 0
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  return Math.sqrt(valid.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / valid.length)
}

// ── Pace conversions ──────────────────────────────────────────────────────────

export function paceStr(speedMs) {
  if (!speedMs) return null
  const sPerKm = 1000 / speedMs
  const mm = Math.floor(sPerKm / 60)
  const ss = Math.floor(sPerKm % 60)
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

export function paceNum(speedMs) {
  return speedMs ? 1000 / speedMs / 60 : null
}

export function durStr(s) {
  if (!s) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sc = Math.floor(s % 60)
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}:${sc.toString().padStart(2, '0')}`
}

// ── Pearson correlation ───────────────────────────────────────────────────────

export function pearson(xs, ys) {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  const num   = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const denX  = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0))
  const denY  = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0))
  return denX * denY === 0 ? 0 : num / (denX * denY)
}

// ── HRV baseline ──────────────────────────────────────────────────────────────

export function hrvBaseline(hrvHistory) {
  if (!hrvHistory || hrvHistory.length < 7) return null
  const vals = hrvHistory.map(h => h.value).filter(Boolean)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd   = stddev(vals)
  return { mean: Math.round(mean * 10) / 10, sd: Math.round(sd * 10) / 10 }
}

// ── Socratic coach engine ─────────────────────────────────────────────────────
// Rules-based, not AI. Generates 2-3 probing questions from physiological state.

export function generateCoachQuestions(data, banister) {
  const questions = []
  if (!data) return questions

  const hrv      = data.hrv || {}
  const sleep    = data.sleep || {}
  const hist     = data.history || {}
  const allActs  = data.all_activities || []

  const hrvNow   = hrv.last_night || data.sleep?.hrv_last_night
  const hrvAvg   = hrv.weekly_avg  || data.sleep?.hrv_5day

  const recent   = banister.slice(-1)[0] || {}
  const tsb      = recent.tsb
  const ctl      = recent.ctl
  const atl      = recent.atl

  // ── HRV × Load tension
  if (hrvNow && hrvAvg && atl > 30) {
    const drop = ((hrvAvg - hrvNow) / hrvAvg * 100).toFixed(0)
    if (drop > 8) {
      questions.push({
        icon: '🧠',
        question: `Your overnight HRV is ${drop}% below your 7-day average while your acute load (ATL ${Math.round(atl)}) is still high. Is this a planned overreaching block — or have you noticed any signs of systemic fatigue like poor motivation, heavier legs, or disrupted sleep quality?`,
        theme: 'amber',
      })
    }
  }

  // ── TSB phase
  if (tsb != null) {
    if (tsb > 10) {
      questions.push({
        icon: '⚡',
        question: `Your form (TSB +${tsb}) is in the race-ready zone, but your fitness (CTL ${Math.round(ctl)}) is not yet at its peak. Are you tapering intentionally — and is the timeline aligned with your next target event?`,
        theme: 'pine',
      })
    } else if (tsb < -25) {
      questions.push({
        icon: '📉',
        question: `You're in deep fatigue (TSB ${tsb}). This can be intentional overreaching before a taper, or it can be drifting into non-functional overreaching. What does your motivation and resting HR trend look like this week?`,
        theme: 'amber',
      })
    } else if (tsb > -15 && tsb < 0) {
      questions.push({
        icon: '📈',
        question: `TSB ${tsb} puts you in the productive training zone — your fitness is building. Is your weekly volume increasing by less than 10% to stay below injury-risk ACWR thresholds?`,
        theme: 'pine',
      })
    }
  }

  // ── Sleep debt
  const sleepTotal = sleep.total_s || 0
  if (sleepTotal > 0 && sleepTotal < 6 * 3600) {
    const deficit = Math.round((7 * 3600 - sleepTotal) / 60)
    questions.push({
      icon: '😴',
      question: `Last night's sleep was ${Math.floor(sleepTotal / 3600)}h ${Math.floor((sleepTotal % 3600) / 60)}m — about ${deficit} minutes below a typical 7h target. Sleep is when muscle protein synthesis and CNS recovery peak. Is this a one-off, or is there a pattern this week?`,
      theme: 'slate',
    })
  }

  // ── Deep sleep fraction
  const deepS = sleep.deep_s || 0
  const totalS = sleep.total_s || 1
  if (deepS && deepS / totalS < 0.13) {
    questions.push({
      icon: '🔬',
      question: `Deep sleep was ${Math.round(deepS / totalS * 100)}% of your sleep — below the typical 15–20% range. Deep sleep (N3) is when growth hormone is released and glycogen is restored. Alcohol, late eating, and high core temperature all suppress it. Any of those factors in play last night?`,
      theme: 'slate',
    })
  }

  // ── VO2max trend
  const vo2pts = allActs.filter(a => a.vo2max).slice(0, 10)
  if (vo2pts.length >= 5) {
    const recentVO2 = vo2pts.slice(0, 3).map(a => a.vo2max).reduce((a, b) => a + b, 0) / 3
    const olderVO2  = vo2pts.slice(-3).map(a => a.vo2max).reduce((a, b) => a + b, 0) / 3
    const delta     = recentVO2 - olderVO2
    if (Math.abs(delta) > 0.8) {
      questions.push({
        icon: '🫁',
        question: `Your Garmin VO₂ max estimate has ${delta > 0 ? 'risen' : 'fallen'} ~${Math.abs(delta).toFixed(1)} ml/kg/min recently. Garmin estimates this from pace-to-HR ratio in outdoor runs. Have your recent runs been affected by heat, hills, or a new GPS route — which could skew the estimate?`,
        theme: delta > 0 ? 'pine' : 'amber',
      })
    }
  }

  // ── Resting HR spike
  const rhrHist = hist.resting_hr || []
  if (rhrHist.length >= 7) {
    const recent7  = rhrHist.slice(-7).map(h => h.value)
    const baseline = rhrHist.slice(-30, -7).map(h => h.value)
    const avgR = recent7.reduce((a, b) => a + b, 0) / recent7.length
    const avgB = baseline.reduce((a, b) => a + b, 0) / Math.max(baseline.length, 1)
    if (avgB > 0 && avgR - avgB > 4) {
      questions.push({
        icon: '❤️',
        question: `Your resting HR is averaging ${(avgR - avgB).toFixed(0)} bpm above your recent baseline — a classic early-warning signal of overtraining, illness, or significant non-training stress. Has anything outside of training changed this week (sleep environment, hydration, life stress)?`,
        theme: 'amber',
      })
    }
  }

  return questions.slice(0, 3)
}
