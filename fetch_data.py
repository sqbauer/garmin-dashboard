"""
Fetches Garmin data and writes data/garmin.json.
Run by GitHub Actions daily; credentials come from environment variables.
"""

import json
import os
from datetime import date, datetime, timedelta
from pathlib import Path

from garminconnect import Garmin

TODAY      = date.today().isoformat()
YESTERDAY  = (date.today() - timedelta(days=1)).isoformat()
NOW        = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
WEEK_AGO   = (date.today() - timedelta(days=7)).isoformat()
MONTH_AGO  = (date.today() - timedelta(days=30)).isoformat()
DAYS_90    = (date.today() - timedelta(days=89)).isoformat()
YEAR_AGO   = (date.today() - timedelta(days=365)).isoformat()

RUN_TYPES  = {"running", "treadmill_running", "track_running", "trail_running"}


def safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        print(f"  skip {fn.__name__}({args[:1]}): {e}")
        return None


def sec_to_hm(s):
    if not s:
        return None
    h, m = divmod(int(s) // 60, 60)
    return f"{h}h {m:02d}m"


def parse_laps(splits_raw):
    """Extract per-lap metrics from get_activity_splits() response."""
    if not splits_raw or not isinstance(splits_raw, dict):
        return []
    result = []
    for l in splits_raw.get("lapDTOs", []):
        dist  = l.get("distance")
        dur   = l.get("duration")
        speed = l.get("averageSpeed")
        result.append({
            "lap":          l.get("lapIndex", len(result) + 1),
            "distance_m":   round(dist, 1) if dist else None,
            "duration_s":   round(dur, 1) if dur else None,
            "avg_hr":       l.get("averageHR"),
            "max_hr":       l.get("maxHR"),
            "avg_speed":    round(speed, 5) if speed else None,
            "elevation_gain": l.get("elevationGain"),
            "cadence":      l.get("averageRunCadence") or l.get("averageRunningCadenceInStepsPerMinute"),
        })
    return result


def main():
    email    = os.environ["GARMIN_EMAIL"]
    password = os.environ["GARMIN_PASSWORD"]

    print("Logging in…")
    client = Garmin(email, password)
    client.login()
    print("Logged in.\n")

    out = {"updated": NOW, "today": TODAY}

    # ── Profile ───────────────────────────────────────────────────────────────
    out["name"] = safe(client.get_full_name)

    # ── Today's daily stats ───────────────────────────────────────────────────
    print("Daily stats…")
    stats = safe(client.get_stats, TODAY)
    if stats:
        out["daily"] = {
            "steps":              stats.get("totalSteps"),
            "step_goal":          stats.get("dailyStepGoal"),
            "calories_total":     stats.get("totalKilocalories"),
            "calories_active":    stats.get("activeKilocalories"),
            "distance_m":         stats.get("totalDistanceMeters"),
            "floors":             stats.get("floorsAscended"),
            "stress_avg":         stats.get("averageStressLevel"),
            "body_battery_high":  stats.get("bodyBatteryHighestValue"),
            "body_battery_low":   stats.get("bodyBatteryLowestValue"),
            "intensity_moderate": stats.get("moderateIntensityMinutes"),
            "intensity_vigorous": stats.get("vigorousIntensityMinutes"),
        }

    # ── Last night's sleep ────────────────────────────────────────────────────
    print("Sleep (today)…")
    sleep_raw = safe(client.get_sleep_data, YESTERDAY)
    if sleep_raw:
        dto    = sleep_raw.get("dailySleepDTO", {})
        scores = dto.get("sleepScores", {})
        score  = scores.get("overall", {}).get("value") if isinstance(scores, dict) else None
        hrv    = sleep_raw.get("hrvSummary", {})
        out["sleep"] = {
            "date":            YESTERDAY,
            "total":           sec_to_hm(dto.get("sleepTimeSeconds")),
            "total_s":         dto.get("sleepTimeSeconds"),
            "deep":            sec_to_hm(dto.get("deepSleepSeconds")),
            "deep_s":          dto.get("deepSleepSeconds"),
            "light":           sec_to_hm(dto.get("lightSleepSeconds")),
            "light_s":         dto.get("lightSleepSeconds"),
            "rem":             sec_to_hm(dto.get("remSleepSeconds")),
            "rem_s":           dto.get("remSleepSeconds"),
            "awake":           sec_to_hm(dto.get("awakeSleepSeconds")),
            "awake_s":         dto.get("awakeSleepSeconds"),
            "score":           score,
            "avg_spo2":        dto.get("averageSpO2Value"),
            "avg_respiration": dto.get("averageRespirationValue"),
            "hrv_last_night":  hrv.get("lastNight"),
            "hrv_5day":        hrv.get("weeklyAvg"),
            "hrv_status":      hrv.get("status"),
        }

    # ── Heart rate ────────────────────────────────────────────────────────────
    print("Heart rate…")
    hr = safe(client.get_heart_rates, TODAY)
    if hr:
        out["heart_rate"] = {
            "resting": hr.get("restingHeartRate"),
            "max":     hr.get("maxHeartRate"),
            "min":     hr.get("minHeartRate"),
        }

    # ── HRV today ─────────────────────────────────────────────────────────────
    print("HRV…")
    hrv_data = safe(client.get_hrv_data, TODAY)
    if hrv_data:
        s = hrv_data.get("hrvSummary", {})
        out["hrv"] = {
            "last_night":  s.get("lastNight"),
            "weekly_avg":  s.get("weeklyAvg"),
            "status":      s.get("status"),
            "feedback":    s.get("feedbackPhrase"),
        }

    # ── Training readiness ────────────────────────────────────────────────────
    print("Training readiness…")
    tr = safe(client.get_training_readiness, TODAY)
    if tr:
        entry = tr[0] if isinstance(tr, list) and tr else tr
        if isinstance(entry, dict):
            out["readiness"] = {
                "score":            entry.get("score"),
                "level":            entry.get("levelColor"),
                "recovery_time_h":  entry.get("recoveryTime"),
            }

    # ── VO2max today ──────────────────────────────────────────────────────────
    print("VO2max…")
    vo2 = safe(client.get_max_metrics, TODAY)
    if vo2 and isinstance(vo2, list) and vo2:
        entry = vo2[0]
        out["vo2max"] = {
            "running": entry.get("generic", {}).get("vo2MaxPreciseValue"),
            "cycling": entry.get("cycling", {}).get("vo2MaxPreciseValue"),
        }

    # ── Recent activities (with GPS + laps for runs) ──────────────────────────
    print("Recent activities…")
    acts = safe(client.get_activities, 0, 10)
    recent_ids_with_laps = {}   # id -> laps list (reused in laps_history below)

    if acts:
        enriched = []
        for a in acts:
            act_id   = a.get("activityId")
            act_type = a.get("activityType", {}).get("typeKey", "")
            entry = {
                "id":               act_id,
                "date":             str(a.get("startTimeLocal", ""))[:10],
                "start_time":       str(a.get("startTimeLocal", "")),
                "name":             a.get("activityName"),
                "type":             act_type,
                "duration_s":       a.get("duration"),
                "distance_m":       a.get("distance"),
                "avg_hr":           a.get("averageHR"),
                "max_hr":           a.get("maxHR"),
                "calories":         a.get("calories"),
                "training_load":    a.get("activityTrainingLoad"),
                "avg_speed":        a.get("averageSpeed"),
                "max_speed":        a.get("maxSpeed"),
                "elevation_gain":   a.get("elevationGain"),
                "avg_cadence":      a.get("averageRunningCadenceInStepsPerMinute"),
                "aerobic_effect":   a.get("aerobicTrainingEffect"),
                "anaerobic_effect": a.get("anaerobicTrainingEffect"),
                "vo2max":           a.get("vO2MaxValue"),
            }

            # GPS for outdoor activities
            if act_type in ("running", "cycling", "hiking", "walking", "open_water_swimming") and act_id:
                print(f"  GPS for {act_id}…")
                details = safe(client.get_activity_details, act_id)
                if details:
                    geo      = details.get("geoPolylineDTO", {})
                    polyline = geo.get("polyline", [])
                    if len(polyline) > 300:
                        step     = len(polyline) // 300
                        polyline = polyline[::step]
                    entry["gps"] = [
                        {"lat": p.get("lat"), "lon": p.get("lon")}
                        for p in polyline if p.get("lat") and p.get("lon")
                    ]

            # Lap splits for all activities
            if act_id:
                print(f"  Splits for {act_id}…")
                splits_raw = safe(client.get_activity_splits, act_id)
                laps = parse_laps(splits_raw)
                if laps:
                    entry["laps"] = laps
                    if act_type in RUN_TYPES:
                        recent_ids_with_laps[act_id] = (a.get("startTimeLocal", "")[:10], laps)

            enriched.append(entry)
        out["recent_activities"] = enriched

    # ── 365-day step history ──────────────────────────────────────────────────
    print("Step history (365d)…")
    steps_hist = safe(client.get_daily_steps, YEAR_AGO, TODAY)
    if steps_hist and isinstance(steps_hist, list):
        out["steps_history"] = [
            {"date": e.get("calendarDate"), "steps": e.get("totalSteps"), "goal": e.get("stepGoal")}
            for e in steps_hist
        ]

    # ── All activities for analytics (no GPS) ─────────────────────────────────
    print("All activities (200)…")
    all_acts = safe(client.get_activities, 0, 200)
    if all_acts:
        out["all_activities"] = [
            {
                "id":             a.get("activityId"),
                "date":           str(a.get("startTimeLocal", ""))[:10],
                "type":           a.get("activityType", {}).get("typeKey", ""),
                "duration_s":     a.get("duration"),
                "distance_m":     a.get("distance"),
                "avg_hr":         a.get("averageHR"),
                "max_hr":         a.get("maxHR"),
                "calories":       a.get("calories"),
                "training_load":  a.get("activityTrainingLoad"),
                "avg_speed":      a.get("averageSpeed"),
                "elevation_gain": a.get("elevationGain"),
                "vo2max":         a.get("vO2MaxValue"),
                "aerobic_effect": a.get("aerobicTrainingEffect"),
            }
            for a in all_acts
        ]

    # ── Lap history for scatter chart (last 50 runs) ──────────────────────────
    # Builds a flat list of laps across runs, for pace-vs-HR over-time scatter.
    print("Lap history (up to 50 runs)…")
    laps_history = []

    # Seed with laps already fetched for recent activities
    for act_id, (act_date, laps) in recent_ids_with_laps.items():
        for lap in laps:
            if lap.get("distance_m") and lap["distance_m"] >= 400 and lap.get("avg_speed") and lap.get("avg_hr"):
                laps_history.append({**lap, "date": act_date, "activity_id": act_id})

    if all_acts:
        fetched = 0
        for a in all_acts:
            act_id   = a.get("activityId")
            act_type = a.get("activityType", {}).get("typeKey", "")
            act_date = str(a.get("startTimeLocal", ""))[:10]

            if act_type not in RUN_TYPES:
                continue
            if act_id in recent_ids_with_laps:
                continue   # already have these laps
            if fetched >= 40:
                break

            print(f"  Splits for run {act_id}…")
            splits_raw = safe(client.get_activity_splits, act_id)
            laps = parse_laps(splits_raw)
            fetched += 1

            for lap in laps:
                if lap.get("distance_m") and lap["distance_m"] >= 400 and lap.get("avg_speed") and lap.get("avg_hr"):
                    laps_history.append({**lap, "date": act_date, "activity_id": act_id})

    # Chronological order
    laps_history.sort(key=lambda x: x.get("date", ""))
    out["laps_history"] = laps_history
    print(f"  {len(laps_history)} laps collected")

    # ── 90-day daily history (HRV, sleep, resting HR, body battery) ───────────
    print("90-day history…")
    hist_hrv        = []
    hist_sleep      = []
    hist_resting_hr = []

    for i in range(89, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()

        hrv_d = safe(client.get_hrv_data, d)
        if hrv_d:
            s = hrv_d.get("hrvSummary", {})
            v = s.get("lastNight")
            if v:
                hist_hrv.append({"date": d, "value": v, "weekly_avg": s.get("weeklyAvg")})

        sleep_d = safe(client.get_sleep_data, d)
        if sleep_d:
            dto    = sleep_d.get("dailySleepDTO", {})
            scores = dto.get("sleepScores", {})
            score  = scores.get("overall", {}).get("value") if isinstance(scores, dict) else None
            total  = dto.get("sleepTimeSeconds")
            if total:
                hist_sleep.append({
                    "date":    d,
                    "score":   score,
                    "total_s": total,
                    "deep_s":  dto.get("deepSleepSeconds"),
                    "rem_s":   dto.get("remSleepSeconds"),
                })

        hr_d = safe(client.get_resting_heart_rate, d)
        if hr_d and isinstance(hr_d, dict):
            val = hr_d.get("restingHeartRateValue") or hr_d.get("value")
            if val:
                hist_resting_hr.append({"date": d, "value": val})

    out["history"] = {
        "hrv":        hist_hrv,
        "sleep":      hist_sleep,
        "resting_hr": hist_resting_hr,
    }

    # Body battery 90 days (single range call)
    print("Body battery (90d)…")
    bb = safe(client.get_body_battery, DAYS_90, TODAY)
    if bb and isinstance(bb, list):
        out["history"]["body_battery"] = [
            {
                "date": e.get("calendarDate"),
                "high": e.get("bodyBatteryHighestValue"),
                "low":  e.get("bodyBatteryLowestValue"),
            }
            for e in bb if e.get("calendarDate")
        ]

    # ── Write ─────────────────────────────────────────────────────────────────
    Path("data").mkdir(exist_ok=True)
    payload = json.dumps(out, indent=2, default=str)
    Path("data/garmin.json").write_text(payload)
    print(f"\nWrote data/garmin.json ({len(payload):,} bytes)")


if __name__ == "__main__":
    main()
