// SCE2 Extension - Background Service Worker
// Manages scrape queue, polling, and extension state

const SCRAPE_QUEUE = {
  items: [],
  currentJob: null,
  isProcessing: false,
};

const SUBMIT_QUEUE = {
  items: [],
  currentJob: null,
  isProcessing: false,
};

// ==========================================
// CONFIGURATION
// ==========================================
async function getConfig() {
  const result = await chrome.storage.sync.get({
    apiBaseUrl: 'http://localhost:3333',
    autoProcess: true,
    pollInterval: 5000,
  });

  return {
    apiBaseUrl: result.apiBaseUrl,
    autoProcess: result.autoProcess,
    pollInterval: result.pollInterval,
  };
}

// ==========================================
// QUEUE MANAGEMENT
// ==========================================
async function fetchScrapeJob() {
  const config = await getConfig();

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/queue/scrape`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch scrape job:', error);
    return null;
  }
}

async function fetchSubmitJob() {
  const config = await getConfig();

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/queue/submit`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch submit job:', error);
    return null;
  }
}

// ==========================================
// SCRAPE WORKFLOW
// ==========================================
async function processScrapeJob(job) {
  console.log('Processing scrape job:', job);

  // Open SCE form in new tab
  const tab = await chrome.tabs.create({
    url: 'https://sce.dsmcentral.com/onsite',
  });

  // Wait for tab to load
  await new Promise((resolve) => {
    const listener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(undefined);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  // Send scrape command to content script
  chrome.tabs.sendMessage(
    tab.id,
    {
      action: 'SCRAPE_PROPERTY',
      data: {
        propertyId: job.id,
        streetNumber: job.streetNumber,
        streetName: job.streetName,
        zipCode: job.zipCode,
      },
    },
    async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Content script error:', chrome.runtime.lastError);
        await markJobFailed(job.id, 'SCRAPE');
        return;
      }

      if (response && response.success) {
        // Send scraped data to cloud
        await saveScrapedData(job.id, response.data);

        // Close tab
        await chrome.tabs.remove(tab.id);
      }
    }
  );
}

async function saveScrapedData(propertyId, data) {
  const config = await getConfig();

  try {
    const response = await fetch(
      `${config.apiBaseUrl}/api/queue/${propertyId}/scraped`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('Scraped data saved:', propertyId);
  } catch (error) {
    console.error('Failed to save scraped data:', error);
    await markJobFailed(propertyId, 'SCRAPE');
  }
}

// ==========================================
// SUBMIT WORKFLOW
// ==========================================
async function processSubmitJob(job) {
  console.log('Processing submit job:', job);

  // Open SCE form in new tab
  const tab = await chrome.tabs.create({
    url: 'https://sce.dsmcentral.com/onsite',
  });

  // Wait for tab to load
  await new Promise((resolve) => {
    const listener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(undefined);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  // Send submit command to content script
  chrome.tabs.sendMessage(
    tab.id,
    {
      action: 'SUBMIT_APPLICATION',
      data: job,
    },
    async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Content script error:', chrome.runtime.lastError);
        await markJobFailed(job.id, 'SUBMIT');
        return;
      }

      if (response && response.success) {
        // Mark as complete
        await markJobComplete(job.id, response.sceCaseId);

        // Close tab
        await chrome.tabs.remove(tab.id);
      }
    }
  );
}

async function markJobComplete(propertyId, sceCaseId) {
  const config = await getConfig();

  try {
    await fetch(`${config.apiBaseUrl}/api/queue/${propertyId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceCaseId }),
    });

    console.log('Job marked complete:', propertyId);
  } catch (error) {
    console.error('Failed to mark job complete:', error);
  }
}

async function markJobFailed(propertyId, type) {
  console.error(`Job failed: ${propertyId} (${type})`);
  // Could implement retry logic here
}

// ==========================================
// POLLING LOOP
// ==========================================
async function poll() {
  const config = await getConfig();

  if (!config.autoProcess) {
    return;
  }

  // Process scrape queue
  if (!SCRAPE_QUEUE.isProcessing) {
    const job = await fetchScrapeJob();

    if (job) {
      SCRAPE_QUEUE.isProcessing = true;
      await processScrapeJob(job);
      SCRAPE_QUEUE.isProcessing = false;
    }
  }

  // Process submit queue
  if (!SUBMIT_QUEUE.isProcessing) {
    const job = await fetchSubmitJob();

    if (job) {
      SUBMIT_QUEUE.isProcessing = true;
      await processSubmitJob(job);
      SUBMIT_QUEUE.isProcessing = false;
    }
  }
}

// Start polling
setInterval(poll, 5000);

// ==========================================
// MESSAGE HANDLING
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.action) {
    case 'GET_CONFIG':
      getConfig().then(sendResponse);
      return true;

    case 'START_SCRAPING':
      poll();
      sendResponse({ success: true });
      break;

    case 'START_SUBMITTING':
      poll();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Log installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('SCE2 Extension installed');
});
