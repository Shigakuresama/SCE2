/**
 * Overpass API Integration
 *
 * Fetches addresses within a bounding box using the Overpass API (OpenStreetMap).
 * Returns standardized AddressInput objects for use in SCE2.
 */

import type { AddressInput } from '../types';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Re-export Bounds for convenience
export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface AddressFromOverpass {
  id: number;
  lat: number;
  lon: number;
  tags: {
    ['addr:street']?: string;
    ['addr:city']?: string;
    ['addr:postcode']?: string;
    ['addr:housenumber']?: string;
  };
}

/**
 * Normalize address data to ensure all required fields are present.
 * Returns null if required fields (street, housenumber, postcode) are missing.
 */
function normalizeAddress(el: AddressFromOverpass): AddressInput | null {
  const street = el.tags['addr:street'];
  const housenumber = el.tags['addr:housenumber'];
  const city = el.tags['addr:city'];
  const postcode = el.tags['addr:postcode'];

  // Must have street, house number, and postcode at minimum
  if (!street || !housenumber || !postcode) {
    console.warn('[Overpass] Skipping address without required fields:', {
      hasStreet: !!street,
      hasHouseNumber: !!housenumber,
      hasPostcode: !!postcode,
      tags: el.tags
    });
    return null;
  }

  return {
    addressFull: `${housenumber} ${street}, ${city || 'Unknown City'}, ${postcode}`,
    streetNumber: housenumber,
    streetName: street,
    zipCode: postcode,
    city: city || null,
    state: 'CA', // Default to California (Orange County area)
    latitude: el.lat,
    longitude: el.lon,
  };
}

/**
 * Fetches all addresses within the given bounding box.
 *
 * Uses Overpass QL to query OpenStreetMap for addresses with:
 * - addr:street (street name)
 * - addr:housenumber (house number)
 * - addr:postcode (ZIP code) - optional, will use placeholder if missing
 *
 * @param bounds - Bounding box { south, west, north, east }
 * @returns Array of AddressInput objects
 */
export async function fetchAddressesInBounds(
  bounds: Bounds
): Promise<AddressInput[]> {
  const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;

  const query = `
    [out:json][timeout:25];
    (
      way["addr:street"]["addr:housenumber"](${bbox});
      relation["addr:street"]["addr:housenumber"](${bbox});
    );
    out body;
    out center;
  `;

  console.log('[Overpass] Fetching addresses in bounds:', bbox);

  const response = await fetch(
    `${OVERPASS_API_URL}?data=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.elements || data.elements.length === 0) {
    console.log('[Overpass] No addresses found');
    return [];
  }

  console.log(`[Overpass] Found ${data.elements.length} address elements`);

  const addresses: AddressInput[] = data.elements
    .map((el: AddressFromOverpass) => normalizeAddress(el))
    .filter((addr: AddressInput | null): addr is AddressInput => addr !== null);

  console.log(`[Overpass] Normalized to ${addresses.length} valid addresses`);

  // Validate all addresses before returning
  const validAddresses = addresses.filter(addr => {
    const isValid = !!(
      addr.addressFull &&
      addr.streetNumber &&
      addr.streetName &&
      addr.zipCode
    );
    if (!isValid) {
      console.error('[Overpass] Invalid address after normalization:', addr);
    }
    return isValid;
  });

  console.log(`[Overpass] Returning ${validAddresses.length} validated addresses`);

  return validAddresses;
}
