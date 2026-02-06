import React, { useState, useRef } from 'react';
import { mobileAPI, APIError } from '../lib/api';

interface PhotoCaptureProps {
  propertyId: number;
  docType: string;
  label: string;
  onSuccess?: (documentId: number) => void;
}

interface CapturedPhoto {
  base64Data: string;
  preview: string;
  fileName: string;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  propertyId,
  docType,
  label,
  onSuccess,
}) => {
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file too large. Maximum size is 10MB.');
      return;
    }

    setError(null);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      const preview = URL.createObjectURL(file);

      setCapturedPhoto({
        base64Data,
        preview,
        fileName: `${docType}_${Date.now()}.jpg`,
      });
    };
    reader.onerror = () => {
      setError('Failed to process image');
    };
    reader.readAsDataURL(file);
  };

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!capturedPhoto) return;

    setUploading(true);
    setError(null);

    try {
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64Content = capturedPhoto.base64Data.split(',')[1];

      const result = await mobileAPI.uploadDocument(propertyId, {
        docType,
        fileName: capturedPhoto.fileName,
        base64Data: base64Content,
        mimeType: 'image/jpeg',
      });

      onSuccess?.(result.id);
      setCapturedPhoto(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      if (err instanceof APIError) {
        setError(
          err.response?.message || err.message || 'Failed to upload photo'
        );
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
        {label}
      </h2>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!capturedPhoto ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCapture}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center min-h-[44px]"
          >
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Take Photo
          </button>

          <p className="text-sm text-gray-500 text-center">
            Opens camera to capture photo
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Photo Preview */}
          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={capturedPhoto.preview}
              alt="Captured photo"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRetake}
              disabled={uploading}
              className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-gray-700 active:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px] flex items-center justify-center"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                'Upload Photo'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-gray-500 mt-3">
        Accepts: JPG, PNG (max 10MB)
      </p>
    </div>
  );
};
