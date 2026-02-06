interface ExtensionConfig {
  apiBaseUrl: string;
  pollInterval: number;
  autoProcess: boolean;
}

interface QueueStatus {
  scrapeCount: number;
  submitCount: number;
  isProcessing: boolean;
}

// Load configuration
async function loadPopupConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.sync.get({
    apiBaseUrl: 'http://localhost:3333',
    pollInterval: 5000,
    autoProcess: false,
  });

  return {
    apiBaseUrl: result.apiBaseUrl,
    pollInterval: result.pollInterval,
    autoProcess: result.autoProcess,
  };
}

// Save configuration
async function savePopupConfig(config: ExtensionConfig): Promise<void> {
  await chrome.storage.sync.set(config);
}

// Get queue status from background
async function getQueueStatus(): Promise<QueueStatus> {
  const response = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });

  return response || {
    scrapeCount: 0,
    submitCount: 0,
    isProcessing: false,
  };
}

// Update UI
async function updateUI(): Promise<void> {
  const config = await loadPopupConfig();
  const status = await getQueueStatus();

  // Update config inputs
  (document.getElementById('api-url') as HTMLInputElement).value = config.apiBaseUrl;
  (document.getElementById('poll-interval') as HTMLInputElement).value = config.pollInterval.toString();

  // Update status
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const statusText = document.getElementById('status-text') as HTMLSpanElement;
  const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement;

  if (status.isProcessing) {
    statusDiv.className = 'status active';
    statusText.textContent = 'Processing';
    toggleBtn.textContent = 'Stop Processing';
  } else {
    statusDiv.className = 'status inactive';
    statusText.textContent = 'Inactive';
    toggleBtn.textContent = 'Start Processing';
  }

  // Update queue counts
  document.getElementById('scrape-count')!.textContent = status.scrapeCount.toString();
  document.getElementById('submit-count')!.textContent = status.submitCount.toString();
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await updateUI();

  // Save button
  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const apiBaseUrl = (document.getElementById('api-url') as HTMLInputElement).value;
    const pollInterval = parseInt((document.getElementById('poll-interval') as HTMLInputElement).value);

    await savePopupConfig({ apiBaseUrl, pollInterval, autoProcess: false });

    // Show saved confirmation
    const btn = document.getElementById('save-btn') as HTMLButtonElement;
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    setTimeout(() => btn.textContent = originalText, 1000);
  });

  // Toggle button
  document.getElementById('toggle-btn')!.addEventListener('click', async () => {
    const config = await loadPopupConfig();
    const newAutoProcess = !config.autoProcess;

    await savePopupConfig({ ...config, autoProcess: newAutoProcess });

    if (newAutoProcess) {
      chrome.runtime.sendMessage({ action: 'START_PROCESSING' });
    } else {
      chrome.runtime.sendMessage({ action: 'STOP_PROCESSING' });
    }

    await updateUI();
  });

  // Refresh status every 2 seconds
  setInterval(updateUI, 2000);
});
