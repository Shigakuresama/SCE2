import { Router } from 'express';
import { scrapeZillowData } from '../lib/zillow.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ValidationError } from '../types/errors.js';

export const zillowRoutes = Router();

/**
 * GET /api/zillow/scrape
 *
 * Scrapes property data from Zillow for a given address
 *
 * Query params:
 * - address: Street address (required)
 * - zipCode: ZIP code (required)
 *
 * Returns:
 * - success: boolean
 * - data: Property data from Zillow
 */
zillowRoutes.get(
  '/scrape',
  asyncHandler(async (req, res) => {
    const { address, zipCode } = req.query;

    // Validate required parameters
    if (!address || typeof address !== 'string') {
      throw new ValidationError('Address is required and must be a string');
    }

    if (!zipCode || typeof zipCode !== 'string') {
      throw new ValidationError('ZIP code is required and must be a string');
    }

    // Validate ZIP code format (basic 5-digit check)
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      throw new ValidationError('Invalid ZIP code format');
    }

    console.log(`[Zillow API] Scraping request for: ${address}, ${zipCode}`);

    // Scrape Zillow
    const propertyData = await scrapeZillowData(address, zipCode);

    res.json({
      success: true,
      data: propertyData,
    });
  })
);

/**
 * GET /api/zillow/health
 *
 * Health check endpoint for Zillow scraping service
 */
zillowRoutes.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'zillow-scraper',
    status: 'operational',
  });
});
