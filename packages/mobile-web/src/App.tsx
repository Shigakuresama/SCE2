import { useState, useEffect } from 'react';
import { PropertyLoader } from './components/PropertyLoader';
import { PropertyInfo } from './components/PropertyInfo';
import { FieldDataForm } from './components/FieldDataForm';
import { PhotoCapture } from './components/PhotoCapture';
import { SignaturePad } from './components/SignaturePad';
import { QRScanner } from './components/QRScanner';
import type { MobilePropertyData } from './types';
import './index.css';

function App() {
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentProperty, setCurrentProperty] =
    useState<MobilePropertyData | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    // Parse propertyId from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const id = params.get('propertyId');

    if (!id) {
      // No propertyId in URL, show scanner mode
      setShowScanner(true);
      return;
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      setError('Invalid propertyId. Please scan QR code from dashboard.');
      setShowScanner(true);
      return;
    }

    setPropertyId(parsedId);
    setShowScanner(false);
  }, []);

  const handleScan = (scannedId: string) => {
    const parsedId = parseInt(scannedId, 10);
    if (!isNaN(parsedId)) {
      setPropertyId(parsedId);
      setShowScanner(false);
      setError(null);
    } else {
      setError('Invalid propertyId in QR code');
    }
  };

  const handleScanError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleNewScan = () => {
    setPropertyId(null);
    setShowScanner(true);
    setError(null);
  };

  const handlePropertyUpdate = (updatedProperty: MobilePropertyData) => {
    setCurrentProperty(updatedProperty);
  };

  if (showScanner) {
    return (
      <div className="h-screen">
        <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white p-4 z-10">
          <h1 className="text-xl font-bold">Scan QR Code</h1>
          <p className="text-sm opacity-90">Point camera at property QR code</p>
        </div>
        <div className="h-full">
          <QRScanner onScan={handleScan} onError={handleScanError} />
          {error && (
            <div className="absolute bottom-20 left-4 right-4 bg-red-500 text-white p-4 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={handleNewScan}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Scan New QR Code
          </button>
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
        {(property) => {
          // Use updated property if available, otherwise use original
          const displayProperty = currentProperty || property;

          return (
            <>
              <div className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
                <div>
                  <h1 className="text-xl font-bold">SCE2 Mobile</h1>
                  <p className="text-blue-100 text-sm">
                    Property #{displayProperty.id} -{' '}
                    {displayProperty.status.replace(/_/g, ' ')}
                  </p>
                </div>
                <button
                  onClick={handleNewScan}
                  className="px-3 py-1 bg-blue-700 text-white text-sm rounded hover:bg-blue-800"
                >
                  Scan New
                </button>
              </div>

              <div className="p-4">
                <PropertyInfo property={displayProperty} />
                <FieldDataForm
                  property={displayProperty}
                  onSuccess={handlePropertyUpdate}
                />

                <PhotoCapture
                  propertyId={displayProperty.id}
                  docType="BILL"
                  label="Photo: Utility Bill"
                />

                <SignaturePad
                  propertyId={displayProperty.id}
                  docType="SIGNATURE"
                  label="Customer Signature"
                />
              </div>
            </>
          );
        }}
      </PropertyLoader>
    </div>
  );
}

export default App;
