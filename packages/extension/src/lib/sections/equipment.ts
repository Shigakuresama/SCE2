/**
 * Equipment Information Section
 * 3 fields for equipment details
 */

export interface EquipmentInfo {
  primaryHeating?: string;
  primaryCooling?: string;
  waterHeater?: string;
}

export const EQUIPMENT_FIELDS = [
  'primaryHeating',
  'primaryCooling',
  'waterHeater',
] as const;
