import { useState, useEffect, useMemo } from 'react'
import { buildTSSMap, computeBanister, generateCoachQuestions } from '../utils/sportsScience'

export function useGarminData() {
  const [raw,     setRaw]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch('data/garmin.json?v=' + Date.now())
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d  => { setRaw(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const derived = useMemo(() => {
    if (!raw) return null

    const restHR = raw.heart_rate?.resting || 55
    const maxHR  = raw.heart_rate?.max     || 185
    const tssMap = buildTSSMap(raw.all_activities, restHR, maxHR)
    const banister = computeBanister(tssMap, 120)   // 120 days of curve
    const coachQs  = generateCoachQuestions(raw, banister)

    return { raw, tssMap, banister, coachQs }
  }, [raw])

  return { data: derived, loading, error, raw }
}
