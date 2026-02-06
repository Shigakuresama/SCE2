import React from 'react';
import { Property, PropertyStatus } from '../types';

interface PropertyCardProps {
  property: Property;
  onClick: () => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onClick }) => {
  const getStatusColor = (status: PropertyStatus) => {
    switch (status) {
      case PropertyStatus.PENDING_SCRAPE:
        return 'bg-yellow-100 text-yellow-800';
      case PropertyStatus.READY_FOR_FIELD:
        return 'bg-blue-100 text-blue-800';
      case PropertyStatus.VISITED:
        return 'bg-purple-100 text-purple-800';
      case PropertyStatus.READY_FOR_SUBMISSION:
        return 'bg-indigo-100 text-indigo-800';
      case PropertyStatus.COMPLETE:
        return 'bg-green-100 text-green-800';
      case PropertyStatus.FAILED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: PropertyStatus) => {
    switch (status) {
      case PropertyStatus.PENDING_SCRAPE:
        return 'Pending Scrape';
      case PropertyStatus.READY_FOR_FIELD:
        return 'Ready for Field';
      case PropertyStatus.VISITED:
        return 'Visited';
      case PropertyStatus.READY_FOR_SUBMISSION:
        return 'Ready for Submission';
      case PropertyStatus.COMPLETE:
        return 'Complete';
      case PropertyStatus.FAILED:
        return 'Failed';
      default:
        return status;
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {property.addressFull}
          </h3>
          {property.city && property.state && (
            <p className="text-sm text-gray-600">
              {property.city}, {property.state} {property.zipCode}
            </p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            property.status
          )}`}
        >
          {getStatusLabel(property.status)}
        </span>
      </div>

      {property.customerName && (
        <div className="mb-2">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Customer:</span> {property.customerName}
          </p>
          {property.customerPhone && (
            <p className="text-sm text-gray-600">{property.customerPhone}</p>
          )}
        </div>
      )}

      {property.fieldNotes && (
        <div className="mb-2">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Notes:</span> {property.fieldNotes}
          </p>
        </div>
      )}

      {property.sceCaseId && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium">SCE Case ID:</span> {property.sceCaseId}
          </p>
        </div>
      )}

      {property.createdAt && (
        <p className="text-xs text-gray-400 mt-2">
          Created: {new Date(property.createdAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};
