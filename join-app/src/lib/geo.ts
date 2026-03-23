/**
 * Haversine formula — distance between two lat/lng points in meters.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if a user is within a venue's check-in radius.
 */
export function isWithinRadius(
  userLat: number,
  userLng: number,
  venueLat: number,
  venueLng: number,
  radiusMeters: number = 150
): boolean {
  return haversineMeters(userLat, userLng, venueLat, venueLng) <= radiusMeters;
}
