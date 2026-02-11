// API client for SCE2 Mobile Web
import type {
  MobilePropertyData,
  FieldDataSubmission,
  DocumentUpload,
} from '../types';
import { getCloudUrl } from './config';
import { createAPIClient, APIError } from '../../../webapp/src/lib/api-client';

class MobileAPI {
  private request: <T>(endpoint: string, options?: RequestInit) => Promise<T>;

  constructor() {
    const baseUrl = getCloudUrl('/api');
    const client = createAPIClient({
      baseURL: baseUrl,
      includeAuth: false, // No authorization needed for mobile
    });
    this.request = client.request;
  }

  // Fetch property data for mobile view
  async fetchPropertyData(propertyId: number): Promise<MobilePropertyData> {
    return this.request<MobilePropertyData>(
      `/properties/${propertyId}/mobile-data`
    );
  }

  // Submit field data (age, notes)
  async submitFieldData(
    propertyId: number,
    data: FieldDataSubmission
  ): Promise<MobilePropertyData> {
    return this.request<MobilePropertyData>(`/properties/${propertyId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Upload document (photo, signature)
  async uploadDocument(
    propertyId: number,
    upload: DocumentUpload
  ): Promise<{ id: number; url: string }> {
    return this.request<{ id: number; url: string }>(
      `/properties/${propertyId}/documents`,
      {
        method: 'POST',
        body: JSON.stringify(upload),
      }
    );
  }

  // Mark visit complete after required documents are uploaded
  async completeVisit(propertyId: number): Promise<MobilePropertyData> {
    return this.request<MobilePropertyData>(
      `/properties/${propertyId}/complete-visit`,
      {
        method: 'POST',
      }
    );
  }
}

// Singleton instance
export const mobileAPI = new MobileAPI();

// Re-export APIError for use in other modules
export { APIError };
