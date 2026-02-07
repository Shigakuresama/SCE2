import React, { useState } from 'react';
import BarcodeScanner from 'react-qr-barcode-scanner';
import type { Result } from '@zxing/library';

interface QRScannerProps {
  onScan: (propertyId: string) => void;
  onError?: (error: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const handleUpdate = (error: unknown, result?: Result) => {
    if (error) {
      console.warn('QR scan error:', error);
      return;
    }

    if (result) {
      const data = result.getText();
      try {
        const url = new URL(data);
        const propertyId = url.searchParams.get('propertyId');
        if (propertyId) {
          onScan(propertyId);
        } else {
          onError?.('No propertyId found in QR code');
        }
      } catch (e) {
        onError?.('Invalid QR code format');
      }
    }
  };

  const handleError = (error: string | DOMException) => {
    console.warn('QR camera error:', error);
    onError?.(String(error));
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <BarcodeScanner
        onUpdate={handleUpdate}
        onError={handleError}
        width="100%"
        height="100%"
        facingMode={facingMode}
      />
      <button
        onClick={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          background: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 10,
        }}
      >
        Flip Camera
      </button>
    </div>
  );
};
