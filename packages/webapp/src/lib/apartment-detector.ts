/**
 * Apartment Detection Utility
 *
 * Determines if an address represents an apartment complex or single-family home.
 * Used to differentiate map markers (orange for apartments, blue for houses).
 */

import { Property } from '../types';
import type { SearchResult as GeocodingResult } from './geocoding';

// Re-export SearchResult from geocoding to maintain single source of truth
export type SearchResult = GeocodingResult;

/**
 * Check if an address represents an apartment complex.
 *
 * Detection strategies:
 * 1. Check name/display_name for apartment keywords
 * 2. Check display_name for apartment patterns (unit numbers, etc.)
 *
 * @param address - Property or SearchResult to check
 * @returns true if apartment, false if house/unknown
 */
export function isApartment(address: Property | SearchResult): boolean {
  // Combine all searchable fields
  let searchFields = '';

  if ('display_name' in address) {
    // SearchResult
    searchFields = [
      (address as SearchResult).name || '',
      address.display_name || '',
    ].join(' ').toLowerCase();
  } else {
    // Property
    searchFields = [
      (address as Property).addressFull || '',
    ].join(' ').toLowerCase();
  }

  // Apartment keywords
  const aptKeywords = [
    'apartment',
    'apt',
    'complex',
    'tower',
    'condo',
    'condominium',
    'flats',
    'residence',
  ];

  // Check keywords
  if (aptKeywords.some((keyword) => searchFields.includes(keyword))) {
    return true;
  }

  // Apartment patterns (unit numbers, etc.)
  const aptPatterns = [
    /\b(unit|apt|apt\.|suite|ste|ste\.|room|rm|#)\s*[a-z0-9]+/i,
    /\bapartments?\b/i,
    /\bcondos?\b/i,
    /\bcondominiums?\b/i,
    /\bflats\b/i,
  ];

  // Check patterns
  if (aptPatterns.some((pattern) => pattern.test(searchFields))) {
    return true;
  }

  return false;
}

/**
 * Get marker icon class for an address.
 *
 * @param address - Property or SearchResult to check
 * @returns 'apartment' or 'house'
 */
export function getMarkerType(address: Property | SearchResult): 'apartment' | 'house' {
  return isApartment(address) ? 'apartment' : 'house';
}
