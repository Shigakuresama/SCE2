// API client for SCE2 Mobile Web
import type {
  MobilePropertyData,
  FieldDataSubmission,
  DocumentUpload,
  ApiResponse,
} from '../types';

class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class MobileAPI {
  private baseURL: string;

  constructor() {
    // Use environment variable or default to localhost
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333';
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data: ApiResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        throw new APIError(
          data.message || data.error || 'Request failed',
          response.status,
          data
        );
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        error instanceof Error ? error.message : 'Network error'
      );
    }
  }

  // Fetch property data for mobile view
  async fetchPropertyData(propertyId: number): Promise<MobilePropertyData> {
    return this.request<MobilePropertyData>(
      `/api/properties/${propertyId}/mobile-data`
    );
  }

  // Submit field data (age, notes)
  async submitFieldData(
    propertyId: number,
    data: FieldDataSubmission
  ): Promise<MobilePropertyData> {
    return this.request<MobilePropertyData>(`/api/properties/${propertyId}`, {
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
      `/api/properties/${propertyId}/documents`,
      {
        method: 'POST',
        body: JSON.stringify(upload),
      }
    );
  }
}

// Singleton instance
export const mobileAPI = new MobileAPI();
export { APIError };
