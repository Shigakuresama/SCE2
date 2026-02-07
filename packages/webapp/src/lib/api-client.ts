// ============= Shared API Client =============
// Core request method used by both webapp and mobile-web

import type { ApiResponse } from '../types';

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
 * Configuration for API client
 */
export interface APIClientConfig {
  baseURL: string;
  includeAuth?: boolean; // Whether to include authorization token from localStorage
}

/**
 * Creates a core API client with shared request logic
 * Used by both webapp (with auth) and mobile-web (without auth)
 */
export function createAPIClient(config: APIClientConfig) {
  const { baseURL, includeAuth = false } = config;

  /**
   * Core request method - wraps fetch with error handling
   * Supports optional authorization token for webapp
   */
  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add authorization token if enabled (for webapp)
    if (includeAuth) {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data: ApiResponse<T> = await response.json();

      // Check HTTP status
      if (!response.ok) {
        // Extract error message from object or string
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : (typeof data.error === 'object' && data.error && 'message' in data.error)
            ? (data.error as { message: string }).message
            : `HTTP ${response.status}: ${response.statusText}`;
        throw new APIError(errorMessage, response.status, data);
      }

      // Check API success flag
      if (!data.success) {
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : (typeof data.error === 'object' && data.error && 'message' in data.error)
            ? (data.error as { message: string }).message
            : 'Request failed';
        throw new APIError(errorMessage, undefined, data);
      }

      return data.data;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  return { request };
}
