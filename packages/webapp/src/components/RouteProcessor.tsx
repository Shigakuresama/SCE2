// packages/webapp/src/components/RouteProcessor.tsx

import React, { useState, useRef, useCallback } from 'react';
import type { Property } from '../types';

interface RouteProcessorProps {
  properties: Property[];
  selectedProperties: Property[];
  onProcessingComplete: (results: any[]) => void;
  onPropertiesUpdated: () => void;
}

export const RouteProcessor: React.FC<RouteProcessorProps> = ({
  properties,
  selectedProperties,
  onProcessingComplete,
  onPropertiesUpdated,
}) => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    percent: 0,
    message: ''
  });
  const [results, setResults] = useState<any[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const propertiesToProcess = selectedProperties.length > 0
    ? selectedProperties
    : properties;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleProcess = async () => {
    if (propertiesToProcess.length === 0) {
      alert('No properties to process');
      return;
    }

    if (typeof chrome === 'undefined' || !chrome.runtime) {
      alert('Route processing requires the Chrome Extension to be installed. Please load the SCE2 extension and try again.');
      return;
    }

    try {
      setProcessing(true);
      setProgress({
        current: 0,
        total: propertiesToProcess.length,
        percent: 0,
        message: 'Starting...'
      });

      const addresses = propertiesToProcess.map(prop => {
        const parts = prop.addressFull?.split(',') || [];
        const streetPart = parts[0]?.trim() || '';
        const zipPart = parts[parts.length - 1]?.trim() || prop.zipCode || '';
        const streetParts = streetPart.split(/\s+/);
        const number = streetParts[0] || '';
        const street = streetParts.slice(1).join(' ');

        return {
          number,
          street,
          city: parts[1]?.trim() || '',
          state: 'CA',
          zip: zipPart,
          full: prop.addressFull || ''
        };
      });

      // Start batch processing (returns when complete)
      const responsePromise = chrome.runtime.sendMessage({
        action: 'PROCESS_ROUTE_BATCH',
        addresses,
        config: { maxConcurrentTabs: 3 }
      });

      // Poll for progress every 2 seconds while batch runs
      pollingRef.current = setInterval(async () => {
        try {
          const status = await chrome.runtime.sendMessage({
            action: 'GET_ROUTE_STATUS'
          });
          if (status?.success && status.data) {
            const { processedCount, totalCount, successfulCount, failedCount, isProcessing } = status.data;
            const percent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;
            setProgress({
              current: processedCount,
              total: totalCount,
              percent,
              message: isProcessing
                ? `Processing ${processedCount}/${totalCount}...`
                : `Complete: ${successfulCount} successful, ${failedCount} failed`
            });

            if (!isProcessing && processedCount > 0) {
              stopPolling();
            }
          }
        } catch {
          // Extension may be busy, skip this poll
        }
      }, 2000);

      // Wait for the final response
      const response = await responsePromise;
      stopPolling();

      if (response && response.success) {
        setResults(response.data.results);
        setProgress({
          current: response.data.results.length,
          total: response.data.results.length,
          percent: 100,
          message: `Complete: ${response.data.results.filter((r: any) => r.success).length} successful`
        });
        onProcessingComplete(response.data.results);
        onPropertiesUpdated();
      } else {
        throw new Error(response?.error || 'Processing failed');
      }

    } catch (error) {
      stopPolling();
      console.error('Processing failed:', error);
      alert(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-green-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <svg className="w-6 h-6 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Extract Customer Data from SCE
      </h2>

      <div className="space-y-4">
        {/* Property count */}
        <div className="text-sm text-gray-600">
          {propertiesToProcess.length} propert{propertiesToProcess.length !== 1 ? 'ies' : 'y'} to process
        </div>

        {/* Progress bar */}
        {processing && (
          <div className="space-y-2 bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{progress.message}</span>
              <span className="font-bold text-blue-600">{progress.percent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {progress.current} / {progress.total} processed
            </div>
          </div>
        )}

        {/* Results summary */}
        {results.length > 0 && !processing && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 font-medium">
                Complete! {successful} successful, {failed} failed
              </span>
            </div>
            {failed > 0 && (
              <div className="text-sm text-red-600 mt-1">
                {failed} addresses could not be processed
              </div>
            )}
          </div>
        )}

        {/* Extract button */}
        <div className="flex justify-end">
          <button
            onClick={handleProcess}
            disabled={processing || propertiesToProcess.length === 0}
            className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
              processing || propertiesToProcess.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {processing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Extract Customer Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
