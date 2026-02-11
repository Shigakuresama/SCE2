import { describe, expect, it } from 'vitest';
import { orderPropertiesByNearestNeighbor } from '../src/lib/route-planner.js';

type TestProperty = {
  id: string;
  latitude: number | null;
  longitude: number | null;
};

const start = { latitude: 0, longitude: 0 };

describe('orderPropertiesByNearestNeighbor', () => {
  it('orders properties by nearest-neighbor from a provided start coordinate', () => {
    const properties: TestProperty[] = [
      { id: 'a', latitude: 0, longitude: 1 },
      { id: 'b', latitude: 0, longitude: 3 },
      { id: 'c', latitude: 0, longitude: 2 },
    ];

    const ordered = orderPropertiesByNearestNeighbor(properties, start);

    expect(ordered.map(property => property.id)).toEqual(['a', 'c', 'b']);
  });

  it('handles lists with zero or one property', () => {
    const none: TestProperty[] = [];
    const one: TestProperty[] = [{ id: 'only', latitude: 1, longitude: 1 }];

    expect(orderPropertiesByNearestNeighbor(none, start)).toEqual([]);
    expect(orderPropertiesByNearestNeighbor(one, start)).toEqual(one);
  });

  it('does not mutate the input array', () => {
    const properties: TestProperty[] = [
      { id: 'a', latitude: 0, longitude: 1 },
      { id: 'b', latitude: 0, longitude: 3 },
      { id: 'c', latitude: 0, longitude: 2 },
    ];
    const originalSnapshot = structuredClone(properties);

    const ordered = orderPropertiesByNearestNeighbor(properties, start);

    expect(ordered).not.toBe(properties);
    expect(properties).toEqual(originalSnapshot);
  });

  it('treats missing coordinates as infinitely far and keeps their relative order when appended', () => {
    const properties: TestProperty[] = [
      { id: 'missing-a', latitude: null, longitude: null },
      { id: 'near', latitude: 0, longitude: 1 },
      { id: 'missing-b', latitude: 2, longitude: null },
      { id: 'far', latitude: 0, longitude: 5 },
    ];

    const ordered = orderPropertiesByNearestNeighbor(properties, start);

    expect(ordered.map(property => property.id)).toEqual([
      'near',
      'far',
      'missing-a',
      'missing-b',
    ]);
  });
});
