import React, { useState, useEffect } from 'react';
import { mobileAPI, APIError } from '../lib/api';
import type { MobilePropertyData } from '../types';

interface PropertyLoaderProps {
  propertyId: number;
  children: (property: MobilePropertyData) => React.ReactNode;
}

export const PropertyLoader: React.FC<PropertyLoaderProps> = ({
  propertyId,
  children,
}) => {
  const [property, setProperty] = useState<MobilePropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProperty = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await mobileAPI.fetchPropertyData(propertyId);
      setProperty(data);
    } catch (err) {
      if (err instanceof APIError) {
        setError(
          err.response?.message ||
            err.message ||
            'Failed to load property data'
        );
      } else {
        setError('An unexpected error occurred');
      }
      console.error('Error loading property:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Loading Property
          </h2>
          <p className="text-gray-600">Fetching property data from server...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="text-red-600 text-5xl mb-4 text-center">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadProperty}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Retry
          </button>
          <p className="text-center text-gray-500 text-sm mt-4">
            Property ID: {propertyId}
          </p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Data</h2>
          <p className="text-gray-600">Property not found</p>
        </div>
      </div>
    );
  }

  return <>{children(property)}</>;
};
