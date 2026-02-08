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

  // Check if query contains a ZIP code (5 digits) - if so, we're more specific
  const hasZipCode = /\b\d{5}\b/.test(trimmedQuery);
  const hasStreetType = /\s(st|street|ave|avenue|blvd|boulevard|ln|lane|dr|drive|way|road|ct|court|pl|place|cir|circle)\b/i.test(trimmedQuery);

  // Multiple search strategies with fallbacks
  const strategies: string[] = [
    // Strategy 0: Original query with country filter (most specific first)
    `${trimmedQuery}, USA`,

    // Strategy 1: Original query (exact match)
    trimmedQuery,

    // Strategy 2: If it has a ZIP but no street type, it's probably "number street zip"
    // Try adding "Ave" as default street type
    hasZipCode && !hasStreetType ? `${trimmedQuery.replace(/(\d{5})$/, 'Ave $1')}, USA` : null,

    // Strategy 3: Add CA, USA if no state detected
    !trimmedQuery.includes(', CA') && !trimmedQuery.includes(', California')
      ? `${trimmedQuery}, CA, USA`
      : null,

    // Strategy 4: Try with "Ave" instead of "Ln" + ", CA, USA"
    trimmedQuery.replace(/\s(Ln|Lane)\s*$/i, 'Ave') + ', CA, USA',
  ].filter(Boolean) as string[];

  for (const searchQuery of strategies) {
    try {
      const url = `${NOMINATIM_API}?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=1`;

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

      if (data.length > 0) {
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
