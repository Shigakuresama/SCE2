// packages/webapp/src/components/AddressRangeInput.tsx

import React, { useState } from 'react';

interface AddressRangeInputProps {
  onAddressesExtracted: (addresses: string[]) => void;
}

export const AddressRangeInput: React.FC<AddressRangeInputProps> = ({
  onAddressesExtracted,
}) => {
  const [streetName, setStreetName] = useState('');
  const [startNum, setStartNum] = useState('');
  const [endNum, setEndNum] = useState('');
  const [zipCode, setZipCode] = useState('');

  const handleExtract = () => {
    if (!streetName || !startNum || !endNum || !zipCode) {
      alert('Please fill in all fields');
      return;
    }

    const start = parseInt(startNum, 10);
    const end = parseInt(endNum, 10);

    if (isNaN(start) || isNaN(end) || start > end) {
      alert('Invalid address range');
      return;
    }

    // Generate addresses
    const addresses: string[] = [];
    for (let num = start; num <= end; num++) {
      addresses.push(`${num} ${streetName}, ${zipCode}`);
    }

    if (addresses.length > 50) {
      const proceed = confirm(`${addresses.length} addresses generated. Continue?`);
      if (!proceed) return;
    }

    onAddressesExtracted(addresses);

    // Reset form
    setStartNum('');
    setEndNum('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Address Range Input
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Street Name
          </label>
          <input
            type="text"
            value={streetName}
            onChange={(e) => setStreetName(e.target.value)}
            placeholder="e.g., W Martha Ln"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ZIP Code
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="e.g., 92706"
            maxLength={5}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Number
          </label>
          <input
            type="number"
            value={startNum}
            onChange={(e) => setStartNum(e.target.value)}
            placeholder="e.g., 100"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Number
          </label>
          <input
            type="number"
            value={endNum}
            onChange={(e) => setEndNum(e.target.value)}
            placeholder="e.g., 200"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Generates addresses from {startNum || '?'} to {endNum || '?'} {streetName || '(street)'}
        </div>

        <button
          onClick={handleExtract}
          disabled={!streetName || !startNum || !endNum || !zipCode}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            !streetName || !startNum || !endNum || !zipCode
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Generate Addresses
        </button>
      </div>
    </div>
  );
};
