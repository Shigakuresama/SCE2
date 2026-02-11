/**
 * Nominatim Geocoding Service
 *
 * Provides fuzzy address search with multiple fallback strategies.
 * Uses the OpenStreetMap Nominatim API for geocoding.
 */

const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

export interface SearchResult {
  lat: number;
  lon: number;
  display_name: string;
  address: {
    [key: string]: string;
  };
  name: string;
}

function extractFiveDigitZip(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  // Prefer the last ZIP-like token so queries like
  // "22003 seine 90716" treat 90716 as ZIP (not house number 22003).
  const matches = Array.from(value.matchAll(/\b(\d{5})(?:-\d{4})?\b/g));
  if (matches.length === 0) {
    return null;
  }
  return matches[matches.length - 1]?.[1] ?? null;
}

/**
 * Search for an address using multiple strategies with fallbacks.
 *
 * Tries different variations of the address query:
 * 1. Exact query (as provided)
 * 2. Query + ", USA" (country filter)
 * 3. Query + ", CA, USA"
 * 4. Query with "Ave" instead of "Ln" + ", CA, USA"
 *
 * @param query - Address search query (e.g., "1909 W Martha Ln" or "22003 seine 90716")
 * @returns SearchResult if found, null otherwise
 */
export async function searchAddress(query: string): Promise<SearchResult | null> {
  // Trim and validate input
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return null;
  }

  const requestedZip = extractFiveDigitZip(trimmedQuery);
  const requestedHouseNumber = trimmedQuery.match(/^\s*(\d{1,6})\b/)?.[1] ?? null;

  // Check if query contains a ZIP code (5 digits) - if so, we're more specific
  const hasZipCode = requestedZip !== null;
  const hasStreetType = /\s(st|street|ave|avenue|blvd|boulevard|ln|lane|dr|drive|way|road|ct|court|pl|place|cir|circle)\b/i.test(trimmedQuery);
  const inferredStreetTypeQuery = hasZipCode && !hasStreetType && requestedZip
    ? trimmedQuery.replace(
      new RegExp(`\\b${requestedZip}\\b`),
      `Ave ${requestedZip}`
    )
    : null;

  // Multiple search strategies with fallbacks
  const strategies: string[] = [
    // Strategy 0: Add likely street type if ZIP is present
    inferredStreetTypeQuery ? `${inferredStreetTypeQuery}, CA, USA` : null,

    // Strategy 1: Original query with explicit CA + country filter
    `${trimmedQuery}, CA, USA`,

    // Strategy 2: Original query with country filter
    `${trimmedQuery}, USA`,

    // Strategy 3: Original query (exact match)
    trimmedQuery,

    // Strategy 4: Add CA, USA if no state detected
    !trimmedQuery.includes(', CA') && !trimmedQuery.includes(', California')
      ? `${trimmedQuery}, CA, USA`
      : null,

    // Strategy 5: Try with "Ave" instead of "Ln" + ", CA, USA"
    trimmedQuery.replace(/\s(Ln|Lane)\s*$/i, 'Ave') + ', CA, USA',
  ].filter(Boolean) as string[];

  for (const searchQuery of strategies) {
    try {
      const url = `${NOMINATIM_API}?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=5`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SCE2-RoutePlanner/1.0',
        },
      });

      if (!response.ok) {
        console.warn(`Search failed for "${searchQuery}": HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        continue;
      }

      for (const candidate of data) {
        const candidateZip = extractFiveDigitZip(candidate.address?.postcode) ??
          extractFiveDigitZip(candidate.display_name);
        const candidateHouseNumber = candidate.address?.house_number ||
          extractStreetNumber(candidate.display_name);

        if (requestedZip && candidateZip !== requestedZip) {
          continue;
        }

        if (requestedHouseNumber) {
          if (!candidateHouseNumber) {
            continue;
          }
          if (candidateHouseNumber !== requestedHouseNumber) {
            continue;
          }
        }

        return {
          lat: parseFloat(candidate.lat),
          lon: parseFloat(candidate.lon),
          display_name: candidate.display_name,
          address: candidate.address || {},
          name: candidate.display_name.split(',')[0].trim(),
        };
      }

      // Fallback only when request had no strict ZIP/house constraints.
      if (!requestedZip && !requestedHouseNumber) {
        const result = data[0];
        return {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          display_name: result.display_name,
          address: result.address || {},
          name: result.display_name.split(',')[0].trim(),
        };
      }
    } catch (error) {
      console.error(`Search failed for "${searchQuery}":`, error);
      continue;
    }
  }

  // All strategies failed
  return null;
}

/**
 * Extract street number from display name or address object.
 * Handles both "22003 Street Name" and "22003, Street Name" formats.
 */
export function extractStreetNumber(displayName: string): string {
  // Try space-separated format first: "22003 W Martha Ln"
  let match = displayName.match(/^(\d+)\s/);
  if (match) return match[1];

  // Try comma-separated format: "22003, Seine Avenue"
  match = displayName.match(/^(\d+),/);
  if (match) return match[1];

  return '';
}

/**
 * Extract street name from display name.
 */
export function extractStreetName(displayName: string): string {
  // Remove street number and everything after the comma
  const withoutNumber = displayName.replace(/^\d+\s+,?\s*/, '');
  const parts = withoutNumber.split(',');
  return parts[0]?.trim() || '';
}

/**
 * Extract ZIP code from address object or display name.
 */
export function extractZipCode(result: SearchResult): string {
  // Try address.postcode first
  if (result.address.postcode) {
    return result.address.postcode;
  }

  // Try to extract from display name
  const match = result.display_name.match(/\b(\d{5}(?:-\d{4})?)\b/);
  return match ? match[1] : '';
}
