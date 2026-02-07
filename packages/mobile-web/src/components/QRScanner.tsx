import React, { useState } from 'react';
import { ScanQRCode } from 'react-qr-barcode-scanner';

interface QRScannerProps {
  onScan: (propertyId: string) => void;
  onError?: (error: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const handleScan = (data: string) => {
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
  };

  const handleError = (error: any) => {
    console.warn('QR scan error:', error);
    // Non-fatal, just log it
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ScanQRCode
        onScan={handleScan}
        onError={handleError}
        style={{ width: '100%', height: '100%' }}
        videoConstraints={{
          facingMode: facingMode,
        }}
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
        }}
      >
        Flip Camera
      </button>
    </div>
  );
};
