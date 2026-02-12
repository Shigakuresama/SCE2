import { loadConfig, saveConfig } from './lib/storage.js';

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

interface SessionReadiness {
  ready: boolean;
  currentUrl: string;
  reason?: string;
}

interface SessionCheckResponse {
  success: boolean;
  data?: SessionReadiness;
  error?: string;
}

const DEFAULT_POPUP_CONFIG: ExtensionConfig = {
  apiBaseUrl: 'http://localhost:3333',
  pollInterval: 5000,
  autoProcess: false,
};
const SCE_CUSTOMER_SEARCH_URL = 'https://sce.dsmcentral.com/onsite/customer-search';

// Load configuration
async function loadPopupConfig(): Promise<ExtensionConfig> {
  return loadConfig<ExtensionConfig>(DEFAULT_POPUP_CONFIG);
}

// Save configuration
async function savePopupConfig(config: ExtensionConfig): Promise<void> {
  await saveConfig(config);
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

function setSessionStatus(
  state: 'checking' | 'ready' | 'not-ready',
  title: string,
  detail: string
): void {
  const container = document.getElementById('session-status') as HTMLDivElement;
  const titleEl = document.getElementById('session-status-title') as HTMLDivElement;
  const detailEl = document.getElementById('session-status-detail') as HTMLDivElement;

  container.className = `session-status ${state}`;
  titleEl.textContent = title;
  detailEl.textContent = detail;
}

async function checkSessionReadiness(): Promise<SessionReadiness> {
  setSessionStatus(
    'checking',
    'Session: Checking...',
    'Verifying access to SCE customer-search.'
  );

  try {
    const response = (await chrome.runtime.sendMessage({
      action: 'CHECK_SCE_SESSION_READY',
    })) as SessionCheckResponse;

    if (!response?.success || !response.data) {
      const reason = response?.error || 'Session check failed.';
      setSessionStatus('not-ready', 'Session: Not Ready', reason);
      return {
        ready: false,
        currentUrl: '',
        reason,
      };
    }

    const data = response.data;

    if (data.ready) {
      setSessionStatus(
        'ready',
        'Session: Ready',
        'Customer-search is accessible in this browser session.'
      );
      return data;
    }

    setSessionStatus(
      'not-ready',
      'Session: Not Ready',
      data.reason || 'Login required or customer-search is unavailable.'
    );
    return data;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown session check error.';
    setSessionStatus('not-ready', 'Session: Not Ready', reason);
    return {
      ready: false,
      currentUrl: '',
      reason,
    };
  }
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
  await checkSessionReadiness();

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

    if (newAutoProcess) {
      const readiness = await checkSessionReadiness();
      if (!readiness.ready) {
        alert(
          `SCE session is not ready yet.\n\n${readiness.reason || 'Please log in to customer-search first.'}`
        );
        return;
      }
    }

    await savePopupConfig({ ...config, autoProcess: newAutoProcess });

    if (newAutoProcess) {
      chrome.runtime.sendMessage({ action: 'START_PROCESSING' });
    } else {
      chrome.runtime.sendMessage({ action: 'STOP_PROCESSING' });
    }

    await updateUI();
  });

  // Manual session check button
  document.getElementById('check-session-btn')!.addEventListener('click', async () => {
    await checkSessionReadiness();
  });

  // Open SCE customer-search in current browser profile/session.
  document.getElementById('open-customer-search-btn')!.addEventListener('click', async () => {
    await chrome.tabs.create({
      url: SCE_CUSTOMER_SEARCH_URL,
      active: true,
    });
    window.close();
  });

  // Show Form Assistant button
  document.getElementById('show-banner-btn')!.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (tab.url?.includes('sce.dsmcentral.com')) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'SHOW_BANNER'
        });
        window.close();
      }
    } else {
      alert('Please navigate to an SCE form page (sce.dsmcentral.com) first');
    }
  });

  // Refresh status every 2 seconds
  setInterval(updateUI, 2000);
});
