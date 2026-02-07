/**
 * Overpass API Integration
 *
 * Fetches addresses within a bounding box using the Overpass API (OpenStreetMap).
 * Returns standardized AddressInput objects for use in SCE2.
 */

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface AddressInput {
  addressFull: string;
  streetNumber: string;
  streetName: string;
  city: string | null;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
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
 * Normalize address data to ensure all required fields are present
 */
function normalizeAddress(el: AddressFromOverpass, defaultZip?: string): AddressInput | null {
  const street = el.tags['addr:street'];
  const housenumber = el.tags['addr:housenumber'];
  const city = el.tags['addr:city'];
  const postcode = el.tags['addr:postcode'] || defaultZip;

  // Must have street and house number at minimum
  if (!street || !housenumber) {
    console.warn('Skipping address without street or housenumber:', el.tags);
    return null;
  }

  // Try to infer postcode from coordinates if missing
  // For now, we'll use a placeholder if absolutely necessary
  const finalPostcode = postcode || '00000';

  return {
    addressFull: `${housenumber} ${street}, ${city || 'Unknown City'}, ${finalPostcode}`,
    streetNumber: housenumber,
    streetName: street,
    city: city || null,
    state: 'CA', // Default to California (Orange County area)
    zipCode: finalPostcode,
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
