import { useState, useEffect } from 'react';
import { PropertyLoader } from './components/PropertyLoader';
import { PropertyInfo } from './components/PropertyInfo';
import './index.css';

function App() {
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parse propertyId from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const id = params.get('propertyId');

    if (!id) {
      setError('Missing propertyId in URL. Please scan QR code from dashboard.');
      return;
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      setError('Invalid propertyId. Please scan QR code from dashboard.');
      return;
    }

    setPropertyId(parsedId);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!propertyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PropertyLoader propertyId={propertyId}>
        {(property) => (
          <>
            <div className="bg-blue-600 text-white p-4 shadow-md">
              <h1 className="text-xl font-bold">SCE2 Mobile</h1>
              <p className="text-blue-100 text-sm">
                Property #{property.id} - {property.status.replace(/_/g, ' ')}
              </p>
            </div>

            <div className="p-4">
              <PropertyInfo property={property} />

              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600">Field form coming soon...</p>
              </div>
            </div>
          </>
        )}
      </PropertyLoader>
    </div>
  );
}

export default App;
