/**
 * Configuration Management Utility
 *
 * Provides export, import, and reset functionality for extension configuration.
 * Useful for backup, sharing configs between devices, and troubleshooting.
 */

import { DEFAULT_CONFIG, type SCE2Config } from '../options.js';

/**
 * Exports all configuration from chrome.storage.sync as JSON string
 */
export async function exportConfig(): Promise<string> {
  const data = await chrome.storage.sync.get(null);
  return JSON.stringify(data, null, 2);
}

/**
 * Imports configuration from JSON string
 * Validates and merges with defaults to ensure all fields exist
 */
export async function importConfig(jsonString: string): Promise<SCE2Config> {
  try {
    const data = JSON.parse(jsonString);

    // Validate structure
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid config format: not an object');
    }

    // Merge with defaults to ensure all fields exist
    const merged = { ...DEFAULT_CONFIG, ...data } as SCE2Config;

    // Clear and set new config
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(merged);

    return merged;
  } catch (error) {
    throw new Error(`Failed to import config: ${(error as Error).message}`);
  }
}

/**
 * Resets all configuration to default values
 */
export async function resetToDefaults(): Promise<void> {
  await chrome.storage.sync.clear();
  await chrome.storage.sync.set(DEFAULT_CONFIG);
}

/**
 * Downloads configuration as JSON file
 * Creates a blob and triggers browser download
 */
export function downloadConfigFile(): void {
  exportConfig().then(json => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sce2-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

/**
 * Validates configuration object
 * Checks if it has required SCE2Config fields
 */
export function validateConfig(data: unknown): data is SCE2Config {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // Check for some key fields that should exist
  const obj = data as Record<string, unknown>;
  const requiredFields = ['apiBaseUrl', 'firstName', 'lastName', 'email', 'phone'];

  return requiredFields.every(field => field in obj);
}
