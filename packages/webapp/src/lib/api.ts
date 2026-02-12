// ============= API Service Layer =============
// Client for cloud server communication

import { PropertyStatus } from '../types';
import type {
  Property,
  PropertyFilters,
  Route,
  QueueStatus,
  AddressInput,
  MobileRoutePlanRequest,
  MobileRoutePlanResponse,
  ExtractionSession,
  ExtractionRun,
  SessionValidationResult,
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
    if (typeof filters?.limit === 'number')
      params.append('limit', String(filters.limit));
    if (typeof filters?.offset === 'number')
      params.append('offset', String(filters.offset));

    const query = params.toString() ? `?${params}` : '';
    return this.request<Property[]>(`/properties${query}`);
  }

  /**
   * Get field-ops focused properties (VISITED, READY_FOR_SUBMISSION, COMPLETE)
   */
  async getFieldOpsProperties(): Promise<Property[]> {
    const statuses: PropertyStatus[] = [
      PropertyStatus.VISITED,
      PropertyStatus.READY_FOR_SUBMISSION,
      PropertyStatus.COMPLETE,
    ];

    const results = await Promise.all(
      statuses.map((status) => this.getProperties({ status, limit: 5000 }))
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

  /**
   * Create mobile route plan with persisted optimized order
   */
  async createMobileRoutePlan(
    payload: MobileRoutePlanRequest
  ): Promise<MobileRoutePlanResponse> {
    return this.request<MobileRoutePlanResponse>('/routes/mobile-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ============= Queue =============

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<QueueStatus> {
    return this.request<QueueStatus>('/queue/status');
  }

  // ============= Cloud Extraction =============

  async createExtractionSession(payload: {
    label: string;
    sessionStateJson: string;
    expiresAt: string;
  }): Promise<ExtractionSession> {
    return this.request<ExtractionSession>('/cloud-extraction/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createExtractionSessionFromLogin(payload: {
    label: string;
    username: string;
    password: string;
    expiresAt: string;
  }): Promise<ExtractionSession> {
    return this.request<ExtractionSession>('/cloud-extraction/sessions/login-bridge', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listExtractionSessions(): Promise<ExtractionSession[]> {
    return this.request<ExtractionSession[]>('/cloud-extraction/sessions');
  }

  async validateExtractionSession(sessionId: number): Promise<SessionValidationResult> {
    return this.request<SessionValidationResult>(
      `/cloud-extraction/sessions/${sessionId}/validate`,
      {
        method: 'POST',
      }
    );
  }

  async createCloudExtractionRun(payload: {
    propertyIds: number[];
    sessionId: number;
  }): Promise<ExtractionRun> {
    if (!Array.isArray(payload.propertyIds) || payload.propertyIds.length === 0) {
      throw new Error('propertyIds must be a non-empty array');
    }

    return this.request<ExtractionRun>('/cloud-extraction/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async startCloudExtractionRun(runId: number): Promise<{ id: number; status: string }> {
    return this.request<{ id: number; status: string }>(
      `/cloud-extraction/runs/${runId}/start`,
      {
        method: 'POST',
      }
    );
  }

  async getCloudExtractionRun(runId: number): Promise<ExtractionRun> {
    return this.request<ExtractionRun>(`/cloud-extraction/runs/${runId}`);
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
