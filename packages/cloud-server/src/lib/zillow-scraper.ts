/**
 * Zillow Property Data Scraper
 *
 * Fetches property data from Zillow by parsing the __NEXT_DATA__ JSON
 * embedded in the HTML page.
 *
 * This module handles direct scraping (no proxy). For proxy support,
 * use the main scrapeZillowData export which automatically uses proxy-scraper.ts
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

interface ScrapingError extends Error {
  url?: string;
  httpStatus?: number;
}

/**
 * Direct scraping from Zillow (no proxy)
 * This will likely fail with 403 Forbidden due to anti-bot protection
 * Exported for use by proxy-scraper.ts as a fallback
 */
export async function directScrapeZillow(
  address: string,
  zipCode: string
): Promise<Partial<ZillowPropertyData>> {
  // Format address for Zillow URL format
  const formattedAddress = formatAddressForUrl(address);
  const searchUrl = `https://www.zillow.com/homes/${formattedAddress}-${zipCode}_rb/`;

  console.log(`[Zillow Direct] Fetching: ${searchUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'DNT': '1',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: ScrapingError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.url = searchUrl;
      error.httpStatus = response.status;
      throw error;
    }

    const html = await response.text();

    // Extract and parse __NEXT_DATA__ script
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
    if (!nextDataMatch) {
      console.error('[Zillow Direct] __NEXT_DATA__ script not found in page');
      return {};
    }

    try {
      const jsonData = JSON.parse(nextDataMatch[1]);
      const propertyData = extractPropertyFromNextData(jsonData);

      if (Object.keys(propertyData).length > 0) {
        console.log('[Zillow Direct] Successfully extracted property data:', propertyData);
        return propertyData;
      } else {
        console.warn('[Zillow Direct] No property data found in __NEXT_DATA__');
        return {};
      }
    } catch (parseError) {
      console.error('[Zillow Direct] Failed to parse __NEXT_DATA__ JSON:', parseError);
      return {};
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('[Zillow Direct] Fetch failed:', error.message);

      if ((error as ScrapingError).httpStatus === 404) {
        console.warn('[Zillow Direct] Property not found (404)');
      } else if ((error as ScrapingError).httpStatus === 403) {
        console.warn('[Zillow Direct] Access forbidden (403) - Use a proxy service');
      } else if ((error as ScrapingError).httpStatus === 429) {
        console.warn('[Zillow Direct] Rate limited (429)');
      } else if (error.name === 'AbortError') {
        console.warn('[Zillow Direct] Request timed out');
      }
    }

    return {};
  }
}

/**
 * Formats address for Zillow URL format
 * "1909 W Martha Ln" -> "1909-w-martha-ln"
 */
function formatAddressForUrl(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

/**
 * Extracts property data from Zillow's __NEXT_DATA__ JSON structure
 */
function extractPropertyFromNextData(data: any): Partial<ZillowPropertyData> {
  try {
    const cache = data?.props?.pageProps?.componentProps?.gdpClientCache;
    if (!cache) {
      console.warn('[Zillow Direct] gdpClientCache not found in __NEXT_DATA__');
      return {};
    }

    // Find the first key that starts with 'Property'
    const propertyKey = Object.keys(cache).find((k) => k.startsWith('Property'));
    if (!propertyKey) {
      console.warn('[Zillow Direct] No Property key found in cache');
      return {};
    }

    let property = cache[propertyKey];

    // Handle direct property object like "Property:123": {...}
    if (propertyKey.includes(':') && property) {
      return extractFromPropertyObject(property);
    }

    // Handle nested structure like Property: {"123": {...}, "456": {...}}
    if (typeof property === 'object' && property !== null) {
      // Find the first nested object that has property data
      const nestedKey = Object.keys(property).find((k) => {
        const p = property[k];
        return p?.area || p?.yearBuilt || p?.livingArea || p?.bedrooms || p?.bathrooms;
      });

      if (nestedKey) {
        return extractFromPropertyObject(property[nestedKey]);
      }

      // If property itself has the data (some Zillow pages structure it this way)
      if (property.area || property.yearBuilt || property.livingArea) {
        return extractFromPropertyObject(property);
      }
    }

    return {};
  } catch (error) {
    console.error('[Zillow Direct] Error extracting from __NEXT_DATA__:', error);
    return {};
  }
}

/**
 * Extracts common property fields from a Zillow property object
 */
function extractFromPropertyObject(property: any): Partial<ZillowPropertyData> {
  const result: Partial<ZillowPropertyData> = {};

  // Square footage - Zillow uses various field names
  if (property.livingArea) {
    result.sqFt = property.livingArea;
  } else if (property.area) {
    result.sqFt = property.area;
  } else if (property.livingAreaValue) {
    result.sqFt = property.livingAreaValue;
  }

  // Year built
  if (property.yearBuilt) {
    result.yearBuilt = property.yearBuilt;
  }

  // Lot size
  if (property.lotAreaValue) {
    result.lotSize = property.lotAreaValue;
  } else if (property.lotArea) {
    result.lotSize = property.lotArea;
  }

  // Bedrooms and bathrooms
  if (property.bedrooms) {
    result.bedrooms = property.bedrooms;
  }
  if (property.bathrooms) {
    result.bathrooms = property.bathrooms;
  }

  // Property type
  if (property.homeType) {
    result.propertyType = property.homeType;
  } else if (property.type) {
    result.propertyType = property.type;
  }

  // Zestimate (Zillow's estimated value)
  if (property.zestimate) {
    result.zestimate = property.zestimate;
  } else if (property.zestimateAmount) {
    result.zestimate = property.zestimateAmount;
  }

  // Address
  if (property.address) {
    result.address = property.address;
  } else if (property.streetAddress) {
    result.address = property.streetAddress;
  }

  return result;
}
