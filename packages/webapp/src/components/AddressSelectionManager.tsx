// packages/webapp/src/components/AddressSelectionManager.tsx

import React, { useState } from 'react';
import { AddressRangeInput } from './AddressRangeInput';
import { AddressImport } from './AddressImport';
import type { Property } from '../types';
import { PropertyStatus } from '../types';

interface AddressSelectionManagerProps {
  properties: Property[];
  setProperties: (properties: Property[]) => void;
  selectedProperties: Property[];
  setSelectedProperties: (properties: Property[]) => void;
  onEnablePinMode?: () => void;
}

type SelectionMethod = 'draw' | 'range' | 'import' | 'pins' | 'database';

export const AddressSelectionManager: React.FC<AddressSelectionManagerProps> = ({
  properties,
  setProperties,
  selectedProperties,
  setSelectedProperties,
  onEnablePinMode,
}) => {
  const [activeMethod, setActiveMethod] = useState<SelectionMethod | null>(null);

  const handleAddressesFromRange = (addresses: string[]) => {
    const now = new Date();
    const newProps = addresses.map((addr, index) => {
      // Parse the address
      const parts = addr.split(',').map(p => p.trim());
      const streetPart = parts[0] || '';
      const streetParts = streetPart.split(/\s+/);
      const number = streetParts[0] || '';
      const street = streetParts.slice(1).join(' ') || '';
      const zipPart = parts[parts.length - 1] || '';

      return {
        id: `range_${now.getTime()}_${index}` as unknown as number,
        createdAt: now,
        updatedAt: now,
        addressFull: addr,
        streetNumber: number || null,
        streetName: street || null,
        zipCode: zipPart || null,
        city: parts[1] || null,
        state: 'CA',
        latitude: null,
        longitude: null,
        status: PropertyStatus.PENDING_SCRAPE,
        customerName: null,
        customerPhone: null,
        customerEmail: null,
        customerAge: null,
        fieldNotes: null,
        sceCaseId: null,
        routeId: null,
      } as Property;
    });

    setProperties([...properties, ...newProps]);
    setSelectedProperties(newProps);
    setActiveMethod(null);
  };

  const handleAddressesFromImport = (addresses: string[]) => {
    const now = new Date();
    const newProps = addresses.map((addr, index) => {
      // Parse the address
      const parts = addr.split(',').map(p => p.trim());
      const streetPart = parts[0] || '';
      const streetParts = streetPart.split(/\s+/);
      const number = streetParts[0] || '';
      const street = streetParts.slice(1).join(' ') || '';
      const zipPart = parts[parts.length - 1] || '';

      return {
        id: `import_${now.getTime()}_${index}` as unknown as number,
        createdAt: now,
        updatedAt: now,
        addressFull: addr,
        streetNumber: number || null,
        streetName: street || null,
        zipCode: zipPart || null,
        city: parts[1] || null,
        state: 'CA',
        latitude: null,
        longitude: null,
        status: PropertyStatus.PENDING_SCRAPE,
        customerName: null,
        customerPhone: null,
        customerEmail: null,
        customerAge: null,
        fieldNotes: null,
        sceCaseId: null,
        routeId: null,
      } as Property;
    });

    setProperties([...properties, ...newProps]);
    setSelectedProperties(newProps);
    setActiveMethod(null);
  };

  const handlePinsFromDatabase = (dbProperties: Property[]) => {
    setSelectedProperties(dbProperties);
    setActiveMethod(null);
  };

  const handleEnablePinMode = () => {
    setActiveMethod('pins');
    onEnablePinMode?.();
  };

  return (
    <div className="space-y-6">
      {/* Selection method tabs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Add Addresses to Route
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            onClick={() => setActiveMethod('draw')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              activeMethod === 'draw'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">✏️</div>
            <div className="text-sm font-medium">Draw on Map</div>
            <div className="text-xs text-gray-500">Draw shapes</div>
          </button>

          <button
            onClick={() => setActiveMethod('range')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              activeMethod === 'range'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">🔢</div>
            <div className="text-sm font-medium">Address Range</div>
            <div className="text-xs text-gray-500">100-200 Main St</div>
          </button>

          <button
            onClick={handleEnablePinMode}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              activeMethod === 'pins'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">📍</div>
            <div className="text-sm font-medium">Pin Addresses</div>
            <div className="text-xs text-gray-500">Click on map</div>
          </button>

          <button
            onClick={() => setActiveMethod('import')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              activeMethod === 'import'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">📋</div>
            <div className="text-sm font-medium">Import List</div>
            <div className="text-xs text-gray-500">Paste addresses</div>
          </button>

          <button
            onClick={() => setActiveMethod('database')}
            className={`p-4 rounded-lg border-2 text-center transition-colors ${
              activeMethod === 'database'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">🗄️</div>
            <div className="text-sm font-medium">From Database</div>
            <div className="text-xs text-gray-500">Select existing</div>
          </button>
        </div>

        {/* Clear selection */}
        {activeMethod && (
          <button
            onClick={() => setActiveMethod(null)}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to selection methods
          </button>
        )}
      </div>

      {/* Active method content */}
      {activeMethod === 'range' && (
        <AddressRangeInput onAddressesExtracted={handleAddressesFromRange} />
      )}

      {activeMethod === 'import' && (
        <AddressImport onAddressesImported={handleAddressesFromImport} />
      )}

      {activeMethod === 'database' && (
        <DatabasePropertySelector
          properties={properties}
          onSelect={handlePinsFromDatabase}
        />
      )}

      {/* Selected count */}
      {selectedProperties.length > 0 && !activeMethod && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex justify-between items-center">
          <span className="text-blue-800">
            {selectedProperties.length} addresses selected
          </span>
          <button
            onClick={() => setSelectedProperties([])}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

// Database property selector component
function DatabasePropertySelector({
  properties,
  onSelect
}: {
  properties: Property[];
  onSelect: (props: Property[]) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = properties.filter(prop =>
    prop.addressFull?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prop.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-md font-semibold mb-4">Select from Database</h3>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search addresses..."
        className="block w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="max-h-64 overflow-y-auto space-y-2">
        {filtered.slice(0, 50).map(prop => (
          <div
            key={prop.id}
            className="p-3 border rounded hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onSelect([prop])}
          >
            <div className="font-medium">{prop.addressFull}</div>
            {prop.customerName && (
              <div className="text-sm text-gray-600">{prop.customerName}</div>
            )}
            <div className="text-xs text-gray-500">Status: {prop.status}</div>
          </div>
        ))}
      </div>

      {filtered.length > 50 && (
        <div className="text-sm text-gray-500 mt-2">
          Showing 50 of {filtered.length} results
        </div>
      )}
    </div>
  );
}
