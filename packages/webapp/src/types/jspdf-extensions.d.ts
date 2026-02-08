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
  namespace jsPDF {
    /**
     * AcroForm field alignment
     */
    type FieldAlignment = 0 | 1 | 2; // 0=Left, 1=Center, 2=Right

    /**
     * Text field for AcroForm
     */
    interface TextField {
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
      /** Text alignment */
      Q?: FieldAlignment;
      /** Maximum character length */
      maxLength?: number;
      /** Read-only flag */
      readOnly?: boolean;
      /** Multi-line flag */
      multiline?: boolean;
      /** Border color */
      borderColor?: number[];
      /** Background color */
      backgroundColor?: number[];
    }

    /**
     * Textarea field for AcroForm (multi-line text)
     */
    interface TextareaField extends TextField {
      /** Multi-line must be true for textarea */
      multiline: true;
    }

    /**
     * AcroForm namespace
     */
    interface AcroForm {
      /** Constructor for text fields */
      TextField: new () => TextField;
      /** Constructor for textarea fields */
      TextareaField: new () => TextareaField;
    }

    /**
     * Extended jsPDF API with AcroForm support
     */
    interface API {
      /** AcroForm functionality */
      AcroForm: AcroForm;
      /**
       * Add a form field to the PDF
       * @param field - Form field to add
       */
      addField(field: TextField | TextareaField): jsPDF;
    }

    /**
     * Extended internal namespace with AcroForm
     */
    namespace internal {
      interface HttpResponse {
        AcroForm?: AcroForm;
      }
    }
  }

  /**
   * Extended jsPDF class with AcroForm property
   */
  interface jsPDF {
    /**
     * AcroForm functionality (not in official types)
     */
    AcroForm: {
      TextField: new () => jsPDF.TextField;
      TextareaField: new () => jsPDF.TextareaField;
    };
  }
}

export {};
