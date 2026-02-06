import React, { useState } from 'react';
import { mobileAPI, APIError } from '../lib/api';
import type { MobilePropertyData, FieldDataSubmission } from '../types';

interface FieldDataFormProps {
  property: MobilePropertyData;
  onSuccess?: (updatedProperty: MobilePropertyData) => void;
}

export const FieldDataForm: React.FC<FieldDataFormProps> = ({
  property,
  onSuccess,
}) => {
  const [customerAge, setCustomerAge] = useState<string>(
    property.customerAge?.toString() || ''
  );
  const [fieldNotes, setFieldNotes] = useState(property.fieldNotes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const submissionData: FieldDataSubmission = {};

      // Only include fields that have values
      if (customerAge) {
        const age = parseInt(customerAge, 10);
        if (isNaN(age) || age < 0 || age > 150) {
          throw new Error('Please enter a valid age (0-150)');
        }
        submissionData.customerAge = age;
      }

      if (fieldNotes.trim()) {
        submissionData.fieldNotes = fieldNotes.trim();
      }

      if (Object.keys(submissionData).length === 0) {
        throw new Error('Please enter at least one field');
      }

      const updatedProperty = await mobileAPI.submitFieldData(
        property.id,
        submissionData
      );

      onSuccess?.(updatedProperty);
    } catch (err) {
      if (err instanceof APIError) {
        setError(
          err.response?.message || err.message || 'Failed to submit data'
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
        Field Data Collection
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Age Input */}
        <div>
          <label
            htmlFor="customerAge"
            className="block text-sm font-semibold text-gray-700 mb-1"
          >
            Customer Age (Optional)
          </label>
          <input
            id="customerAge"
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min="0"
            max="150"
            value={customerAge}
            onChange={(e) => setCustomerAge(e.target.value)}
            placeholder="Enter age"
            disabled={submitting}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-base"
          />
          <p className="text-xs text-gray-500 mt-1">
            Current value: {property.customerAge || 'Not set'}
          </p>
        </div>

        {/* Field Notes Textarea */}
        <div>
          <label
            htmlFor="fieldNotes"
            className="block text-sm font-semibold text-gray-700 mb-1"
          >
            Field Notes (Optional)
          </label>
          <textarea
            id="fieldNotes"
            value={fieldNotes}
            onChange={(e) => setFieldNotes(e.target.value)}
            placeholder="Enter observations, special instructions, or notes..."
            disabled={submitting}
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none text-base"
          />
          <p className="text-xs text-gray-500 mt-1">
            {property.fieldNotes ? 'Updating existing notes' : 'New notes'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-semibold mb-1">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-h-[44px]"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            'Save Field Data'
          )}
        </button>

        {/* Current Values Display */}
        {(property.customerAge || property.fieldNotes) && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Current Values on Server:
            </p>
            {property.customerAge && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Age:</span>{' '}
                {property.customerAge} years
              </p>
            )}
            {property.fieldNotes && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Notes:</span>{' '}
                {property.fieldNotes.substring(0, 100)}
                {property.fieldNotes.length > 100 ? '...' : ''}
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
