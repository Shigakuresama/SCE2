/**
 * Zillow Property Data Fetcher
 * Uses public Zillow API to get SqFt and Year Built
 *
 * Note: Zillow's public API requires authentication.
 * This is a stub implementation that can be extended with:
 * - Zillow API key integration
 * - Alternative property data sources (e.g., Redfin, County Assessor)
 * - Local caching to reduce API calls
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
    // TODO: Implement actual Zillow API integration
    // Options:
    // 1. Zillow API (requires API key)
    // 2. RapidAPI Zillow Scraper
    // 3. County assessor public records
    // 4. Web scraping with proper rate limiting

    console.log(`[Zillow] Fetching data for ${address}, ${zipCode}`);

    // Placeholder: In production, make actual API call
    // const url = `https://api.zillow.com/v1/searchResults.htm?address=${encodeURIComponent(address)}&citystatezip=${encodeURIComponent(zipCode)}`;
    // const response = await fetch(url, {
    //   headers: { 'Authorization': `Bearer ${ZILLOW_API_KEY}` }
    // });

    // For now, return empty object to not break existing flow
    return {};
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
