/**
 * Bonus Program Section
 * 2 fields for bonus program info
 */

export interface BonusInfo {
  bonusProgram?: string;
  bonusAmount?: string;
}

export const BONUS_FIELDS = [
  'bonusProgram',
  'bonusAmount',
] as const;
