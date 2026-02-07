import React, { useState } from 'react';
import { api } from '../lib/api';

interface AddressFormData {
  addressFull: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  city: string;
  state: string;
}

interface AddressInputProps {
  onSuccess: () => void;
}

export const AddressInput: React.FC<AddressInputProps> = ({ onSuccess }) => {
  const [addresses, setAddresses] = useState<AddressFormData[]>([
    {
      addressFull: '',
      streetNumber: '',
      streetName: '',
      zipCode: '',
      city: '',
      state: '',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddressChange = (
    index: number,
    field: keyof AddressFormData,
    value: string
  ) => {
    const updatedAddresses = [...addresses];
    updatedAddresses[index][field] = value;
    setAddresses(updatedAddresses);
    setError(null);
  };

  const handleAddAddress = () => {
    setAddresses([
      ...addresses,
      {
        addressFull: '',
        streetNumber: '',
        streetName: '',
        zipCode: '',
        city: '',
        state: '',
      },
    ]);
    setError(null);
  };

  const handleRemoveAddress = (index: number) => {
    if (addresses.length > 1) {
      const updatedAddresses = addresses.filter((_, i) => i !== index);
      setAddresses(updatedAddresses);
      setError(null);
    }
  };

  const validateForm = (): string | null => {
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];

      if (!address.addressFull.trim()) {
        return `Address ${i + 1}: Full Address is required`;
      }
      if (!address.streetNumber.trim()) {
        return `Address ${i + 1}: Street Number is required`;
      }
      if (!address.streetName.trim()) {
        return `Address ${i + 1}: Street Name is required`;
      }
      if (!address.zipCode.trim()) {
        return `Address ${i + 1}: Zip Code is required`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const addressesToQueue = addresses.map((addr) => ({
        ...addr,
        addressFull: addr.addressFull.trim(),
      }));
      await api.queueAddressesForScraping(addressesToQueue);
      onSuccess();

      // Reset form
      setAddresses([
        {
          addressFull: '',
          streetNumber: '',
          streetName: '',
          zipCode: '',
          city: '',
          state: '',
        },
      ]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to queue addresses';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Queue Addresses for Scraping
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
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
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {addresses.map((address, index) => (
          <div
            key={index}
            className="mb-6 p-4 border border-gray-200 rounded-md last:mb-0"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-700">
                Address {index + 1}
              </h3>
              {addresses.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveAddress(index)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={address.addressFull}
                  onChange={(e) =>
                    handleAddressChange(index, 'addressFull', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Main St, Los Angeles, CA 90001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={address.streetNumber}
                  onChange={(e) =>
                    handleAddressChange(index, 'streetNumber', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={address.streetName}
                  onChange={(e) =>
                    handleAddressChange(index, 'streetName', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Main St"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zip Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={address.zipCode}
                  onChange={(e) =>
                    handleAddressChange(index, 'zipCode', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="90001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) =>
                    handleAddressChange(index, 'city', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Los Angeles"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={address.state}
                  onChange={(e) =>
                    handleAddressChange(index, 'state', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="CA"
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-between items-center mt-6">
          <button
            type="button"
            onClick={handleAddAddress}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Add Another Address
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : `Queue ${addresses.length} Address(es)`}
          </button>
        </div>
      </form>
    </div>
  );
};
