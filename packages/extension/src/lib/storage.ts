// SCE2 Extension - Generic Storage Utilities
// Provides reusable functions for chrome.storage.sync operations

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
