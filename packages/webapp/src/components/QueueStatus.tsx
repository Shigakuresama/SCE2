import React, { useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

export const QueueStatus: React.FC = () => {
  const { queueStatus, refreshQueueStatus } = useApp();

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(refreshQueueStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshQueueStatus]);

  if (!queueStatus) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Scrape Queue Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-900">
              Properties Waiting
            </h3>
            <p className="text-xs text-blue-600 mt-1">
              In scrape queue
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">
              {queueStatus.scrapeQueue}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Queue Card */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-green-900">
              Ready to Submit
            </h3>
            <p className="text-xs text-green-600 mt-1">
              In submit queue
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-600">
              {queueStatus.submitQueue}
            </div>
          </div>
        </div>
      </div>

      {/* Processing Indicator */}
      {queueStatus.processing && (
        <div className="md:col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-yellow-600"
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm font-medium text-yellow-800">
              Extension is actively processing queue items
            </span>
          </div>
        </div>
      )}

      {/* Manual Refresh Button */}
      <div className="md:col-span-2">
        <button
          onClick={refreshQueueStatus}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        >
          Refresh Queue Status
        </button>
      </div>
    </div>
  );
};
