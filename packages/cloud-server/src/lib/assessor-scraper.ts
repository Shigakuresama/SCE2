/**
 * Orange County Assessor Property Data Fetcher
 *
 * IMPORTANT: As of 2025, Orange County Assessor's office uses an external
 * service called ParcelQuest for property searches. The old direct portal
 * at acpa.ocgov.com is no longer available.
 *
 * Current situation:
 * - Main site: https://www.ocassessor.gov/
 * - Property searches redirect to: ParcelQuest (external service)
 * - Direct scraping would require ParcelQuest API access
 *
 * Alternative approach: Use Zillow with ScraperAPI proxy, which is already
 * implemented and working reliably in proxy-scraper.ts
 *
 * If you need county assessor data, options are:
 * 1. Sign up for ParcelQuest API: https://www.parcelquest.com/
 * 2. Use other county assessor APIs (some counties have free APIs)
 * 3. Continue using Zillow as the primary data source
 */

export interface AssessorPropertyData {
  sqFt?: number;
  yearBuilt?: number;
  lotSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  apn?: string; // Assessor's Parcel Number
}

/**
 * Searches for property data in Orange County Assessor's database
 *
 * NOTE: Currently non-functional as OC uses ParcelQuest externally.
 * This is kept as a placeholder for future implementation if API access
 * is obtained.
 *
 * @param address - Street address (e.g., "1909 W Martha Ln")
 * @param zipCode - ZIP code (e.g., "92706")
 * @returns Empty object - use Zillow scraper instead
 */
export async function scrapeAssessorData(
  address: string,
  zipCode: string
): Promise<Partial<AssessorPropertyData>> {
  console.warn(`[Assessor] OC County now uses ParcelQuest - direct scraping unavailable`);
  console.warn(`[Assessor] Use Zillow scraper instead: scrapeZillowData("${address}", "${zipCode}")`);
  return {};
}

/**
 * Future: Implement ParcelQuest API integration
 *
 * To enable:
 * 1. Sign up at https://www.parcelquest.com/
 * 2. Get API credentials
 * 3. Add PARCELQUEST_API_KEY to .env
 * 4. Implement API call following their documentation
 *
 * Example structure:
 * async function scrapeWithParcelQuest(address: string, zipCode: string) {
 *   const apiUrl = 'https://api.parcelquest.com/v1/property';
 *   const response = await fetch(`${apiUrl}?address=${encodeURIComponent(address)}&zip=${zipCode}`, {
 *     headers: { 'Authorization': `Bearer ${process.env.PARCELQUEST_API_KEY}` }
 *   });
 *   return await response.json();
 * }
 */
