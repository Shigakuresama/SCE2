import React, { useState } from 'react';
import { generateRouteSheet } from '../lib/pdf-generator';
import type { Property } from '../types';

interface PDFGeneratorProps {
  properties: Property[];
  selectedProperties: Property[];
}

export const PDFGenerator: React.FC<PDFGeneratorProps> = ({
  properties,
  selectedProperties,
}) => {
  const [loading, setLoading] = useState(false);
  const [includeQR, setIncludeQR] = useState(true);
  const [includeCustomerData, setIncludeCustomerData] = useState(true);
  const [notes, setNotes] = useState('');

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
      console.error('Failed to generate PDF:', error);
      alert(
        `Failed to generate PDF: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

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

        {/* Generate button */}
        <div className="flex justify-end">
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
