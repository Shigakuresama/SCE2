interface OptionsConfig {
  apiBaseUrl: string;
  pollInterval: number;
  timeout: number;
  maxConcurrent: number;
  autoStart: boolean;
  debugMode: boolean;
}

// Load configuration
async function loadConfig(): Promise<OptionsConfig> {
  const result = await chrome.storage.sync.get({
    apiBaseUrl: 'http://localhost:3333',
    pollInterval: 5000,
    timeout: 30000,
    maxConcurrent: 3,
    autoStart: false,
    debugMode: false,
  });

  return {
    apiBaseUrl: result.apiBaseUrl,
    pollInterval: result.pollInterval,
    timeout: result.timeout,
    maxConcurrent: result.maxConcurrent,
    autoStart: result.autoStart,
    debugMode: result.debugMode,
  };
}

// Save configuration
async function saveConfig(config: Partial<OptionsConfig>): Promise<void> {
  await chrome.storage.sync.set(config);
}

// Show status message
function showStatus(message: string, isError = false): void {
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  statusDiv.textContent = message;
  statusDiv.style.color = isError ? '#c62828' : '#2e7d32';

  setTimeout(() => {
    statusDiv.textContent = '';
  }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const config = await loadConfig();

  // Populate form
  (document.getElementById('api-url') as HTMLInputElement).value = config.apiBaseUrl;
  (document.getElementById('poll-interval') as HTMLInputElement).value = config.pollInterval.toString();
  (document.getElementById('timeout') as HTMLInputElement).value = config.timeout.toString();
  (document.getElementById('max-concurrent') as HTMLInputElement).value = config.maxConcurrent.toString();
  (document.getElementById('auto-start') as HTMLSelectElement).value = config.autoStart.toString();
  (document.getElementById('debug-mode') as HTMLInputElement).checked = config.debugMode;

  // Save button
  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const newConfig: Partial<OptionsConfig> = {
      apiBaseUrl: (document.getElementById('api-url') as HTMLInputElement).value,
      pollInterval: parseInt((document.getElementById('poll-interval') as HTMLInputElement).value),
      timeout: parseInt((document.getElementById('timeout') as HTMLInputElement).value),
      maxConcurrent: parseInt((document.getElementById('max-concurrent') as HTMLInputElement).value),
      autoStart: (document.getElementById('auto-start') as HTMLSelectElement).value === 'true',
      debugMode: (document.getElementById('debug-mode') as HTMLInputElement).checked,
    };

    // Validate
    if (!newConfig.apiBaseUrl) {
      showStatus('API Base URL is required', true);
      return;
    }

    if (newConfig.pollInterval < 1000 || newConfig.pollInterval > 60000) {
      showStatus('Poll interval must be between 1000 and 60000', true);
      return;
    }

    await saveConfig(newConfig);
    showStatus('Configuration saved successfully!');
  });
});
