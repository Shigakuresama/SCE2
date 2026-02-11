// ============= Configuration =============
// API and application configuration for mobile-web

const config = {
  // Base URL for cloud server
  CLOUD_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333',

  // Base URL for desktop webapp route-pack builder
  WEBAPP_BASE_URL: import.meta.env.VITE_WEBAPP_BASE_URL ||
    (import.meta.env.MODE === 'production'
      ? 'https://sce2-webap.onrender.com'
      : 'http://localhost:5173'),
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

export { config, getCloudUrl };
