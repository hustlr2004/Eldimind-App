type VitalPayload = {
  heartRate?: number;
  spo2?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bodyTemperature?: number;
  temperatureUnit?: 'F' | 'C';
  respiratoryRate?: number;
};

type CriticalAlert = {
  vitalType: string;
  measuredValue: string;
  title: string;
  description: string;
};

function conditionNames(conditions: any[] = []) {
  return conditions.map((condition) => String(condition.name || '').toLowerCase());
}

function toFahrenheit(value: number, unit: 'F' | 'C' = 'F') {
  return unit === 'C' ? (value * 9) / 5 + 32 : value;
}

export function getCriticalVitalAlerts(vitals: VitalPayload, conditions: any[] = []): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];
  const names = conditionNames(conditions);
  const hasCardioRisk = names.some((name) => ['hypertension', 'copd', 'heart failure', 'arrhythmia'].includes(name));
  const hasRespiratoryRisk = names.some((name) => ['copd', 'asthma', 'pneumonia'].includes(name));
  const heartRateHigh = hasCardioRisk ? 110 : 120;
  const spo2Low = hasRespiratoryRisk ? 92 : 90;

  if (typeof vitals.heartRate === 'number' && (vitals.heartRate < 50 || vitals.heartRate > heartRateHigh)) {
    alerts.push({
      vitalType: 'heart_rate',
      measuredValue: `${vitals.heartRate} bpm`,
      title: 'Critical heart rate detected',
      description: `Heart rate is at a critical level: ${vitals.heartRate} bpm.`,
    });
  }

  if (typeof vitals.spo2 === 'number' && vitals.spo2 < spo2Low) {
    alerts.push({
      vitalType: 'spo2',
      measuredValue: `${vitals.spo2}%`,
      title: 'Critical oxygen level detected',
      description: `Blood oxygen is critically low at ${vitals.spo2}%.`,
    });
  }

  if (
    typeof vitals.bloodPressureSystolic === 'number' &&
    typeof vitals.bloodPressureDiastolic === 'number' &&
    (vitals.bloodPressureSystolic >= (hasCardioRisk ? 170 : 180) ||
      vitals.bloodPressureDiastolic >= (hasCardioRisk ? 110 : 120))
  ) {
    alerts.push({
      vitalType: 'blood_pressure',
      measuredValue: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`,
      title: 'Critical blood pressure detected',
      description: `Blood pressure is at a critical level: ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg.`,
    });
  }

  if (typeof vitals.bodyTemperature === 'number') {
    const tempF = toFahrenheit(vitals.bodyTemperature, vitals.temperatureUnit || 'F');
    if (tempF < 95 || tempF > 103) {
      alerts.push({
        vitalType: 'body_temperature',
        measuredValue: `${vitals.bodyTemperature}°${vitals.temperatureUnit || 'F'}`,
        title: 'Critical body temperature detected',
        description: `Body temperature is at a critical level: ${vitals.bodyTemperature}°${vitals.temperatureUnit || 'F'}.`,
      });
    }
  }

  if (
    typeof vitals.respiratoryRate === 'number' &&
    (vitals.respiratoryRate < 10 || vitals.respiratoryRate > 24)
  ) {
    alerts.push({
      vitalType: 'respiratory_rate',
      measuredValue: `${vitals.respiratoryRate} breaths/min`,
      title: 'Critical respiratory rate detected',
      description: `Respiratory rate is at a critical level: ${vitals.respiratoryRate} breaths/min.`,
    });
  }

  return alerts;
}
