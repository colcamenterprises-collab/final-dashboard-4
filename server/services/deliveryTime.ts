// PATCH O4 — DELIVERY TIME ENGINE
export function estimateTimes(distanceKm: number) {
  const prepMinutes = 15;
  const travelMinutes = Math.ceil(distanceKm * 4); // ~15 km/h scooter

  const totalMinutes = prepMinutes + travelMinutes;

  return {
    prepMinutes,
    travelMinutes,
    estimateMinutes: totalMinutes,
  };
}
