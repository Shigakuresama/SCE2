"use strict";

// Tab switching functionality
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');

            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding content
            const targetContent = document.getElementById(targetTab);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Load configuration
async function loadConfig() {
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
async function saveConfig(config) {
    await chrome.storage.sync.set(config);
}
// Show status message
function showStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? '#c62828' : '#2e7d32';
    setTimeout(() => {
        statusDiv.textContent = '';
    }, 3000);
}
// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize tabs first
    initTabs();

    const config = await loadConfig();
    // Populate form
    document.getElementById('api-url').value = config.apiBaseUrl;
    document.getElementById('poll-interval').value = config.pollInterval.toString();
    document.getElementById('timeout').value = config.timeout.toString();
    document.getElementById('max-concurrent').value = config.maxConcurrent.toString();
    document.getElementById('auto-start').value = config.autoStart.toString();
    document.getElementById('debug-mode').checked = config.debugMode;
    // Save button
    document.getElementById('save-btn').addEventListener('click', async () => {
        const newConfig = {
            apiBaseUrl: document.getElementById('api-url').value,
            pollInterval: parseInt(document.getElementById('poll-interval').value),
            timeout: parseInt(document.getElementById('timeout').value),
            maxConcurrent: parseInt(document.getElementById('max-concurrent').value),
            autoStart: document.getElementById('auto-start').value === 'true',
            debugMode: document.getElementById('debug-mode').checked,
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
//# sourceMappingURL=options.js.map