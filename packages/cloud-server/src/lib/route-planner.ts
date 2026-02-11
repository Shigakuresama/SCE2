export type RouteCoordinate = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

export type StartCoordinate = {
  latitude: number;
  longitude: number;
};

function hasValidCoordinates(coordinate: RouteCoordinate): coordinate is {
  latitude: number;
  longitude: number;
} {
  return (
    typeof coordinate.latitude === 'number' &&
    Number.isFinite(coordinate.latitude) &&
    typeof coordinate.longitude === 'number' &&
    Number.isFinite(coordinate.longitude)
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateDistance(
  from: RouteCoordinate,
  to: RouteCoordinate
): number {
  if (!hasValidCoordinates(from) || !hasValidCoordinates(to)) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function orderPropertiesByNearestNeighbor<T extends RouteCoordinate>(
  properties: readonly T[],
  start: StartCoordinate
): T[] {
  if (properties.length <= 1) {
    return [...properties];
  }

  const ordered: T[] = [];
  const unvisited = [...properties];
  let current: RouteCoordinate = start;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < unvisited.length; index += 1) {
      const distance = calculateDistance(current, unvisited[index]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    const next = unvisited.splice(nearestIndex, 1)[0];
    if (!next) {
      break;
    }

    ordered.push(next);
    current = next;
  }

  return ordered;
}
