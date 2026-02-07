/**
 * Additional Customer Information Section
 * 18 fields for demographic and property details
 */
export interface AdditionalCustomerInfo {
  title?: string;
  preferredContactTime?: string;
  language?: string;
  ethnicity?: string;
  householdUnits?: string;
  spaceOrUnit?: string;
  howDidYouHear?: string;
  masterMetered?: string;
  buildingType?: string;
  homeownerStatus?: string;
  gasProvider?: string;
  gasAccountNumber?: string;
  waterUtility?: string;
  incomeVerifiedDate?: string;
  primaryApplicantAge?: string;
  permanentlyDisabled?: string;
  veteran?: string;
  nativeAmerican?: string;
}

export const ADDITIONAL_CUSTOMER_FIELDS = [
  'title',
  'preferredContactTime',
  'language',
  'ethnicity',
  'householdUnits',
  'spaceOrUnit',
  'howDidYouHear',
  'masterMetered',
  'buildingType',
  'homeownerStatus',
  'gasProvider',
  'gasAccountNumber',
  'waterUtility',
  'incomeVerifiedDate',
  'primaryApplicantAge',
  'permanentlyDisabled',
  'veteran',
  'nativeAmerican',
] as const;
