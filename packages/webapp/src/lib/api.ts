// ============= API Service Layer =============
// Client for cloud server communication

import type {
  Property,
  PropertyFilters,
  Route,
  QueueStatus,
  ApiResponse,
} from '../types';
import { config, getCloudUrl } from './config';

/**
 * Custom error class for API-related errors
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: ApiResponse<unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * SCE2 API Client
 * Singleton class for communicating with the cloud server
 */
class SCE2API {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getCloudUrl(config.API_BASE_URL);
  }

  /**
   * Core request method - wraps fetch with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem('token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data: ApiResponse<T> = await response.json();

      if (!response.ok) {
        throw new APIError(
          data.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          data
        );
      }

      if (!data.success) {
        throw new APIError(data.error || 'Request failed');
      }

      return data.data;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  // ============= Properties =============

  /**
   * Get properties with optional filters
   */
  async getProperties(filters?: PropertyFilters): Promise<Property[]> {
    const params = new URLSearchParams();

    if (filters?.status) params.append('status', filters.status);
    if (filters?.city) params.append('city', filters.city);
    if (filters?.state) params.append('state', filters.state);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.hasRoute !== undefined)
      params.append('hasRoute', String(filters.hasRoute));

    const query = params.toString() ? `?${params}` : '';
    return this.request<Property[]>(`/properties${query}`);
  }

  /**
   * Get a single property by ID
   */
  async getProperty(id: number): Promise<Property> {
    return this.request<Property>(`/properties/${id}`);
  }

  /**
   * Create a new property
   */
  async createProperty(
    data: Partial<Property>
  ): Promise<Property> {
    return this.request<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing property
   */
  async updateProperty(
    id: number,
    data: Partial<Property>
  ): Promise<Property> {
    return this.request<Property>(`/properties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a property
   */
  async deleteProperty(id: number): Promise<void> {
    return this.request<void>(`/properties/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Queue multiple addresses for scraping
   */
  async queueAddressesForScraping(addresses: string[]): Promise<void> {
    return this.request<void>('/queue/addresses', {
      method: 'POST',
      body: JSON.stringify({ addresses }),
    });
  }

  // ============= Routes =============

  /**
   * Get all routes
   */
  async getRoutes(): Promise<Route[]> {
    return this.request<Route[]>('/routes');
  }

  /**
   * Get a single route by ID
   */
  async getRoute(id: number): Promise<Route> {
    return this.request<Route>(`/routes/${id}`);
  }

  /**
   * Create a new route
   */
  async createRoute(
    name: string,
    description?: string
  ): Promise<Route> {
    return this.request<Route>('/routes', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  // ============= Queue =============

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<QueueStatus> {
    return this.request<QueueStatus>('/queue/status');
  }

  // ============= Health =============

  /**
   * Check cloud server health
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

// Export singleton instance
export const api = new SCE2API();
