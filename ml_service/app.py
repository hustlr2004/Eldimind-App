from datetime import datetime
from typing import List, Literal, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(title="EldiMind ML Service", version="0.1.0")


class ConditionInput(BaseModel):
    name: str
    active: bool = True


class VitalInput(BaseModel):
    heartRate: Optional[float] = None
    spo2: Optional[float] = None
    bloodPressureSystolic: Optional[float] = None
    bloodPressureDiastolic: Optional[float] = None
    bodyTemperature: Optional[float] = None
    temperatureUnit: Optional[Literal["F", "C"]] = "F"
    steps: Optional[float] = None
    sleepHours: Optional[float] = None
    respiratoryRate: Optional[float] = None
    recordedAt: Optional[datetime] = None


class MoodInput(BaseModel):
    mood: int = Field(ge=1, le=5)
    recordedAt: Optional[datetime] = None


class AlertInput(BaseModel):
    type: str
    severity: str
    createdAt: Optional[datetime] = None


class RiskRequest(BaseModel):
    userUid: str
    vitals: List[VitalInput] = []
    moods: List[MoodInput] = []
    conditions: List[ConditionInput] = []
    alerts: List[AlertInput] = []


def temperature_f(value: Optional[float], unit: str) -> Optional[float]:
    if value is None:
        return None
    if unit == "C":
        return (value * 9 / 5) + 32
    return value


def latest(items: List):
    return items[0] if items else None


def build_activity_log(vitals: List[VitalInput]) -> List[str]:
    if not vitals:
        return []

    latest_vital = latest(vitals)
    entries: List[str] = []
    if latest_vital.steps is not None:
        entries.append(f"{int(latest_vital.steps)} steps recorded")
    if latest_vital.heartRate is not None:
        entries.append(f"Resting heart rate around {int(latest_vital.heartRate)} bpm")
    if latest_vital.sleepHours is not None:
        entries.append(f"Slept about {latest_vital.sleepHours:.1f} hours")
    if latest_vital.respiratoryRate is not None:
        entries.append(f"Respiratory rate near {latest_vital.respiratoryRate:.0f} breaths/min")
    return entries


@app.get("/health")
def health():
    return {"ok": True, "service": "eldimind-ml"}


@app.post("/risk-score")
def risk_score(request: RiskRequest):
    latest_vital = latest(request.vitals)
    latest_mood = latest(request.moods)
    active_conditions = [condition.name for condition in request.conditions if condition.active]

    score = 10
    reasons: List[str] = []

    if latest_vital:
      heart_rate = latest_vital.heartRate
      spo2 = latest_vital.spo2
      systolic = latest_vital.bloodPressureSystolic
      diastolic = latest_vital.bloodPressureDiastolic
      temp_f = temperature_f(latest_vital.bodyTemperature, latest_vital.temperatureUnit or "F")
      respiratory = latest_vital.respiratoryRate
      steps = latest_vital.steps
      sleep_hours = latest_vital.sleepHours

      if heart_rate is not None and (heart_rate < 50 or heart_rate > 120):
          score += 25
          reasons.append("critical heart rate")
      if spo2 is not None and spo2 < 90:
          score += 30
          reasons.append("low oxygen")
      if systolic is not None and diastolic is not None and (systolic >= 180 or diastolic >= 120):
          score += 25
          reasons.append("critical blood pressure")
      if temp_f is not None and (temp_f < 95 or temp_f > 103):
          score += 15
          reasons.append("abnormal body temperature")
      if respiratory is not None and (respiratory < 10 or respiratory > 24):
          score += 10
          reasons.append("abnormal respiratory rate")
      if steps is not None and steps < 1000:
          score += 5
          reasons.append("low activity")
      if sleep_hours is not None and sleep_hours < 5:
          score += 8
          reasons.append("poor sleep")

    if latest_mood and latest_mood.mood <= 2:
        score += 12
        reasons.append("low mood")

    if active_conditions:
        score += min(20, len(active_conditions) * 6)
        reasons.append("multiple active conditions")

    critical_alerts = [alert for alert in request.alerts if alert.severity == "critical"]
    warning_alerts = [alert for alert in request.alerts if alert.severity == "warning"]
    if critical_alerts:
        score += 20
        reasons.append("recent critical alerts")
    elif warning_alerts:
        score += 8
        reasons.append("recent warning alerts")

    bounded_score = max(0, min(100, score))
    if bounded_score >= 70:
        risk_level = "high"
    elif bounded_score >= 40:
        risk_level = "moderate"
    else:
        risk_level = "low"

    return {
        "ok": True,
        "userUid": request.userUid,
        "riskScore": bounded_score,
        "riskLevel": risk_level,
        "reasons": reasons,
        "activityLog": build_activity_log(request.vitals),
        "adjustedThresholdHints": {
            "highRiskMonitoring": risk_level == "high",
            "extraCareForConditions": active_conditions,
        },
    }
