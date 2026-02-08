// ============= PDF Form Data Export Utilities =============
// Syncs fillable PDF field data (AGE, NOTES) with database properties

import type { Property } from '../types';

/**
 * Validation result for a form field
 */
export interface FieldValidationResult {
  valid: boolean;
  error?: string;
  userMessage?: string;
}

/**
 * Mapped PDF field data to property
 */
export interface PDFFieldMapping {
  propertyId: number;
  customerAge?: number | null;
  fieldNotes?: string | null;
}

/**
 * Parsed field name components
 */
interface ParsedFieldName {
  propertyId: number;
  fieldType: 'age' | 'notes';
}

/**
 * Parses a PDF field name to extract property ID and field type
 *
 * @param fieldName - Field name in format "property_{id}_{type}"
 * @returns Parsed components or null if invalid format
 */
function parseFieldName(fieldName: string): ParsedFieldName | null {
  // Field name format: "property_{propertyId}_{fieldType}"
  const match = fieldName.match(/^property_(\d+)_(age|notes)$/);

  if (!match) {
    return null;
  }

  const propertyId = parseInt(match[1], 10);
  const fieldType = match[2] as 'age' | 'notes';

  if (isNaN(propertyId)) {
    return null;
  }

  return { propertyId, fieldType };
}

/**
 * Validates age field value
 *
 * @param value - Age value to validate
 * @returns Validation result with error message if invalid
 */
export function validateAge(value: string | number | null | undefined): FieldValidationResult {
  // Empty value is valid (optional field)
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  // Convert to number if string
  const ageValue = typeof value === 'string' ? parseInt(value, 10) : value;

  // Check if valid number
  if (isNaN(ageValue)) {
    return {
      valid: false,
      error: 'Age must be a valid number',
      userMessage: 'Please enter a valid number for age',
    };
  }

  // Check range (0-150)
  if (ageValue < 0 || ageValue > 150) {
    return {
      valid: false,
      error: 'Age must be between 0 and 150',
      userMessage: 'Age must be between 0 and 150',
    };
  }

  return { valid: true };
}

/**
 * Validates notes field value
 *
 * @param value - Notes value to validate (accepts any type for flexibility)
 * @returns Validation result with error message if invalid
 */
export function validateNotes(value: any): FieldValidationResult {
  // Empty value is valid (optional field)
  if (value === null || value === undefined) {
    return { valid: true };
  }

  const notesValue = String(value).trim();

  // Check length (max 500 characters)
  if (notesValue.length > 500) {
    return {
      valid: false,
      error: 'Notes must be 500 characters or less',
      userMessage: `Notes too long (${notesValue.length}/500 characters)`,
    };
  }

  return { valid: true };
}

/**
 * Validates a form field based on its type
 *
 * @param fieldType - Type of field ('age' or 'notes')
 * @param value - Field value to validate
 * @returns Validation result
 */
export function validateFormField(
  fieldType: 'age' | 'notes',
  value: string | number | null | undefined
): FieldValidationResult {
  if (fieldType === 'age') {
    return validateAge(value);
  } else if (fieldType === 'notes') {
    return validateNotes(value);
  }

  return {
    valid: false,
    error: `Unknown field type: ${fieldType}`,
  };
}

/**
 * Validates a form field based on its field name
 * This is a convenience function for UI components that use field names
 *
 * @param fieldName - Field name in format "property_{id}_{type}" or ending with "_age" or "_notes"
 * @param value - Field value to validate
 * @returns Validation result with user-friendly error message
 */
export function validateFormFieldByName(
  fieldName: string,
  value: string
): { valid: boolean; error?: string; userMessage?: string } {
  // Age field validation
  if (fieldName.endsWith('_age')) {
    if (!value || value.trim() === '') {
      return {
        valid: true, // Empty is allowed (optional field)
      };
    }

    const age = parseInt(value, 10);
    if (isNaN(age)) {
      return {
        valid: false,
        error: 'Age must be a number',
        userMessage: 'Please enter a valid number for age',
      };
    }
    if (age < 0 || age > 150) {
      return {
        valid: false,
        error: 'Age must be between 0 and 150',
        userMessage: 'Age must be between 0 and 150',
      };
    }
  }

  // Notes field validation
  if (fieldName.endsWith('_notes')) {
    if (value.length > 500) {
      return {
        valid: false,
        error: 'Notes must be 500 characters or less',
        userMessage: `Notes too long (${value.length}/500 characters)`,
      };
    }
  }

  return { valid: true };
}

/**
 * Extracts PDF field data from form data and maps to properties
 *
 * This function processes filled PDF form data and creates mappings
 * from property IDs to the field values (age, notes).
 *
 * @param formData - Form data object with field names as keys
 * @param properties - Array of properties to map against
 * @returns Array of PDF field mappings with property IDs
 */
