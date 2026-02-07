/**
 * Data Transformation Utilities
 * Converts between different data formats and normalizes data
 */

// ==========================================
// TYPE TRANSFORMATIONS
// ==========================================

/**
 * Transform form data to API format
 */
export function toApiFormat(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in data) {
    const value = data[key];

    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // Convert camelCase to snake_case
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

    // Handle different value types
    if (typeof value === 'boolean') {
      result[snakeKey] = value ? '1' : '0';
    } else if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.join(',');
    } else {
      result[snakeKey] = value;
    }
  }

  return result;
}

/**
 * Transform API data to form format
 */
export function fromApiFormat(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in data) {
    const value = data[key];

    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // Handle different value types
    if (value === '1' || value === '0') {
      result[camelKey] = value === '1';
    } else if (typeof value === 'string' && value.includes(',')) {
      result[camelKey] = value.split(',');
    } else {
      result[camelKey] = value;
    }
  }

  return result;
}

// ==========================================
// DATA NORMALIZATION
// ==========================================

/**
 * Normalize phone number to (555) 123-4567 format
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

/**
 * Normalize date to ISO format
 */
export function normalizeDate(date: string): string {
  const parsed = new Date(date);

  if (isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toISOString().split('T')[0];
}

/**
 * Normalize name to Title Case
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize address (capitalization, spacing)
 */
export function normalizeAddress(address: string): string {
  return address
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(st|ave|blvd|rd|dr|way)\b/gi, match =>
      match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
    );
}

// ==========================================
// DATA MERGING
// ==========================================

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

/**
 * Merge section data with defaults
 */
export function mergeWithDefaults<T extends Record<string, any>>(
  data: Partial<T>,
  defaults: T
): T {
  return deepMerge(defaults, data);
}

// ==========================================
// DATA EXTRACTION
// ==========================================

/**
 * Extract first name from full name
 */
export function extractFirstName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  return parts[0] || '';
}

/**
 * Extract last name from full name
 */
export function extractLastName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

/**
 * Extract area code from phone number
 */
export function extractAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(0, 3);
}

/**
 * Extract digits only from string
 */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// ==========================================
// DATA COMPARISON
// ==========================================

/**
 * Compare two objects for equality (deep)
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Get differences between two objects
 */
export function getDifferences<T extends Record<string, any>>(
  original: T,
  updated: Partial<T>
): Map<keyof T, { original: any; updated: any }> {
  const differences = new Map<keyof T, { original: any; updated: any }>();

  for (const key in updated) {
    if (updated[key] !== undefined && !deepEqual(original[key], updated[key])) {
      differences.set(key as keyof T, {
        original: original[key],
        updated: updated[key],
      });
    }
  }

  return differences;
}

// ==========================================
// DATA SERIALIZATION
// ==========================================

/**
 * Serialize data for storage
 */
export function serializeForStorage(data: any): string {
  return JSON.stringify(data, (key, value) => {
    // Handle Date objects
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });
}

/**
 * Deserialize data from storage
 */
export function deserializeFromStorage(serialized: string): any {
  return JSON.parse(serialized, (key, value) => {
    // Handle Date objects
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  });
}

// ==========================================
// DATA AGGREGATION
// ==========================================

/**
 * Aggregate section data into a single object
 */
export function aggregateSections(sections: Record<string, any>): Record<string, any> {
  const aggregated: Record<string, any> = {};

  for (const sectionName in sections) {
    const sectionData = sections[sectionName];

    for (const key in sectionData) {
      // Skip empty values
      if (sectionData[key] === null || sectionData[key] === undefined || sectionData[key] === '') {
        continue;
      }

      // Use prefixed key to avoid conflicts
      const prefixedKey = `${sectionName}_${key}`;
      aggregated[prefixedKey] = sectionData[key];
    }
  }

  return aggregated;
}

/**
 * Flatten nested object
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten object
 */
export function unflattenObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    const parts = key.split('_');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = obj[key];
  }

  return result;
}

// ==========================================
// DATA GENERATION
// ==========================================

/**
 * Generate test data for a section
 */
export function generateTestData<T extends Record<string, any>>(
  template: T,
  overrides: Partial<T> = {}
): T {
  return { ...template, ...overrides };
}

/**
 * Generate random ID
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate timestamp
 */
export function generateTimestamp(): string {
  return new Date().toISOString();
}

// ==========================================
// DATA VALIDATION HELPERS
// ==========================================

/**
 * Check if data is empty
 */
export function isEmpty(data: any): boolean {
  if (data === null || data === undefined) return true;
  if (typeof data === 'string') return data.trim().length === 0;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
}

/**
 * Check if data has required fields
 */
export function hasRequiredFields<T extends Record<string, any>>(
  data: Partial<T>,
  requiredFields: (keyof T)[]
): boolean {
  return requiredFields.every(field => field in data && !isEmpty(data[field]));
}

/**
 * Get missing required fields
 */
export function getMissingFields<T extends Record<string, any>>(
  data: Partial<T>,
  requiredFields: (keyof T)[]
): (keyof T)[] {
  return requiredFields.filter(field => !(field in data) || isEmpty(data[field]));
}
