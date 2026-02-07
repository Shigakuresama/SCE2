/**
 * Assessment Questionnaire Section
 * 11 checkbox/text fields for property assessment
 */

export interface AssessmentInfo {
  hasAttic?: string;
  hasBasement?: string;
  hasCrawlspace?: string;
  heatingType?: string;
  coolingType?: string;
  waterHeaterType?: string;
  windowType?: string;
  insulationLevel?: string;
  hasSolar?: string;
  hasPool?: string;
  notes?: string;
}

export const ASSESSMENT_FIELDS = [
  'hasAttic',
  'hasBasement',
  'hasCrawlspace',
  'heatingType',
  'coolingType',
  'waterHeaterType',
  'windowType',
  'insulationLevel',
  'hasSolar',
  'hasPool',
  'notes',
] as const;
