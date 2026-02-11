// ============= API Service Layer =============
// Client for cloud server communication

import type {
  Property,
  PropertyStatus,
  PropertyFilters,
  Route,
  QueueStatus,
  AddressInput,
} from '../types';
import { config, getCloudUrl } from './config';
import { createAPIClient, APIError } from './api-client';

/**
 * Re-export APIError for use in other modules
 */
export { APIError };

/**
 * SCE2 API Client
 * Singleton class for communicating with the cloud server
 */
class SCE2API {
  private request: <T>(endpoint: string, options?: RequestInit) => Promise<T>;

  constructor() {
    const baseUrl = getCloudUrl(config.API_BASE_URL);
    const client = createAPIClient({
      baseURL: baseUrl,
      includeAuth: true, // Enable authorization token support
    });
    this.request = client.request;
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
   * Get field-ops focused properties (VISITED, READY_FOR_SUBMISSION, COMPLETE)
   */
  async getFieldOpsProperties(): Promise<Property[]> {
    const statuses: PropertyStatus[] = [
      'VISITED' as PropertyStatus,
      'READY_FOR_SUBMISSION' as PropertyStatus,
      'COMPLETE' as PropertyStatus,
    ];

    const results = await Promise.all(
      statuses.map((status) => this.getProperties({ status }))
    );

    return results.flat();
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
   * Delete all properties (optional status filter)
   */
  async deleteAllProperties(status?: string): Promise<{ deletedCount: number }> {
    const query = status ? `?status=${status}` : '';
    return this.request<{ deletedCount: number }>(`/properties/all${query}`, {
      method: 'DELETE',
    });
  }

  /**
   * Queue multiple addresses for scraping
   */
  async queueAddressesForScraping(addresses: AddressInput[]): Promise<void> {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new Error('addresses must be a non-empty array');
    }
    if (addresses.length > 100) {
      throw new Error('Cannot queue more than 100 addresses at once');
    }
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
