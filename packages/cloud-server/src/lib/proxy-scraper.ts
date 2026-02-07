/**
 * Proxy-based Zillow Scraper
 *
 * Uses proxy services to bypass Zillow's anti-bot protection.
 *
 * Supported services:
 * 1. ScraperAPI (https://scraperapi.com/) - $49/month, reliable
 * 2. ZenRows (https://zenrows.com/) - $49/month, better success rate
 * 3. RapidAPI - Various Zillow scrapers starting at $5/month
 *
 * Configuration via environment variables:
 * - SCRAPER_API_KEY: Your ScraperAPI key
 * - ZENROWS_API_KEY: Your ZenRows API key
 * - RAPIDAPI_KEY: Your RapidAPI key
 */

import { directScrapeZillow } from './zillow-scraper.js';
import type { ZillowPropertyData } from './zillow-scraper.js';

// Re-export the type
export type { ZillowPropertyData } from './zillow-scraper.js';

// Cache to avoid repeated requests to the same address
const zillowCache = new Map<string, Partial<ZillowPropertyData>>();

// Simple in-memory cache with TTL (1 hour)
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Main entry point for Zillow scraping with caching
 * Tries proxy services first, then falls back to direct scraping
 * If no data found, returns fallback defaults
 */
export async function scrapeZillowData(
  address: string,
  zipCode: string
): Promise<Partial<ZillowPropertyData>> {
  const cacheKey = `${address}_${zipCode}`;

  // Check cache first
  const cachedTimestamp = cacheTimestamps.get(cacheKey);
  if (cachedTimestamp && Date.now() - cachedTimestamp < CACHE_TTL) {
    const cached = zillowCache.get(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      console.log('[Zillow] Using cached data for', cacheKey);
      return cached;
    }
  }

  // Use proxy scraper (tries all configured proxy services, falls back to direct)
  const propertyData = await scrapeZillowWithProxy(address, zipCode);

  // If no data found, use fallback defaults
  if (Object.keys(propertyData).length === 0) {
    console.warn('[Zillow] No property data found, using fallback defaults');
    const defaults = {
      sqFt: 1200,
      yearBuilt: 1970,
    };
    return defaults;
  }

  // Cache the result
  zillowCache.set(cacheKey, propertyData);
  cacheTimestamps.set(cacheKey, Date.now());

  return propertyData;
}

// Service priority (tries in order)
const PROXY_SERVICES = ['scraperapi', 'zenrows', 'rapidapi'] as const;
type ProxyService = typeof PROXY_SERVICES[number];

/**
 * Scrapes Zillow using proxy services with automatic fallback
 */
export async function scrapeZillowWithProxy(
  address: string,
  zipCode: string
): Promise<Partial<ZillowPropertyData>> {
  // Try each proxy service in order
  for (const service of PROXY_SERVICES) {
    const apiKey = getApiKey(service);

    if (!apiKey) {
      console.log(`[Proxy] ${service} - No API key configured, skipping`);
      continue;
    }

    console.log(`[Proxy] Trying ${service}...`);

    try {
      const data = await scrapeWithService(service, apiKey, address, zipCode);

      if (Object.keys(data).length > 0) {
        console.log(`[Proxy] ✅ ${service} succeeded!`);
        return data;
      } else {
        console.log(`[Proxy] ${service} returned no data, trying next...`);
      }
    } catch (error) {
      console.error(`[Proxy] ${service} failed:`, error instanceof Error ? error.message : error);
      // Continue to next service
    }
  }

  // All proxy services failed or none configured, fall back to direct scraping
  console.warn('[Proxy] All proxy services failed or not configured, falling back to direct scraping');
  return directScrapeZillow(address, zipCode);
}

/**
 * Scrapes using a specific proxy service
 */
async function scrapeWithService(
  service: ProxyService,
  apiKey: string,
  address: string,
  zipCode: string
): Promise<Partial<ZillowPropertyData>> {
  const formattedAddress = formatAddressForUrl(address);
  const zillowUrl = `https://www.zillow.com/homes/${formattedAddress}-${zipCode}_rb/`;

  switch (service) {
    case 'scraperapi':
      return scrapeWithScraperAPI(apiKey, zillowUrl);
    case 'zenrows':
      return scrapeWithZenRows(apiKey, zillowUrl);
    case 'rapidapi':
      return scrapeWithRapidAPI(apiKey, address, zipCode);
    default:
      throw new Error(`Unknown proxy service: ${service}`);
  }
}

