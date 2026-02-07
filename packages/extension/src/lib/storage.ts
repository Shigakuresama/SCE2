// SCE2 Extension - Storage Management
// Provides reactive config management with proper cleanup

interface Config {
  apiBaseUrl: string;
  autoProcess: boolean;
  autoStart: boolean;
  pollInterval: number;
  timeout: number;
  maxConcurrent: number;
  debugMode: boolean;
}

const DEFAULT_CONFIG: Config = {
  apiBaseUrl: 'http://localhost:3333',
  autoProcess: false,
  autoStart: false,
  pollInterval: 5000,
  timeout: 30000,
  maxConcurrent: 3,
  debugMode: false,
};

type ConfigListener = (config: Config) => void;

/**
 * ConfigManager provides reactive configuration management.
 * Listeners are notified when configuration changes.
 */
class ConfigManager {
  private config: Config | null = null;
  private listeners: ConfigListener[] = [];
  private initPromise: Promise<Config> | null = null;
  private storageListener: ((changes: { [key: string]: chrome.storage.StorageChange }) => void) | null = null;

  /**
   * Load configuration from chrome.storage.sync
   * Caches the result for subsequent calls.
   */
  async load(): Promise<Config> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          apiBaseUrl: DEFAULT_CONFIG.apiBaseUrl,
          autoProcess: DEFAULT_CONFIG.autoProcess,
          autoStart: DEFAULT_CONFIG.autoStart,
          pollInterval: DEFAULT_CONFIG.pollInterval,
          timeout: DEFAULT_CONFIG.timeout,
          maxConcurrent: DEFAULT_CONFIG.maxConcurrent,
          debugMode: DEFAULT_CONFIG.debugMode,
        },
        (result) => {
          this.config = {
            apiBaseUrl: result.apiBaseUrl as string,
            autoProcess: result.autoProcess as boolean,
            autoStart: result.autoStart as boolean,
            pollInterval: result.pollInterval as number,
            timeout: result.timeout as number,
            maxConcurrent: result.maxConcurrent as number,
            debugMode: result.debugMode as boolean,
          };
          resolve(this.config);
        }
      );
    });

    // Set up storage listener after first load
    if (!this.storageListener) {
      this.storageListener = (changes) => {
        if (changes.sceConfig || changes.apiBaseUrl || changes.pollInterval || changes.autoProcess) {
          this.invalidateCache();
          this.load().then((newConfig) => {
            this.notifyListeners(newConfig);
          });
        }
      };
      chrome.storage.onChanged.addListener(this.storageListener);
    }

    return this.initPromise;
  }

  /**
   * Get current config without waiting for async.
   * Throws if config hasn't been loaded yet.
   */
  get(): Config {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Update configuration and persist to storage.
   */
  async update(updates: Partial<Config>): Promise<void> {
    return new Promise((resolve) => {
      const merged = { ...this.get(), ...updates };
      chrome.storage.sync.set(merged, () => {
        this.config = merged;
        this.notifyListeners(merged);
        resolve();
      });
    });
  }

  /**
   * Subscribe to configuration changes.
   * Returns unsubscribe function.
   */
  subscribe(callback: ConfigListener): () => void {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Invalidate cached config (force reload on next access).
   */
  private invalidateCache(): void {
    this.config = null;
    this.initPromise = null;
  }

  /**
   * Notify all listeners of config change.
   */
  private notifyListeners(config: Config): void {
    this.listeners.forEach((cb) => {
      try {
        cb(config);
      } catch (error) {
        console.error('[ConfigManager] Listener error:', error);
      }
    });
  }

  /**
   * Cleanup: remove storage listener.
   */
  destroy(): void {
    if (this.storageListener) {
      chrome.storage.onChanged.removeListener(this.storageListener);
      this.storageListener = null;
    }
    this.listeners = [];
  }
}

// Singleton instance
export const configManager = new ConfigManager();

// Convenience function for backward compatibility
export async function getConfig(): Promise<Config> {
  return configManager.load();
}
