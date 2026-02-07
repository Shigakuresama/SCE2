/**
 * Terms and Conditions Section
 * 2 fields for terms acceptance
 */

export interface TermsInfo {
  termsAccepted?: boolean;
  consentDate?: string;
}

export const TERMS_FIELDS = [
  'termsAccepted',
  'consentDate',
] as const;