/**
 * Scrapes using ScraperAPI
 * API docs: https://scraperapi.com/documentation/
 */
async function scrapeWithScraperAPI(
  apiKey: string,
  zillowUrl: string
): Promise<Partial<ZillowPropertyData>> {
  // ScraperAPI format: http://api.scraperapi.com?api_key=XXX&url=URL
  const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(zillowUrl)}`;

  console.log('[ScraperAPI] Fetching:', zillowUrl);

  const response = await fetch(proxyUrl);

  if (!response.ok) {
    console.error('[ScraperAPI] HTTP error:', response.status);
    throw new Error(`ScraperAPI error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  console.log('[ScraperAPI] Got HTML, length:', html.length, 'contains __NEXT_DATA__:', html.includes('__NEXT_DATA__'));

  const result = parseZillowHtml(html);

  // If no data found, use fallback defaults
  if (Object.keys(result).length === 0) {
    console.warn('[ScraperAPI] No property data found, using fallback defaults');
    return {
      sqFt: 1200,
      yearBuilt: 1970,
    };
  }

  return result;
}

/**
 * Scrapes using ZenRows
 * API docs: https://www.zenrows.com/documentation
 */
async function scrapeWithZenRows(
  apiKey: string,
  zillowUrl: string
): Promise<Partial<ZillowPropertyData>> {
  // ZenRows format: https://api.zenrows.com/v1/
  const proxyUrl = 'https://api.zenrows.com/v1/';

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apikey: apiKey,
      url: zillowUrl,
      js_render: true,
      premium_proxy: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`ZenRows error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return parseZillowHtml(html);
}

/**
 * Scrapes using RapidAPI (Zillow Scraper API)
 * Using "Zillow Search Results API" from RapidAPI
 * API docs: https://rapidapi.com/sparior-api/api/zillow-scraper
 */
async function scrapeWithRapidAPI(
  apiKey: string,
  address: string,
  zipCode: string
): Promise<Partial<ZillowPropertyData>> {
  // Using the Zillow Search Results API from RapidAPI
  const apiUrl = 'https://zillow-scraper.p.rapidapi.com/search';

  const response = await fetch(
    `${apiUrl}?address=${encodeURIComponent(address)}&zip_code=${zipCode}`,
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'zillow-scraper.p.rapidapi.com',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status} ${response.statusText}`);
  }

  const json: any = await response.json();

  // Parse RapidAPI response format
  if (json.data && json.data.length > 0) {
    const property = json.data[0];
    return {
      sqFt: property.livingArea || property.area,
      yearBuilt: property.yearBuilt,
      lotSize: property.lotAreaValue,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      propertyType: property.homeType,
      zestimate: property.zestimate,
      address: property.address,
    };
  }

  return {};
}

/**
 * Parses Zillow HTML to extract property data
 */
function parseZillowHtml(html: string): Partial<ZillowPropertyData> {
  // Extract and parse __NEXT_DATA__ script
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);

  if (!nextDataMatch) {
    console.error('[Proxy] __NEXT_DATA__ not found in response');
    return {};
  }

  console.log('[Proxy] Found __NEXT_DATA__, length:', nextDataMatch[1].length);

  try {
    const jsonData = JSON.parse(nextDataMatch[1]);
    console.log('[Proxy] Parsed JSON, keys:', Object.keys(jsonData).slice(0, 10));

    const result = extractPropertyFromNextData(jsonData);
    console.log('[Proxy] Extracted property data:', result);

    return result;
  } catch (error) {
    console.error('[Proxy] Failed to parse __NEXT_DATA__:', error);
    return {};
  }
}

/**
 * Extracts property data from Zillow's __NEXT_DATA__ JSON structure
 */
