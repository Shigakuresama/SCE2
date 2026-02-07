/**
 * Status Section
 * 2 fields for application status
 */

export interface StatusInfo {
  applicationStatus?: string;
  lastUpdated?: string;
}

export const STATUS_FIELDS = [
  'applicationStatus',
  'lastUpdated',
] as const;
