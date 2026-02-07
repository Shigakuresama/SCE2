import React, { useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

export const QueueStatus: React.FC = () => {
  const { queueStatus, errors, refreshQueueStatus } = useApp();

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(refreshQueueStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshQueueStatus]);

  // Show error UI if there's an error and no data
  if (errors.queueStatus && !queueStatus) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg
              className="h-5 w-5 text-yellow-600 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium text-yellow-800">
              Unable to load queue status. Check your connection or try refreshing.
            </span>
          </div>
          <button
            onClick={refreshQueueStatus}
            className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!queueStatus) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600"
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
          <span className="text-sm font-medium text-gray-700">Loading queue status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Pending Scrape */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-center">
          <h3 className="text-xs font-medium text-gray-700 mb-1">
            Pending Scrape
          </h3>
          <div className="text-2xl font-bold text-gray-600">
            {queueStatus.pendingScrape}
          </div>
        </div>
      </div>

      {/* Ready for Field */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-center">
          <h3 className="text-xs font-medium text-blue-700 mb-1">
            Ready for Field
          </h3>
          <div className="text-2xl font-bold text-blue-600">
            {queueStatus.readyForField}
          </div>
        </div>
      </div>

      {/* Visited */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="text-center">
          <h3 className="text-xs font-medium text-purple-700 mb-1">
            Visited
          </h3>
          <div className="text-2xl font-bold text-purple-600">
            {queueStatus.visited}
          </div>
        </div>
      </div>

      {/* Ready for Submission */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="text-center">
          <h3 className="text-xs font-medium text-yellow-700 mb-1">
            Ready for Submit
          </h3>
          <div className="text-2xl font-bold text-yellow-600">
            {queueStatus.readyForSubmission}
          </div>
        </div>
      </div>

      {/* Complete */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="text-center">
          <h3 className="text-xs font-medium text-green-700 mb-1">
            Complete
          </h3>
          <div className="text-2xl font-bold text-green-600">
            {queueStatus.complete}
          </div>
        </div>
      </div>

      {/* Failed */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-center">
          <h3 className="text-xs font-medium text-red-700 mb-1">
            Failed
          </h3>
          <div className="text-2xl font-bold text-red-600">
            {queueStatus.failed}
          </div>
        </div>
      </div>

      {/* Manual Refresh Button - full width */}
      <div className="col-span-2 md:col-span-3 lg:col-span-6">
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
