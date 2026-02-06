"use strict";
// Load configuration
async function loadConfig() {
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
async function saveConfig(config) {
    await chrome.storage.sync.set(config);
}
// Get queue status from background
async function getQueueStatus() {
    const response = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
    return response || {
        scrapeCount: 0,
        submitCount: 0,
        isProcessing: false,
    };
}
// Update UI
async function updateUI() {
    const config = await loadConfig();
    const status = await getQueueStatus();
    // Update config inputs
    document.getElementById('api-url').value = config.apiBaseUrl;
    document.getElementById('poll-interval').value = config.pollInterval.toString();
    // Update status
    const statusDiv = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const toggleBtn = document.getElementById('toggle-btn');
    if (status.isProcessing) {
        statusDiv.className = 'status active';
        statusText.textContent = 'Processing';
        toggleBtn.textContent = 'Stop Processing';
    }
    else {
        statusDiv.className = 'status inactive';
        statusText.textContent = 'Inactive';
        toggleBtn.textContent = 'Start Processing';
    }
    // Update queue counts
    document.getElementById('scrape-count').textContent = status.scrapeCount.toString();
    document.getElementById('submit-count').textContent = status.submitCount.toString();
}
// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await updateUI();
    // Save button
    document.getElementById('save-btn').addEventListener('click', async () => {
        const apiBaseUrl = document.getElementById('api-url').value;
        const pollInterval = parseInt(document.getElementById('poll-interval').value);
        await saveConfig({ apiBaseUrl, pollInterval, autoProcess: false });
        // Show saved confirmation
        const btn = document.getElementById('save-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Saved!';
        setTimeout(() => btn.textContent = originalText, 1000);
    });
    // Toggle button
    document.getElementById('toggle-btn').addEventListener('click', async () => {
        const config = await loadConfig();
        const newAutoProcess = !config.autoProcess;
        await saveConfig({ ...config, autoProcess: newAutoProcess });
        if (newAutoProcess) {
            chrome.runtime.sendMessage({ action: 'START_PROCESSING' });
        }
        else {
            chrome.runtime.sendMessage({ action: 'STOP_PROCESSING' });
        }
        await updateUI();
    });
    // Refresh status every 2 seconds
    setInterval(updateUI, 2000);
});
//# sourceMappingURL=popup.js.map