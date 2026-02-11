// ============= Configuration =============
// API and application configuration

const config = {
  // Base URL for API endpoints (relative to cloud server)
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',

  // Base URL for cloud server
  CLOUD_BASE_URL: import.meta.env.VITE_CLOUD_BASE_URL || 'http://localhost:3333',

  // Base URL for mobile web (for QR codes in PDFs)
  MOBILE_BASE_URL: import.meta.env.VITE_MOBILE_BASE_URL ||
    (import.meta.env.MODE === 'production' ? 'https://sce2-mobile.onrender.com' : 'http://localhost:5174'),

  // Polling interval for queue status (milliseconds)
  POLL_INTERVAL: 5000,

  // Default limit for paginated queries
  DEFAULT_LIMIT: 50,
} as const;

/**
 * Get the full cloud server URL
 * @param path - Optional path to append to base URL
 * @returns Full URL to cloud server
 */
function getCloudUrl(path?: string): string {
  const baseUrl = config.CLOUD_BASE_URL.replace(/\/$/, '');
  if (!path) return baseUrl;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Get the full mobile web URL (for QR codes)
 * @param path - Optional path to append to base URL
 * @returns Full URL to mobile web app
 */
function getMobileUrl(path?: string): string {
  const baseUrl = config.MOBILE_BASE_URL.replace(/\/$/, '');
  if (!path) return baseUrl;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export { config, getCloudUrl, getMobileUrl };
