/**
 * Trade Ally Information Section
 * 5 fields for contractor/trade ally details
 */

export interface TradeAllyInfo {
  firstName?: string;
  lastName?: string;
  title?: string;
  phone?: string;
  email?: string;
}

export const TRADE_ALLY_FIELDS = [
  'firstName',
  'lastName',
  'title',
  'phone',
  'email',
] as const;
