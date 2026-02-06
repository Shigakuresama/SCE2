// Type definitions for SCE2 Mobile Web

export interface MobilePropertyData {
  id: number;
  addressFull: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAge?: number;
  fieldNotes?: string;
  status: string;
  documents: Document[];
}

export interface Document {
  id: number;
  createdAt: string;
  propertyId: number;
  docType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export interface FieldDataSubmission {
  customerAge?: number;
  fieldNotes?: string;
}

export interface DocumentUpload {
  docType: string;
  fileName: string;
  base64Data: string;
  mimeType: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
