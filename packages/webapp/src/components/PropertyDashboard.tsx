import React, { useState } from 'react';
import { PropertyStatus } from '../types';
import { PropertyList } from './PropertyList';
import { useApp } from '../contexts/AppContext';

interface PropertyDashboardProps {
  onQueueSuccess?: () => void;
}

export const PropertyDashboard: React.FC<PropertyDashboardProps> = ({
  onQueueSuccess: _onQueueSuccess,
}) => {
  const { properties, queueStatus, loading, error, fetchProperties, clearError } =
    useApp();
  const [filter, setFilter] = useState<PropertyStatus | 'ALL'>('ALL');

  const filteredProperties = properties.filter((property) => {
    if (filter === 'ALL') return true;
    return property.status === filter;
  });

  const handleRefresh = () => {
    clearError();
    fetchProperties();
  };

  const stats = {
    total: properties.length,
    pendingScrape: properties.filter((p) => p.status === PropertyStatus.PENDING_SCRAPE).length,
    readyForField: properties.filter((p) => p.status === PropertyStatus.READY_FOR_FIELD).length,
    visited: properties.filter((p) => p.status === PropertyStatus.VISITED).length,
    readyForSubmission: properties.filter((p) => p.status === PropertyStatus.READY_FOR_SUBMISSION).length,
    complete: properties.filter((p) => p.status === PropertyStatus.COMPLETE).length,
    failed: properties.filter((p) => p.status === PropertyStatus.FAILED).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and monitor your SCE rebate properties
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Total</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">
            {stats.total}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Pending Scrape</div>
          <div className="mt-2 text-3xl font-semibold text-yellow-600">
            {stats.pendingScrape}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Ready for Field</div>
          <div className="mt-2 text-3xl font-semibold text-blue-600">
            {stats.readyForField}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Ready for Submission</div>
          <div className="mt-2 text-3xl font-semibold text-indigo-600">
            {stats.readyForSubmission}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Complete</div>
          <div className="mt-2 text-3xl font-semibold text-green-600">
            {stats.complete}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600">Failed</div>
          <div className="mt-2 text-3xl font-semibold text-red-600">
            {stats.failed}
          </div>
        </div>
      </div>

      {/* Queue Status */}
      {queueStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Queue Status
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Scrape Queue:</span>{' '}
              <span className="font-semibold">{queueStatus.scrapeQueue}</span>
            </div>
            <div>
              <span className="text-blue-700">Submit Queue:</span>{' '}
              <span className="font-semibold">{queueStatus.submitQueue}</span>
            </div>
            <div>
              <span className="text-blue-700">Processing:</span>{' '}
              <span className="font-semibold">
                {queueStatus.processing ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Filter:</label>
        <select
          value={filter}
          onChange={(e) =>
            setFilter(e.target.value as PropertyStatus | 'ALL')
          }
          className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="ALL">All Properties</option>
          <option value={PropertyStatus.PENDING_SCRAPE}>Pending Scrape</option>
          <option value={PropertyStatus.READY_FOR_FIELD}>Ready for Field</option>
          <option value={PropertyStatus.VISITED}>Visited</option>
          <option value={PropertyStatus.READY_FOR_SUBMISSION}>Ready for Submission</option>
          <option value={PropertyStatus.COMPLETE}>Complete</option>
          <option value={PropertyStatus.FAILED}>Failed</option>
        </select>
      </div>

      {/* Property List */}
      <PropertyList
        properties={filteredProperties}
        loading={loading}
        onPropertyClick={(property) => console.log('Selected:', property)}
      />
    </div>
  );
};
