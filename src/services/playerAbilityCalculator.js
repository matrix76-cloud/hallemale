/* eslint-disable */
// src/services/playerAbilityCalculator.js
// 워치 세션 데이터 → 선수 능력치 + 건강 지표 계산

const DEFAULT_RESTING_HR = 60;

export function estimateHRMax(age) {
  if (!age || age < 10 || age > 80) return 190;
  return Math.round(208 - 0.7 * age);
}

export function calcHRZones(heartRateSamples = [], restingHR = DEFAULT_RESTING_HR, hrMax = 190) {
  const zones = { low: 0, mid: 0, high: 0, peak: 0 };
  const hrr = hrMax - restingHR;
  if (hrr <= 0 || heartRateSamples.length === 0) return zones;

  for (const s of heartRateSamples) {
    const v = s.value || s;
    const ratio = (v - restingHR) / hrr;
    if (ratio < 0.5) zones.low++;
    else if (ratio < 0.7) zones.mid++;
    else if (ratio < 0.85) zones.high++;
    else zones.peak++;
  }
  return zones;
}

export function estimateVO2max(restingHR = DEFAULT_RESTING_HR, hrMax = 190) {
  return Math.round(15 * (hrMax / restingHR));
}

export function calcAbility(sessions = [], userProfile = {}) {
  const age = userProfile.age || (userProfile.birthYear ? new Date().getFullYear() - userProfile.birthYear : 30);
  const restingHR = userProfile.restingHR || DEFAULT_RESTING_HR;
  const hrMax = estimateHRMax(age);
  const hrr = hrMax - restingHR;

  if (!sessions.length) return null;

  const avgHRs = sessions.map((s) => s.avgHeartRate).filter(Boolean);
  const maxHRs = sessions.map((s) => s.maxHeartRate).filter(Boolean);
  const calories = sessions.map((s) => s.totalCalories || 0);
  const durations = sessions.map((s) => {
    if (!s.startedAt || !s.endedAt) return 0;
    return (new Date(s.endedAt) - new Date(s.startedAt)) / 60000;
  });

  const avgHR = avgHRs.reduce((a, b) => a + b, 0) / (avgHRs.length || 1);
  const maxAvgHR = maxHRs.reduce((a, b) => a + b, 0) / (maxHRs.length || 1);
  const totalCal = calories.reduce((a, b) => a + b, 0);
  const totalMin = durations.reduce((a, b) => a + b, 0);

  // 1. 지구력: 평균 HR이 낮을수록 ↑ (같은 운동 강도에서)
  const stamina = clamp(100 - ((avgHR - restingHR) / hrr) * 100 + 20);

  // 2. 강도: 평균 HR / HRmax 비율
  const intensity = clamp((avgHR / hrMax) * 130);

  // 3. 회복력: 최고 HR - 평균 HR 차이 (적으면 덜 지침 → 높음)
  //    정확한 HRR은 경기 후 1분 측정 필요. 여기선 proxy.
  const recovery = clamp(100 - (maxAvgHR - avgHR) * 1.5 + 30);

  // 4. 순발력: 최고 HR 도달 능력
  const burst = clamp((maxAvgHR / hrMax) * 110);

  // 5. 활동량: 누적 경기 수 + 총 시간
  const volume = clamp(sessions.length * 8 + totalMin * 0.1);

  const ovr = Math.round((stamina + intensity + recovery + burst + volume) / 5);

  return {
    ovr,
    stamina: Math.round(stamina),
    intensity: Math.round(intensity),
    recovery: Math.round(recovery),
    burst: Math.round(burst),
    volume: Math.round(volume),
    meta: {
      sessionCount: sessions.length,
      totalMinutes: Math.round(totalMin),
      totalCalories: totalCal,
      avgHR: Math.round(avgHR),
      maxHR: Math.round(Math.max(...maxHRs, 0)),
      hrMax,
      restingHR,
    },
  };
}

function clamp(v, min = 20, max = 99) {
  return Math.max(min, Math.min(max, v));
}

export function getTier(ovr) {
  if (ovr >= 90) return { label: "S", color: "#dc2626" };
  if (ovr >= 80) return { label: "A", color: "#ea580c" };
  if (ovr >= 70) return { label: "B", color: "#ca8a04" };
  if (ovr >= 60) return { label: "C", color: "#16a34a" };
  return { label: "D", color: "#6b7280" };
}

