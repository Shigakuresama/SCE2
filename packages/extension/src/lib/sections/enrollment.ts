/**
 * Enrollment Information Section
 * 2 fields for enrollment details
 */

export interface EnrollmentInfo {
  enrollmentDate?: string;
  programSource?: string;
}

export const ENROLLMENT_FIELDS = [
  'enrollmentDate',
  'programSource',
] as const;
