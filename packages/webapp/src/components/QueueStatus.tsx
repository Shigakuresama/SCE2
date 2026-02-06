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
