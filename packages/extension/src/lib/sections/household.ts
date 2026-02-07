/**
 * Household Members Section
 * 2 fields for household information
 */

export interface HouseholdInfo {
  householdSize?: string;
  incomeLevel?: string;
}

export const HOUSEHOLD_FIELDS = [
  'householdSize',
  'incomeLevel',
] as const;
