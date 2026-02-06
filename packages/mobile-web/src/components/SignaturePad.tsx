import React, { useRef, useEffect, useState } from 'react';
import { mobileAPI, APIError } from '../lib/api';

interface SignaturePadProps {
  propertyId: number;
  docType: string;
  label: string;
  onSuccess?: (documentId: number) => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  propertyId,
  docType,
  label,
  onSuccess,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Get canvas context
  const getCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return { canvas, ctx };
  };

  // Get position from event (touch or mouse)
  const getPosition = (
    e: React.TouchEvent | React.MouseEvent
  ): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const { ctx } = getCanvas() || {};
    if (!ctx) return;

    const pos = getPosition(e);
    lastPositionRef.current = pos;
    setIsDrawing(true);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const { ctx } = getCanvas() || {};
    if (!ctx || !lastPositionRef.current) return;

    const pos = getPosition(e);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPositionRef.current = pos;
    setHasSignature(true);
  };

  const stopDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const { ctx } = getCanvas() || {};
    if (!ctx) return;

    ctx.closePath();
    setIsDrawing(false);
    lastPositionRef.current = null;
  };

  const clearSignature = () => {
    const { canvas, ctx } = getCanvas() || {};
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setError(null);
  };

  const saveSignature = async () => {
    if (!hasSignature) {
      setError('Please provide a signature before saving');
      return;
    }

    const { canvas } = getCanvas() || {};
    if (!canvas) return;

    setUploading(true);
    setError(null);

    try {
      // Convert canvas to base64
      const base64Data = canvas.toDataURL('image/png');
      const base64Content = base64Data.split(',')[1];

      const result = await mobileAPI.uploadDocument(propertyId, {
        docType,
        fileName: `${docType}_${Date.now()}.png`,
        base64Data: base64Content,
        mimeType: 'image/png',
      });

      onSuccess?.(result.id);
      clearSignature();
    } catch (err) {
      if (err instanceof APIError) {
        setError(
          err.response?.message || err.message || 'Failed to upload signature'
        );
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setUploading(false);
    }
  };

  // Prevent scrolling when drawing on touch devices
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventScroll = (e: Event) => e.preventDefault();

    canvas.addEventListener('touchstart', preventScroll, { passive: false });
    canvas.addEventListener('touchmove', preventScroll, { passive: false });
    canvas.addEventListener('touchend', preventScroll, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', preventScroll);
      canvas.removeEventListener('touchmove', preventScroll);
      canvas.removeEventListener('touchend', preventScroll);
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
        {label}
      </h2>

      {/* Canvas */}
      <div className="mb-3">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full border-2 border-gray-300 rounded-lg bg-white touch-none"
          style={{ cursor: 'crosshair' }}
        />
        <p className="text-xs text-gray-500 mt-1">
          Sign above using your finger or mouse
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={clearSignature}
          disabled={uploading}
          className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-gray-700 active:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={saveSignature}
          disabled={uploading || !hasSignature}
          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center justify-center"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            'Save Signature'
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Info */}
      {!hasSignature && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mt-3">
          <p className="text-sm font-medium">Instructions:</p>
          <ul className="text-xs list-disc list-inside mt-1">
            <li>Use your finger or mouse to sign</li>
            <li>Sign clearly within the box</li>
            <li>Tap "Save Signature" when done</li>
          </ul>
        </div>
      )}
    </div>
  );
};
