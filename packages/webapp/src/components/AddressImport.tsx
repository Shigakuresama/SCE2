// packages/webapp/src/components/AddressImport.tsx

import React, { useState } from 'react';

interface AddressImportProps {
  onAddressesImported: (addresses: string[]) => void;
}

export const AddressImport: React.FC<AddressImportProps> = ({
  onAddressesImported,
}) => {
  const [importText, setImportText] = useState('');

  const handleImport = () => {
    if (!importText.trim()) {
      alert('Please enter addresses to import');
      return;
    }

    // Parse addresses - one per line or comma-separated
    const addresses = importText
      .split(/[\n,]+/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);

    if (addresses.length === 0) {
      alert('No valid addresses found');
      return;
    }

    if (addresses.length > 100) {
      const proceed = confirm(`${addresses.length} addresses imported. Continue?`);
      if (!proceed) return;
    }

    onAddressesImported(addresses);
    setImportText('');
  };

  const loadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  const addressCount = importText.split(/[\n,]+/).filter(a => a.trim()).length;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Import Address List
      </h2>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="address-import-text"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Paste Addresses
          </label>
          <textarea
            id="address-import-text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="One address per line or comma-separated:&#10;1909 W Martha Ln, Santa Ana, CA 92706&#10;1910 W Martha Ln, Santa Ana, CA 92706&#10;..."
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3V3.9a1 1 0 10-1.415 1.9a1 1 0 01-1.415 1.9V2.5a3 3 0 013-3H4a3 3 0 01-3 3v2.5a1 1 0 001.415 1.9" />
            </svg>
            Import from File
            <input
              id="address-import-file"
              type="file"
              accept=".txt,.csv"
              onChange={loadFromFile}
              className="hidden"
              aria-label="Import addresses from file"
            />
          </label>

          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              !importText.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Import ({addressCount} addresses)
          </button>
        </div>
      </div>
    </div>
  );
};
