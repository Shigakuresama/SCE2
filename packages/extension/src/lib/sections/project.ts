/**
 * Project Information Section
 * 3 fields for property details, plus optional Zillow data
 */

export interface ProjectInfo {
  squareFootage?: string;
  yearBuilt?: string;
  propertyType?: string;
  // Optional Zillow-enriched data
  zillowSqFt?: number;
  zillowYearBuilt?: number;
  zestimate?: number;
}

export const PROJECT_FIELDS = [
  'squareFootage',
  'yearBuilt',
  'propertyType',
] as const;
