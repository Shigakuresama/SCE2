/**
 * Type definitions for jsPDF AcroForm API
 *
 * jsPDF includes AcroForm support but the TypeScript definitions don't include it.
 * This module extends the jsPDF types to include AcroForm support.
 *
 * Source: https://github.com/parallax/jsPDF
 * AcroForm docs: https://artskydj.github.io/jsPDF/docs/module-acroform.html
 */

declare module 'jspdf' {
  interface jsPDF {
    /**
     * AcroForm functionality (not in official types)
     */
    AcroForm: {
      TextField: new () => AcroFormField;
      TextareaField: new () => AcroFormField;
    };
  }

  /**
   * AcroForm field (fillable PDF form field)
   */
  interface AcroFormField {
    /** Field name (must be unique) */
    fieldName: string;
    /** Current value */
    value: string | number;
    /** X position in document */
    x: number;
    /** Y position in document */
    y: number;
    /** Field width */
    width: number;
    /** Field height */
    height: number;
    /** Font size for text */
    fontSize?: number;
    /** Text alignment (0=left, 1=center, 2=right) */
    Q?: 0 | 1 | 2;
    /** Maximum character length */
    maxLength?: number;
    /** Read-only flag */
    readOnly?: boolean;
    /** Multi-line flag */
    multiline?: boolean;
  }
}

export {};