function extractPropertyFromNextData(data: any): Partial<ZillowPropertyData> {
  try {
    console.log('[Zillow] Extracting from __NEXT_DATA__');

    const cache = data?.props?.pageProps?.componentProps?.gdpClientCache;
    if (!cache) {
      console.warn('[Zillow] gdpClientCache not found');
      console.log('[Zillow] Available props.pageProps keys:', Object.keys(data?.props?.pageProps || {}).slice(0, 20));
      return {};
    }

    console.log('[Zillow] Found cache, keys:', Object.keys(cache).slice(0, 20));

    // Try old format first (keys starting with 'Property')
    let propertyKey = Object.keys(cache).find((k) => k.startsWith('Property'));

    // If not found, try numeric keys (new Zillow format)
    if (!propertyKey) {
      console.log('[Zillow] No Property key, trying numeric keys...');
      // Find the first cache entry that has property data
      propertyKey = Object.keys(cache).find((k) => {
        const entry = cache[k];
        if (!entry || typeof entry !== 'object') return false;

        // Check if this entry has property fields
        const keys = Object.keys(entry);
        console.log('[Zillow] Checking cache entry', k, 'keys:', keys.slice(0, 15));

        // Look for common property field names
        return keys.some(key =>
          key.toLowerCase().includes('area') ||
          key.toLowerCase().includes('yearbuilt') ||
          key.toLowerCase().includes('price') ||
          key.toLowerCase().includes('bedroom') ||
          key.toLowerCase().includes('bathroom')
        );
      });
    }

    if (!propertyKey) {
      console.warn('[Zillow] No property key found in cache');
      return {};
    }

    console.log('[Zillow] Found property key:', propertyKey);

    let property = cache[propertyKey];

    if (propertyKey.includes(':') && property) {
      console.log('[Zillow] Direct property, sample keys:', Object.keys(property).slice(0, 10));
      return extractFromPropertyObject(property);
    }

    if (typeof property === 'object' && property !== null) {
      console.log('[Zillow] Property object, searching for data fields...');

      // Look for a nested object with property data
      const nestedKey = Object.keys(property).find((k) => {
        const p = property[k];
        if (!p || typeof p !== 'object') return false;
        return p?.area || p?.yearBuilt || p?.livingArea || p?.livingAreaValue || p?.price;
      });

      if (nestedKey) {
        console.log('[Zillow] Found nested key:', nestedKey, 'with data');
        return extractFromPropertyObject(property[nestedKey]);
      }

      // Check if property object itself has the data
      if (property.area || property.yearBuilt || property.livingArea || property.livingAreaValue) {
        console.log('[Zillow] Data at root level');
        return extractFromPropertyObject(property);
      }

      console.log('[Zillow] No property data fields found');
    }

    console.warn('[Zillow] No property data found');
    return {};
  } catch (error) {
    console.error('[Zillow] Extraction error:', error);
    return {};
  }
}

/**
 * Extracts common property fields from a Zillow property object
 */
function extractFromPropertyObject(property: any): Partial<ZillowPropertyData> {
  const result: Partial<ZillowPropertyData> = {};

  if (property.livingArea) result.sqFt = property.livingArea;
  else if (property.area) result.sqFt = property.area;
  else if (property.livingAreaValue) result.sqFt = property.livingAreaValue;

  if (property.yearBuilt) result.yearBuilt = property.yearBuilt;

  if (property.lotAreaValue) result.lotSize = property.lotAreaValue;
  else if (property.lotArea) result.lotSize = property.lotArea;

  if (property.bedrooms) result.bedrooms = property.bedrooms;
  if (property.bathrooms) result.bathrooms = property.bathrooms;

  if (property.homeType) result.propertyType = property.homeType;
  else if (property.type) result.propertyType = property.type;

  if (property.zestimate) result.zestimate = property.zestimate;
  else if (property.zestimateAmount) result.zestimate = property.zestimateAmount;

  if (property.address) result.address = property.address;
  else if (property.streetAddress) result.address = property.streetAddress;

  return result;
}

/**
 * Formats address for Zillow URL format
 */
function formatAddressForUrl(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

/**
 * Gets API key for a specific service from environment variables
 */
function getApiKey(service: ProxyService): string | null {
  switch (service) {
    case 'scraperapi':
      return process.env.SCRAPER_API_KEY || null;
    case 'zenrows':
      return process.env.ZENROWS_API_KEY || null;
    case 'rapidapi':
      return process.env.RAPIDAPI_KEY || null;
    default:
      return null;
  }
}
