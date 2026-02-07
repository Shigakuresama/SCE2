/**
 * Basic Enrollment Section
 * 2 fields for basic enrollment info
 */

export interface BasicEnrollmentInfo {
  utilityAccount?: string;
  rateSchedule?: string;
}

export const BASIC_ENROLLMENT_FIELDS = [
  'utilityAccount',
  'rateSchedule',
] as const;
