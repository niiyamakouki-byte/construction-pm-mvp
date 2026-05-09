/**
 * Distance Calculator — Haversine formula + trip duration estimate.
 *
 * 一般道前提 (avgSpeedKmh = 30)
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Haversine distance between two GPS coordinates in kilometres.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Estimate trip duration in minutes given distance and average speed.
 * Default speed = 30 km/h (一般道前提).
 */
export function tripDuration_minutes(
  distanceKm: number,
  avgSpeedKmh: number = 30,
): number {
  if (avgSpeedKmh <= 0) return Infinity;
  return (distanceKm / avgSpeedKmh) * 60;
}
