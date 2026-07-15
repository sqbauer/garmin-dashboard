"""
Fetches Garmin data and writes data/garmin.json.
Run by GitHub Actions daily; credentials come from environment variables.
"""

import json
import os
from datetime import date, timedelta
from pathlib import Path

from garminconnect import Garmin

TODAY = date.today().isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()
WEEK_AGO = (date.today() - timedelta(days=7)).isoformat()
MONTH_AGO = (date.today() - timedelta(days=30)).isoformat()


def safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        print(f"  skip {fn.__name__}: {e}")
        return None


def sec_to_hm(s):
    if not s:
        return None
    h, m = divmod(int(s) // 60, 60)
    return f"{h}h {m:02d}m"


def main():
    email = os.environ["GARMIN_EMAIL"]
    password = os.environ["GARMIN_PASSWORD"]

    print("Logging in…")
    client = Garmin(email, password)
    client.login()
    print("Logged in.")

    out = {"updated": TODAY, "today": TODAY}

    # ── Profile ──────────────────────────────────────────────────────────────
    print("Profile…")
    out["name"] = safe(client.get_full_name)

    # ── Daily stats ───────────────────────────────────────────────────────────
    print("Daily stats…")
    stats = safe(client.get_stats, TODAY)
    if stats:
        out["daily"] = {
            "steps": stats.get("totalSteps"),
            "step_goal": stats.get("dailyStepGoal"),
            "calories_total": stats.get("totalKilocalories"),
            "calories_active": stats.get("activeKilocalories"),
            "distance_m": stats.get("totalDistanceMeters"),
            "floors": stats.get("floorsAscended"),
            "stress_avg": stats.get("averageStressLevel"),
            "body_battery_high": stats.get("bodyBatteryHighestValue"),
            "body_battery_low": stats.get("bodyBatteryLowestValue"),
            "intensity_moderate": stats.get("moderateIntensityMinutes"),
            "intensity_vigorous": stats.get("vigorousIntensityMinutes"),
        }

    # ── Sleep ─────────────────────────────────────────────────────────────────
    print("Sleep…")
    sleep_raw = safe(client.get_sleep_data, YESTERDAY)
    if sleep_raw:
        dto = sleep_raw.get("dailySleepDTO", {})
        scores = dto.get("sleepScores", {})
        score_val = scores.get("overall", {}).get("value") if isinstance(scores, dict) else None
        hrv = sleep_raw.get("hrvSummary", {})
        out["sleep"] = {
            "date": YESTERDAY,
            "total": sec_to_hm(dto.get("sleepTimeSeconds")),
            "total_s": dto.get("sleepTimeSeconds"),
            "deep": sec_to_hm(dto.get("deepSleepSeconds")),
            "light": sec_to_hm(dto.get("lightSleepSeconds")),
            "rem": sec_to_hm(dto.get("remSleepSeconds")),
            "awake": sec_to_hm(dto.get("awakeSleepSeconds")),
            "score": score_val,
            "avg_spo2": dto.get("averageSpO2Value"),
            "avg_respiration": dto.get("averageRespirationValue"),
            "hrv_last_night": hrv.get("lastNight"),
            "hrv_5day": hrv.get("weeklyAvg"),
            "hrv_status": hrv.get("status"),
        }

    # ── Heart rate ────────────────────────────────────────────────────────────
    print("Heart rate…")
    hr = safe(client.get_heart_rates, TODAY)
    if hr:
        out["heart_rate"] = {
            "resting": hr.get("restingHeartRate"),
            "max": hr.get("maxHeartRate"),
            "min": hr.get("minHeartRate"),
        }

    # ── HRV ───────────────────────────────────────────────────────────────────
    print("HRV…")
    hrv_data = safe(client.get_hrv_data, TODAY)
    if hrv_data:
        s = hrv_data.get("hrvSummary", {})
        out["hrv"] = {
            "last_night": s.get("lastNight"),
            "weekly_avg": s.get("weeklyAvg"),
            "status": s.get("status"),
            "feedback": s.get("feedbackPhrase"),
        }

    # ── Training readiness ────────────────────────────────────────────────────
    print("Training readiness…")
    tr = safe(client.get_training_readiness, TODAY)
    if tr:
        entry = tr[0] if isinstance(tr, list) and tr else tr
        if isinstance(entry, dict):
            out["readiness"] = {
                "score": entry.get("score"),
                "level": entry.get("levelColor"),
                "recovery_time_h": entry.get("recoveryTime"),
            }

    # ── VO2max ────────────────────────────────────────────────────────────────
    print("VO2max…")
    vo2 = safe(client.get_max_metrics, TODAY)
    if vo2 and isinstance(vo2, list) and vo2:
        entry = vo2[0]
        out["vo2max"] = {
            "running": entry.get("generic", {}).get("vo2MaxPreciseValue"),
            "cycling": entry.get("cycling", {}).get("vo2MaxPreciseValue"),
        }

    # ── Activities + GPS details ──────────────────────────────────────────────
    print("Activities…")
    acts = safe(client.get_activities, 0, 10)
    if acts:
        enriched = []
        for a in acts:
            act_id = a.get("activityId")
            act_type = a.get("activityType", {}).get("typeKey", "")
            entry = {
                "id": act_id,
                "date": str(a.get("startTimeLocal", ""))[:10],
                "start_time": str(a.get("startTimeLocal", "")),
                "name": a.get("activityName"),
                "type": act_type,
                "duration_s": a.get("duration"),
                "distance_m": a.get("distance"),
                "avg_hr": a.get("averageHR"),
                "max_hr": a.get("maxHR"),
                "calories": a.get("calories"),
                "training_load": a.get("activityTrainingLoad"),
                "avg_speed": a.get("averageSpeed"),
                "max_speed": a.get("maxSpeed"),
                "elevation_gain": a.get("elevationGain"),
                "avg_cadence": a.get("averageRunningCadenceInStepsPerMinute"),
                "aerobic_effect": a.get("aerobicTrainingEffect"),
                "anaerobic_effect": a.get("anaerobicTrainingEffect"),
                "vo2max": a.get("vO2MaxValue"),
            }

            # Fetch GPS polyline for outdoor activities
            if act_type in ("running", "cycling", "hiking", "walking", "open_water_swimming") and act_id:
                print(f"  GPS for {act_id} ({act_type})…")
                details = safe(client.get_activity_details, act_id)
                if details:
                    geo = details.get("geoPolylineDTO", {})
                    polyline = geo.get("polyline", [])
                    # Downsample to max 300 points to keep JSON small
                    if len(polyline) > 300:
                        step = len(polyline) // 300
                        polyline = polyline[::step]
                    entry["gps"] = [
                        {"lat": p.get("lat"), "lon": p.get("lon")}
                        for p in polyline if p.get("lat") and p.get("lon")
                    ]

            enriched.append(entry)
        out["recent_activities"] = enriched

    # ── 30-day step history ───────────────────────────────────────────────────
    print("Step history…")
    steps_hist = safe(client.get_daily_steps, MONTH_AGO, TODAY)
    if steps_hist and isinstance(steps_hist, list):
        out["steps_history"] = [
            {"date": e.get("calendarDate"), "steps": e.get("totalSteps"), "goal": e.get("stepGoal")}
            for e in steps_hist
        ]

    # ── 7-day body battery ────────────────────────────────────────────────────
    print("Body battery…")
    bb = safe(client.get_body_battery, WEEK_AGO, TODAY)
    if bb and isinstance(bb, list):
        out["body_battery_history"] = [
            {"date": e.get("calendarDate"), "high": e.get("bodyBatteryHighestValue"),
             "low": e.get("bodyBatteryLowestValue")}
            for e in bb
        ]

    # ── Write output ──────────────────────────────────────────────────────────
    Path("data").mkdir(exist_ok=True)
    Path("data/garmin.json").write_text(json.dumps(out, indent=2, default=str))
    print(f"Wrote data/garmin.json ({len(json.dumps(out))} bytes)")


if __name__ == "__main__":
    main()
