/**
 * Main Zillow scraping interface
 *
 * Exports the main scrapeZillowData function that:
 * 1. Checks cache
 * 2. Tries proxy services (if configured)
 * 3. Falls back to direct scraping
 */

export { scrapeZillowData, type ZillowPropertyData } from './proxy-scraper.js';
export { directScrapeZillow } from './zillow-scraper.js';