export function extractPDFDataToProperties(
  formData: Record<string, string | number>,
  properties: Property[]
): PDFFieldMapping[] {
  const mappings: Map<number, PDFFieldMapping> = new Map();

  // Process each form field
  for (const [fieldName, value] of Object.entries(formData)) {
    // Parse field name to extract property ID and field type
    const parsed = parseFieldName(fieldName);
    if (!parsed) continue;

    const { propertyId, fieldType } = parsed;

    // Validate the field value
    const validation = validateFormField(fieldType, value);
    if (!validation.valid) {
      console.warn(
        `Invalid value for field ${fieldName} (property ${propertyId}): ${validation.error}`
      );
      continue;
    }

    // Get or create mapping for this property
    let mapping = mappings.get(propertyId);
    if (!mapping) {
      mapping = { propertyId };
      mappings.set(propertyId, mapping);
    }

    // Map field value to property field
    if (fieldType === 'age') {
      const ageValue = typeof value === 'string' ? parseInt(value, 10) : value;
      mapping.customerAge = isNaN(ageValue) ? null : ageValue;
    } else if (fieldType === 'notes') {
      mapping.fieldNotes = String(value).trim() || null;
    }
  }

  // Convert map to array and filter out properties that don't exist
  return Array.from(mappings.values()).filter(
    (mapping) => properties.some((p) => p.id === mapping.propertyId)
  );
}

/**
 * Generates form data from properties for PDF pre-filling
 *
 * This function creates the inverse mapping - from property data
 * to the form field names used in the PDF.
 *
 * @param properties - Array of properties to convert to form data
 * @returns Form data object with field names as keys
 */
export function generateFormDataFromProperties(
  properties: Property[]
): Record<string, string> {
  const formData: Record<string, string> = {};

  for (const property of properties) {
    // Age field
    if (property.customerAge !== null && property.customerAge !== undefined) {
      const ageFieldName = `property_${property.id}_age`;
      formData[ageFieldName] = property.customerAge.toString();
    }

    // Notes field
    if (property.fieldNotes) {
      const notesFieldName = `property_${property.id}_notes`;
      formData[notesFieldName] = property.fieldNotes;
    }
  }

  return formData;
}

/**
 * Applies PDF field mappings to properties
 *
 * Updates property objects with the mapped field values.
 * Returns new property objects (does not mutate originals).
 *
 * @param properties - Array of properties to update
 * @param mappings - PDF field mappings from extractPDFDataToProperties
 * @returns Updated properties array
 */
export function applyPDFMappingsToProperties(
  properties: Property[],
  mappings: PDFFieldMapping[]
): Property[] {
  const mappingMap = new Map(mappings.map((m) => [m.propertyId, m]));

  return properties.map((property) => {
    const mapping = mappingMap.get(property.id);
    if (!mapping) return property;

    return {
      ...property,
      customerAge: mapping.customerAge !== undefined ? mapping.customerAge : property.customerAge,
      fieldNotes: mapping.fieldNotes !== undefined ? mapping.fieldNotes : property.fieldNotes,
    };
  });
}

/**
 * Exports PDF field data for API submission
 *
 * Converts PDF field mappings to the format expected by the
 * properties update API endpoint.
 *
 * @param mappings - PDF field mappings from extractPDFDataToProperties
 * @returns Array of property update objects for API
 */
export function exportPDFDataForAPI(mappings: PDFFieldMapping[]): Array<{
  id: number;
  customerAge?: number | null;
  fieldNotes?: string | null;
}> {
  return mappings.map((mapping) => ({
    id: mapping.propertyId,
    ...(mapping.customerAge !== undefined && { customerAge: mapping.customerAge }),
    ...(mapping.fieldNotes !== undefined && { fieldNotes: mapping.fieldNotes }),
  }));
}

/**
 * Validates all PDF field mappings
 *
 * Checks that all mapped values are valid and that property IDs exist.
 *
 * @param mappings - PDF field mappings to validate
 * @param properties - Array of properties to validate against
 * @returns Object with validation result and errors
 */
export function validatePDFMappings(
  mappings: PDFFieldMapping[],
  properties: Property[]
): {
  valid: boolean;
  errors: string[];
  validMappings: PDFFieldMapping[];
} {
  const errors: string[] = [];
  const validMappings: PDFFieldMapping[] = [];
  const propertyIds = new Set(properties.map((p) => p.id));

  for (const mapping of mappings) {
    // Check if property exists
    if (!propertyIds.has(mapping.propertyId)) {
      errors.push(`Property ID ${mapping.propertyId} does not exist`);
      continue;
    }

    // Validate age if provided
    if (mapping.customerAge !== undefined && mapping.customerAge !== null) {
      const ageValidation = validateAge(mapping.customerAge);
      if (!ageValidation.valid) {
        errors.push(
          `Property ${mapping.propertyId}: ${ageValidation.error}`
        );
        continue;
      }
    }

    // Validate notes if provided
    if (mapping.fieldNotes !== undefined && mapping.fieldNotes !== null) {
      const notesValidation = validateNotes(mapping.fieldNotes);
      if (!notesValidation.valid) {
        errors.push(
          `Property ${mapping.propertyId}: ${notesValidation.error}`
        );
        continue;
      }
    }

    validMappings.push(mapping);
  }

  return {
    valid: errors.length === 0,
    errors,
    validMappings,
  };
}
