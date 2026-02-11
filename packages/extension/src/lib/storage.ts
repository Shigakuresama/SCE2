// SCE2 Extension - Generic Storage Utilities
// Provides reusable functions for chrome.storage.sync operations

// ==========================================
// CONFIGURATION INTERFACE
// ==========================================

interface Config {
  apiBaseUrl: string;
  autoProcess: boolean;
  autoStart: boolean;
  pollInterval: number;
  timeout: number;
  maxConcurrent: number;
  debugMode: boolean;
  submitVisibleSectionOnly: boolean;
  enableDocumentUpload: boolean;
  enableFinalSubmit: boolean;
}

const DEFAULT_CONFIG: Config = {
  apiBaseUrl: 'http://localhost:3333',
  autoProcess: false,
  autoStart: false,
  pollInterval: 5000,
  timeout: 30000,
  maxConcurrent: 1,
  debugMode: false,
  submitVisibleSectionOnly: true,
  enableDocumentUpload: false,
  enableFinalSubmit: false,
};

/**
 * Generic function to load configuration from chrome.storage.sync
 * @param key - The storage key (or object with multiple keys and defaults)
 * @param defaults - Default values to use if storage is empty
 * @returns The configuration object with values from storage or defaults
 *
 * @example
 * interface Config {
 *   apiBaseUrl: string;
 *   pollInterval: number;
 *   autoProcess: boolean;
 * }
 *
 * const config = await loadConfig<Config>({
 *   apiBaseUrl: 'http://localhost:3333',
 *   pollInterval: 5000,
 *   autoProcess: false,
 * });
 */
export async function loadConfig<T extends Record<string, any>>(
  defaults: T
): Promise<T> {
  const result = await chrome.storage.sync.get(defaults);

  // Return result with proper type casting
  return result as T;
}

/**
 * Generic function to save configuration to chrome.storage.sync
 * Supports partial updates (merging with existing values)
 * @param config - Configuration object or partial configuration to save
 *
 * @example
 * // Save full config
 * await saveConfig({ apiBaseUrl: 'http://localhost:3333', pollInterval: 5000 });
 *
 * // Save partial config (merge with existing)
 * await saveConfig({ pollInterval: 10000 });
 */
export async function saveConfig<T extends Record<string, any>>(
  config: T | Partial<T>
): Promise<void> {
  await chrome.storage.sync.set(config);
}

/**
 * Remove specific keys from chrome.storage.sync
 * @param keys - Single key or array of keys to remove
 *
 * @example
 * await removeConfig('apiBaseUrl');
 * await removeConfig(['apiBaseUrl', 'pollInterval']);
 */
export async function removeConfig(keys: string | string[]): Promise<void> {
  await chrome.storage.sync.remove(keys);
}

/**
 * Clear all configuration from chrome.storage.sync
 * WARNING: This will delete all stored extension settings
 *
 * @example
 * await clearAllConfig();
 */
export async function clearAllConfig(): Promise<void> {
  await chrome.storage.sync.clear();
}

/**
 * Listen for configuration changes in chrome.storage.sync
 * @param callback - Function to call when storage changes
 * @returns Function to unsubscribe from changes
 *
 * @example
 * const unsubscribe = onConfigChanged((changes, areaName) => {
 *   if (areaName === 'sync' && changes.apiBaseUrl) {
 *     console.log('API URL changed:', changes.apiBaseUrl.newValue);
 *   }
 * });
 *
 * // Later: unsubscribe();
 */
export function onConfigChanged(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    callback(changes, areaName);
  };

  chrome.storage.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

// ==========================================
// CONFIGURATION MANAGER (for backward compatibility)
// ==========================================

/**
 * Get the current configuration with defaults applied
 * This is a convenience function that calls loadConfig with DEFAULT_CONFIG
 */
export async function getConfig(): Promise<Config> {
  return loadConfig<Config>(DEFAULT_CONFIG);
}

type ConfigChangeCallback = (config: Config) => void;

/**
 * Configuration manager object for advanced configuration handling
 */
export const configManager = {
  /**
   * Get the current configuration
   */
  get: getConfig,

  /**
   * Save configuration (partial or full)
   */
  set: async (config: Partial<Config>): Promise<void> => {
    await saveConfig(config);
  },

  /**
   * Reset configuration to defaults
   */
  reset: async (): Promise<void> => {
    await saveConfig(DEFAULT_CONFIG);
  },

  /**
   * Get default configuration values
   */
  defaults: DEFAULT_CONFIG,

  /**
   * Subscribe to configuration changes
   * @param callback - Function to call when configuration changes
   * @returns Unsubscribe function
   */
  subscribe(callback: ConfigChangeCallback): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'sync') {
        // Check if any config keys changed
        const configKeys = Object.keys(DEFAULT_CONFIG);
        const hasConfigChange = configKeys.some(key => changes[key]);

        if (hasConfigChange) {
          // Fetch and callback with updated config
          getConfig().then(callback);
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);

    // Return unsubscribe function
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  },
};

// Export types for use in other modules
export type { Config };
