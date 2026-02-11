import React, { useMemo, useState } from 'react';
import { mobileAPI, APIError } from '../lib/api';
import type { Document, MobilePropertyData } from '../types';

interface CompleteVisitButtonProps {
  propertyId: number;
  documents: Document[];
  status: string;
  onCompleted: (property: MobilePropertyData) => void;
}

export const CompleteVisitButton: React.FC<CompleteVisitButtonProps> = ({
  propertyId,
  documents,
  status,
  onCompleted,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBill = useMemo(
    () => documents.some((document) => document.docType === 'BILL'),
    [documents]
  );
  const hasSignature = useMemo(
    () => documents.some((document) => document.docType === 'SIGNATURE'),
    [documents]
  );

  const isReadyForField = status === 'READY_FOR_FIELD';
  const canComplete = isReadyForField && hasBill && hasSignature;

  const handleCompleteVisit = async () => {
    if (!canComplete || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updatedProperty = await mobileAPI.completeVisit(propertyId);
      onCompleted(updatedProperty);
    } catch (err) {
      if (err instanceof APIError) {
        setError(
          err.response?.message || err.message || 'Failed to complete visit'
        );
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2">
        Complete Field Visit
      </h2>

      <button
        type="button"
        onClick={handleCompleteVisit}
        disabled={!canComplete || submitting}
        className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-h-[44px]"
      >
        {submitting ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Completing...
          </>
        ) : (
          'Complete Visit'
        )}
      </button>

      {!canComplete && (
        <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
          <p className="text-sm font-semibold mb-1">Before completing:</p>
          <ul className="text-sm list-disc list-inside">
            {!isReadyForField && <li>Property status must be READY_FOR_FIELD</li>}
            {!hasBill && <li>Upload utility BILL photo</li>}
            {!hasSignature && <li>Upload SIGNATURE</li>}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};
