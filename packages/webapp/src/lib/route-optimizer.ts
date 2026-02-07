// ============= Route Optimization =============
// Calculate optimal route order using nearest-neighbor algorithm

import type { Property } from '../types';

/**
 * Calculate distance between two properties using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  prop1: { latitude: number | null; longitude: number | null },
  prop2: { latitude: number | null; longitude: number | null }
): number {
  if (
    !prop1.latitude ||
    !prop1.longitude ||
    !prop2.latitude ||
    !prop2.longitude
  ) {
    return Infinity; // Properties without coordinates are infinitely far apart
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(prop2.latitude - prop1.latitude);
  const dLon = toRad(prop2.longitude - prop1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(prop1.latitude)) *
      Math.cos(toRad(prop2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Optimize route using nearest-neighbor algorithm (TSP approximation)
 *
 * @param properties - Properties to route
 * @param startLat - Optional starting latitude (defaults to first property)
 * @param startLon - Optional starting longitude (defaults to first property)
 * @returns Properties ordered for optimal route
 */
export function optimizeRoute(
  properties: Property[],
  startLat?: number | null,
  startLon?: number | null
): Property[] {
  if (properties.length <= 1) {
    return [...properties];
  }

  const unvisited = [...properties];
  const ordered: Property[] = [];

  // Use provided start coordinates or first property as starting point
  let currentLat: number | null = startLat ?? null;
  let currentLon: number | null = startLon ?? null;

  // If no start coordinates provided, use first property as start
  if (currentLat === null || currentLon === null) {
    const first = unvisited.shift();
    if (first) {
      ordered.push(first);
      currentLat = first.latitude;
      currentLon = first.longitude;
    }
  }

  // Greedy nearest-neighbor algorithm
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const prop = unvisited[i];

      if (currentLat !== null && currentLon !== null) {
        const dist = calculateDistance(
          { latitude: currentLat, longitude: currentLon },
          prop
        );

        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestIndex = i;
        }
      }
    }

    const nearest = unvisited.splice(nearestIndex, 1)[0];
    if (nearest) {
      ordered.push(nearest);
      currentLat = nearest.latitude;
      currentLon = nearest.longitude;
    }
  }

  return ordered;
}

/**
 * Group properties into pages of 9 (3x3 grid)
 *
 * @param properties - Properties to group
 * @returns Array of property arrays, each with max 9 properties
 */
export function groupIntoPages(properties: Property[]): Property[][] {
  const pages: Property[][] = [];
  const pageSize = 9;

  for (let i = 0; i < properties.length; i += pageSize) {
    pages.push(properties.slice(i, i + pageSize));
  }

  return pages;
}

/**
 * Calculate total route distance
 *
 * @param properties - Ordered properties
 * @param startLat - Optional starting latitude
 * @param startLon - Optional starting longitude
 * @returns Total distance in kilometers
 */
export function calculateTotalDistance(
  properties: Property[],
  startLat?: number | null,
  startLon?: number | null
): number {
  if (properties.length === 0) return 0;

  let total = 0;
  let currentLat: number | null = startLat ?? null;
  let currentLon: number | null = startLon ?? null;

  for (const prop of properties) {
    if (currentLat !== null && currentLon !== null) {
      total += calculateDistance(
        { latitude: currentLat, longitude: currentLon },
        prop
      );
    }
    currentLat = prop.latitude;
    currentLon = prop.longitude;
  }

  return total;
}
