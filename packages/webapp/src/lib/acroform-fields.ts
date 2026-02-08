// packages/webapp/src/lib/acroform-fields.ts
import { jsPDF } from 'jspdf';

/**
 * Interface for AcroForm text field options
 */
export interface TextFieldOptions {
  name: string; // Unique field name (e.g., "prop123_age")
  value: string; // Default/pre-filled value
  x: number; // Position X (mm)
  y: number; // Position Y (mm)
  width: number; // Field width (mm)
  height: number; // Field height (mm)
  fontSize?: number; // Text size
  maxLength?: number; // Max character limit
  readOnly?: boolean; // Make field read-only
  alignment?: 'left' | 'center' | 'right'; // Text alignment
}

/**
 * Interface for AcroForm textarea options
 */
export interface TextareaFieldOptions {
  name: string;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  maxLength?: number;
  readOnly?: boolean;
}

/**
 * Add a fillable text field to PDF (like IRS W-2 form fields)
 */
export function addTextField(
  doc: jsPDF,
  label: string,
  options: TextFieldOptions
): void {
  const {
    name,
    value,
    x,
    y,
    width,
    height,
    fontSize = 10,
    maxLength,
    readOnly = false,
    alignment = 'left'
  } = options;

  // Draw label above field
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(label, x, y - 2);
  doc.setTextColor(0);

  // Create AcroForm text field using jsPDF API
  // @ts-ignore - jsPDF types don't include AcroForm but it exists at runtime
  const textField = new doc.AcroForm.TextField();
  textField.fieldName = name;
  textField.value = value;
  textField.x = x;
  textField.y = y;
  textField.width = width;
  textField.height = height;
  textField.fontSize = fontSize;

  // Set alignment (0=left, 1=center, 2=right)
  if (alignment === 'center') {
    textField.Q = 1;
  } else if (alignment === 'right') {
    textField.Q = 2;
  }

  // Optional properties
  if (maxLength) {
    textField.maxLength = maxLength;
  }

  if (readOnly) {
    textField.readOnly = true;
  }

  doc.addField(textField);
}

/**
 * Add a fillable textarea (multi-line text field) to PDF
 */
export function addTextareaField(
  doc: jsPDF,
  label: string,
  options: TextareaFieldOptions
): void {
  const {
    name,
    value,
    x,
    y,
    width,
    height,
    fontSize = 8,
    maxLength,
    readOnly = false
  } = options;

  // Draw label above field
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(label, x, y - 2);
  doc.setTextColor(0);

  // Create AcroForm textarea using jsPDF API
  // @ts-ignore - jsPDF types don't include AcroForm but it exists at runtime
  const textareaField = new doc.AcroForm.TextField();
  textareaField.fieldName = name;
  textareaField.value = value;
  textareaField.x = x;
  textareaField.y = y;
  textareaField.width = width;
  textareaField.height = height;
  textareaField.fontSize = fontSize;
  textareaField.multiline = true; // Enable multi-line

  // Optional properties
  if (maxLength) {
    textareaField.maxLength = maxLength;
  }

  if (readOnly) {
    textareaField.readOnly = true;
  }

  doc.addField(textareaField);
}

/**
 * Generate unique field name for property
 * Format: "property_{propertyId}_{fieldName}"
 */
export function generateFieldName(propertyId: number, fieldName: string): string {
  return `property_${propertyId}_${fieldName}`;
}
