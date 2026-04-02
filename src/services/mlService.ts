import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

function buildFallbackRiskScore(payload: any) {
  const latestVital = payload.vitals?.[0] || {};
  const latestMood = payload.moods?.[0] || {};
  const activeConditions = (payload.conditions || []).filter((condition: any) => condition.active !== false);
  const recentAlerts = payload.alerts || [];

  let riskScore = 20;
  const reasons: string[] = [];

  if (typeof latestVital.heartRate === 'number' && (latestVital.heartRate < 55 || latestVital.heartRate > 110)) {
    riskScore += 18;
    reasons.push('heart rate outside preferred range');
  }
  if (typeof latestVital.spo2 === 'number' && latestVital.spo2 < 94) {
    riskScore += 20;
    reasons.push('oxygen saturation below safe threshold');
  }
  if (typeof latestVital.bloodPressureSystolic === 'number' && latestVital.bloodPressureSystolic >= 160) {
    riskScore += 16;
    reasons.push('systolic blood pressure elevated');
  }
  if (typeof latestMood.mood === 'number' && latestMood.mood <= 2) {
    riskScore += 12;
    reasons.push('low recent mood check-in');
  }
  if (activeConditions.length) {
    riskScore += Math.min(activeConditions.length * 8, 24);
    reasons.push(`active conditions: ${activeConditions.map((condition: any) => condition.name).join(', ')}`);
  }
  const criticalAlerts = recentAlerts.filter((alert: any) => alert.severity === 'critical').length;
  if (criticalAlerts) {
    riskScore += Math.min(criticalAlerts * 10, 30);
    reasons.push(`${criticalAlerts} recent critical alert${criticalAlerts > 1 ? 's' : ''}`);
  }

  const finalScore = Math.max(0, Math.min(100, riskScore));
  const riskLevel = finalScore >= 70 ? 'high' : finalScore >= 40 ? 'moderate' : 'low';
  return {
    ok: true,
    source: 'fallback',
    userUid: payload.userUid,
    riskScore: finalScore,
    riskLevel,
    reasons,
    activityLog: [
      latestVital.steps ? `${latestVital.steps} steps recorded recently` : 'No recent step data',
      typeof latestVital.heartRate === 'number' ? `Latest heart rate ${latestVital.heartRate} bpm` : 'No recent heart rate data',
    ],
    adjustedThresholdHints: {
      highRiskMonitoring: riskLevel === 'high',
      extraCareForConditions: activeConditions.map((condition: any) => condition.name),
    },
  };
}

export async function scoreHealthRisk(payload: any) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/risk-score`, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
    return { ...response.data, source: response.data?.source || 'ml_service' };
  } catch (err) {
    console.warn('ML service unavailable, using fallback scoring');
    return buildFallbackRiskScore(payload);
  }
}
