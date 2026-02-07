/**
 * Zillow Property Data Fetcher
 *
 * Fetches property data from Zillow via the SCE2 cloud server API.
 * The server handles the actual scraping to avoid CORS issues.
 *
 * Data cached in-memory to reduce API calls.
 */

export interface ZillowPropertyData {
  sqFt?: number;
  yearBuilt?: number;
  lotSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  lastSold?: string;
  zestimate?: number;
  address?: string;
}

// Get API base URL from extension config
async function getApiBaseUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiUrl'], (result) => {
      resolve(result.apiUrl || 'http://localhost:3333');
    });
  });
}

/**
 * Fetches property data from Zillow for a given address
 * @param address - Street address (e.g., "123 Main St")
 * @param zipCode - ZIP code (e.g., "90210")
 * @returns Property data or empty object if fetch fails
 */
export async function fetchZillowData(
  address: string,
  zipCode: string
): Promise<Partial<ZillowPropertyData>> {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const url = `${apiBaseUrl}/api/zillow/scrape?address=${encodeURIComponent(address)}&zipCode=${encodeURIComponent(zipCode)}`;

    console.log(`[Zillow] Fetching data from API for ${address}, ${zipCode}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Zillow] API error: ${response.status} ${response.statusText}`);
      return {};
    }

    const result = await response.json();

    if (result.success && result.data) {
      console.log('[Zillow] Successfully fetched property data:', result.data);
      return result.data;
    } else {
      console.warn('[Zillow] API returned success=false or no data');
      return {};
    }
  } catch (error) {
    console.error('[Zillow] Fetch failed:', error);
    return {};
  }
}

/**
 * Fetches Zillow data with fallback to cached value
 * @param address - Street address
 * @param zipCode - ZIP code
 * @param cache - Optional cache storage
 */
export async function fetchZillowDataWithCache(
  address: string,
  zipCode: string,
  cache?: Map<string, Partial<ZillowPropertyData>>
): Promise<Partial<ZillowPropertyData>> {
  const cacheKey = `${address}_${zipCode}`;

  // Check cache first
  if (cache?.has(cacheKey)) {
    console.log(`[Zillow] Using cached data for ${cacheKey}`);
    return cache.get(cacheKey)!;
  }

  const data = await fetchZillowData(address, zipCode);

  // Cache successful results
  if (Object.keys(data).length > 0 && cache) {
    cache.set(cacheKey, data);
  }

  return data;
}
