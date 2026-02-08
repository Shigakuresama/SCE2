import React, { useState } from 'react';
import { generateRouteSheet } from '../lib/pdf-generator';
import { extractPDFDataToProperties, validateFormFieldByName } from '../lib/pdf-export';
import { logError } from '../lib/logger';
import type { Property } from '../types';

interface PDFGeneratorProps {
  properties: Property[];
  selectedProperties: Property[];
  onPropertiesUpdated?: () => void;
}

export const PDFGenerator: React.FC<PDFGeneratorProps> = ({
  properties,
  selectedProperties,
  onPropertiesUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [includeQR, setIncludeQR] = useState(true);
  const [includeCustomerData, setIncludeCustomerData] = useState(true);
  const [notes, setNotes] = useState('');
  // Form data state - will be populated by PDF viewer in future implementation
  // For now, the export functionality provides infrastructure for data sync
  const [formData, setFormData] = useState<Record<string, string>>({});
  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Exporting state to prevent double-clicks
  const [exporting, setExporting] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);

      // Use selected properties if any are selected, otherwise use all properties
      const propertiesToInclude =
        selectedProperties.length > 0 ? selectedProperties : properties;

      if (propertiesToInclude.length === 0) {
        alert('No properties available to generate PDF');
        return;
      }

      await generateRouteSheet(propertiesToInclude, {
        includeQR,
        includeCustomerData,
        notes: notes.trim(),
      });
    } catch (error) {
      logError('PDF generation failed', error, {
        propertiesCount: propertiesToInclude.length,
        includeQR,
        includeCustomerData
      });
      alert(
        `Failed to generate PDF: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDFData = async () => {
    if (Object.keys(formData).length === 0) {
      alert('No form data to export');
      return;
    }

    // Prevent double-click
    if (exporting) {
      return;
    }

    try {
      setExporting(true);

      // Extract form data to property mappings
      const { mappings, errors: validationErrors } = extractPDFDataToProperties(formData, properties);

      // Display validation errors if any
      if (validationErrors.length > 0) {
        const errorMap: Record<string, string> = {};
        validationErrors.forEach(err => {
          errorMap[`${err.propertyId}_${err.fieldType}`] = err.message;
        });
        setErrors(errorMap);

        alert(
          `Validation failed for ${validationErrors.length} field(s). ` +
          'Please fix the errors and try again.'
        );
        return;
      }

      if (mappings.length === 0) {
        alert('No valid form data to export');
        return;
      }

      // Save each property to database with error tracking
      const results = await Promise.allSettled(
        mappings.map(mapping =>
          fetch(`/api/properties/${mapping.propertyId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerAge: mapping.customerAge,
              fieldNotes: mapping.fieldNotes
            })
          })
        )
      );

      const failures = results.filter(r => r.status === 'rejected');
      const successes = results.filter(r => r.status === 'fulfilled');

      if (failures.length > 0) {
        logError('PDF export partial failure', undefined, {
          total: mappings.length,
          succeeded: successes.length,
          failed: failures.length
        });

        alert(
          `Warning: Only ${successes.length} of ${mappings.length} properties updated. ` +
          `${failures.length} failed. Check your internet connection and try again.`
        );
      } else {
        alert(`Form data exported successfully for ${successes.length} property/properties!`);
        onPropertiesUpdated?.();
      }
    } catch (error) {
      logError('PDF form data export failed', error, {
        propertiesCount: mappings.length
      });
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(
        `Failed to export form data: ${message}\n\n` +
        `Please check your internet connection and try again.`
      );
    } finally {
      setExporting(false);
    }
  };

  const handleFormFieldChange = (fieldName: string, value: string) => {
    // Validate field
    const validation = validateFormFieldByName(fieldName, value);
    if (!validation.valid) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: validation.userMessage || 'Invalid value'
      }));
      return;
    }

    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });

    // Update form data state
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // Export handler for use by PDF viewer or form components
  // This function will be used when form fields are added to the UI
  // Currently prepared for future integration
  (window as any).handleFormFieldChange = handleFormFieldChange;

  const propertyCount =
    selectedProperties.length > 0
      ? selectedProperties.length
      : properties.length;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Generate Route Sheet PDF
      </h2>

      <div className="space-y-4">
        {/* Property count display */}
        <div className="text-sm text-gray-600">
          {selectedProperties.length > 0 ? (
            <span>
              Generating for <strong>{selectedProperties.length}</strong>{' '}
              selected propert
              {selectedProperties.length !== 1 ? 'ies' : 'y'}
            </span>
          ) : (
            <span>
              Generating for <strong>{properties.length}</strong> total propert
              {properties.length !== 1 ? 'ies' : 'y'}
            </span>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-4">
          {/* Include QR codes */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={includeQR}
              onChange={(e) => setIncludeQR(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Include QR codes for mobile access
            </span>
          </label>

          {/* Include customer data */}
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={includeCustomerData}
              onChange={(e) => setIncludeCustomerData(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Include customer data
            </span>
          </label>
        </div>

        {/* Notes textarea */}
        <div>
          <label
            htmlFor="pdf-notes"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Notes (optional)
          </label>
          <textarea
            id="pdf-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Add any notes for the route sheet (e.g., special instructions, reminders, etc.)"
          />
        </div>

        {/* Error display */}
        {Object.keys(errors).length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
            <h3 className="text-red-800 font-semibold mb-2">Please fix the following errors:</h3>
            <ul className="list-disc list-inside text-red-700">
              {Object.entries(errors).map(([fieldName, message]) => (
                <li key={fieldName}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Generate button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleExportPDFData}
            disabled={Object.keys(formData).length === 0 || exporting}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
              Object.keys(formData).length === 0 || exporting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <svg
              className="-ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            {exporting ? 'Exporting...' : 'Export PDF Form Data'}
          </button>

          <button
            onClick={handleGenerate}
            disabled={loading || propertyCount === 0}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              loading || propertyCount === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg
                  className="-ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Generate PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
