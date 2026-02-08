import React from 'react';
import type { MobilePropertyData } from '../types';

interface PropertyInfoProps {
  property: MobilePropertyData;
}

export const PropertyInfo: React.FC<PropertyInfoProps> = ({ property }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2">
        Property Information
      </h2>

      {/* Address */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Address</h3>
        <p className="text-gray-900">{property.addressFull}</p>
        {property.city && (
          <p className="text-gray-600 text-sm">
            {property.city}, {property.state || 'N/A'} {property.zipCode}
          </p>
        )}
      </div>

      {/* Customer Information */}
      {(property.customerName || property.customerPhone || property.customerEmail) && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Customer Information
          </h3>
          <div className="space-y-1">
            {property.customerName && (
              <p className="text-gray-900">
                <span className="font-medium">Name:</span> {property.customerName}
              </p>
            )}
            {property.customerPhone && (
              <p className="text-gray-900">
                <span className="font-medium">Phone:</span>{' '}
                <a
                  href={`tel:${property.customerPhone}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {property.customerPhone}
                </a>
              </p>
            )}
            {property.customerEmail && (
              <p className="text-gray-900">
                <span className="font-medium">Email:</span>{' '}
                <a
                  href={`mailto:${property.customerEmail}`}
                  className="text-blue-600 hover:text-blue-800 break-all"
                >
                  {property.customerEmail}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Existing Field Notes */}
      {property.fieldNotes && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Notes (from PDF)
          </h3>
          <p className="text-gray-600 text-sm bg-gray-50 p-2 rounded">
            {property.fieldNotes}
          </p>
        </div>
      )}

      {/* Existing Customer Age */}
      {property.customerAge && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Age (from PDF)
          </h3>
          <p className="text-gray-900">{property.customerAge} years old</p>
        </div>
      )}

      {/* Status Badge */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        <span className="text-sm text-gray-600">Status:</span>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            property.status === 'READY_FOR_FIELD'
              ? 'bg-blue-100 text-blue-800'
              : property.status === 'VISITED'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {property.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Coordinates */}
      {property.latitude && property.longitude && (
        <div className="mt-4 pt-3 border-t">
          <a
            href={`https://www.google.com/maps/?q=${property.latitude},${property.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 text-sm hover:text-blue-800"
          >
            📍 Open in Maps
          </a>
        </div>
      )}
    </div>
  );
};
