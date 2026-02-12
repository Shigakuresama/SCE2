/**
 * Banner Controller
 * Manages the SCE2 extension banner for form automation
 */

import { getActiveSection } from './section-navigator.js';
import { Toast } from './toast.js';

/**
 * Banner Controller class
 * Creates and manages the banner DOM element
 */
export class BannerController {
  private banner: HTMLElement | null = null;
  private fillAllBtn: HTMLElement | null = null;
  private fillSectionBtn: HTMLElement | null = null;
  private stopBtn: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private progressFill: HTMLElement | null = null;
  private progressText: HTMLElement | null = null;
  private progressSection: HTMLElement | null = null;
  private isFilling: boolean = false;
  private shouldStop: boolean = false;

  /**
   * Show the banner
   * @param hasData - Whether queued data exists (affects title)
   */
  show(hasData: boolean = false): void {
    if (this.banner) {
      // Banner already exists, just update and show
      this.banner.style.display = 'block';
      this.resetState();
      return;
    }

    this.createBanner(hasData);
    this.injectStyles();
    this.attachEventListeners();
    this.updateSectionButton();

    // Watch for section changes
    this.observeSectionMenu();
  }

  /**
   * Remove the banner from DOM
   */
  remove(): void {
    if (this.banner) {
      this.banner.remove();
      this.banner = null;
      this.resetState();
    }
  }

  /**
   * Set banner to filling state
   * @param section - Current section being filled
   */
  setFilling(section: string): void {
    this.isFilling = true;
    this.shouldStop = false;

    if (!this.banner) return;

    this.banner.setAttribute('data-state', 'filling');

    // Update message
    const messageEl = this.banner.querySelector('.sce2-banner-message');
    if (messageEl) {
      messageEl.textContent = `Filling: ${section}`;
    }

    // Update progress section text
    if (this.progressSection) {
      this.progressSection.textContent = section;
    }

    // Update button mode
    const buttonsContainer = this.banner.querySelector('.sce2-banner-buttons');
    if (buttonsContainer) {
      buttonsContainer.setAttribute('data-mode', 'filling');
    }

    // Disable fill buttons
    if (this.fillAllBtn) this.fillAllBtn.setAttribute('disabled', 'true');
    if (this.fillSectionBtn) this.fillSectionBtn.setAttribute('disabled', 'true');

    // Show stop button
    if (this.stopBtn) this.stopBtn.style.display = 'inline-flex';
  }

  /**
   * Set banner to success state
   * @param message - Success message
   */
  setSuccess(message: string): void {
    this.isFilling = false;
    this.shouldStop = false;

    if (!this.banner) return;

    this.banner.setAttribute('data-state', 'success');

    // Update message
    const messageEl = this.banner.querySelector('.sce2-banner-message');
    if (messageEl) {
      messageEl.textContent = message;
    }

    // Update buttons container mode
    const buttonsContainer = this.banner.querySelector('.sce2-banner-buttons');
    if (buttonsContainer) {
      buttonsContainer.removeAttribute('data-mode');
    }

    // Enable fill buttons
    if (this.fillAllBtn) this.fillAllBtn.removeAttribute('disabled');
    if (this.fillSectionBtn) this.fillSectionBtn.removeAttribute('disabled');

    // Hide stop button
    if (this.stopBtn) this.stopBtn.style.display = 'none';

    // Reset progress bar
    if (this.progressBar) this.progressBar.style.display = 'none';

    // Hide progress
    if (this.progressBar) this.progressBar.style.display = 'none';

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      if (this.banner && this.banner.getAttribute('data-state') === 'success') {
        this.remove();
      }
    }, 3000);

    // Show success toast
    Toast.success(message);
  }

  /**
   * Set banner to error state
   * @param buttonId - ID of button that failed
   * @param message - Error message
   */
  setError(buttonId: string, message: string): void {
    this.isFilling = false;

    if (!this.banner) return;

    // Set error state on banner
    this.banner.setAttribute('data-state', 'error');

    // Set error state on specific button
    const button = buttonId === 'fill-all-btn' ? this.fillAllBtn : this.fillSectionBtn;
    if (button) {
      button.setAttribute('data-state', 'error');
      setTimeout(() => button.removeAttribute('data-state'), 3000);
    }

    // Show error toast
    Toast.error(message, { duration: 6000 });

    // Reset to idle after 3 seconds
    setTimeout(() => {
      this.resetState();
    }, 3000);
  }

  /**
   * Set banner to stopped state
   */
  setStopped(): void {
    this.isFilling = false;
    this.shouldStop = true;

    if (!this.banner) return;

    this.banner.setAttribute('data-state', 'stopped');

    // Update message
    const messageEl = this.banner.querySelector('.sce2-banner-message');
    if (messageEl) {
      messageEl.textContent = 'Filling stopped by user';
    }

    // Update buttons container mode
    const buttonsContainer = this.banner.querySelector('.sce2-banner-buttons');
    if (buttonsContainer) {
      buttonsContainer.removeAttribute('data-mode');
    }

    // Enable fill buttons
    if (this.fillAllBtn) this.fillAllBtn.removeAttribute('disabled');
    if (this.fillSectionBtn) this.fillSectionBtn.removeAttribute('disabled');

    // Hide stop button
    if (this.stopBtn) this.stopBtn.style.display = 'none';

    // Hide progress
    if (this.progressBar) this.progressBar.style.display = 'none';

    // Show stopped toast
    Toast.info('Filling stopped. Data filled so far has been preserved.');
  }

  /**
   * Update progress bar
   * @param current - Current section number (1-based)
   * @param total - Total number of sections
   */
  updateProgress(current: number, total: number): void {
    if (!this.banner) return;

    const percentage = Math.round((current / total) * 100);

    if (this.progressFill) {
      this.progressFill.style.width = `${percentage}%`;
    }

    if (this.progressText) {
      const countEl = this.progressText.querySelector('.sce2-banner-progress-count');
      if (countEl) {
        countEl.textContent = `${current} / ${total}`;
      }

      const percentEl = this.progressText.querySelector('.sce2-banner-progress-percent');
      if (percentEl) {
        percentEl.textContent = `${percentage}%`;
      }
    }
  }

  /**
   * Update section button text with current section name
   */
  updateSectionButton(): void {
    if (!this.banner) return;

    const section = getActiveSection();
    const buttonLabel = this.fillSectionBtn?.querySelector('.sce2-btn-label');

    if (buttonLabel) {
      if (section) {
        buttonLabel.textContent = `Fill: ${section}`;
      } else {
        buttonLabel.textContent = 'Fill: Current Section';
      }
    }
  }

  /**
   * Show success state on section button
   */
  showSectionSuccess(): void {
    if (!this.fillSectionBtn) return;

    this.fillSectionBtn.setAttribute('data-state', 'success');
    setTimeout(() => {
      this.fillSectionBtn?.removeAttribute('data-state');
    }, 2000);
  }

  /**
   * Check if stop was requested
   */
  isStopped(): boolean {
    return this.shouldStop;
  }

  /**
   * Reset stop state
   */
  resetStopState(): void {
    this.shouldStop = false;
  }

  /**
   * Reset banner to idle state
   */
  private resetState(): void {
    this.isFilling = false;
    this.shouldStop = false;

    if (!this.banner) return;

    this.banner.removeAttribute('data-state');

    // Reset message
    const messageEl = this.banner.querySelector('.sce2-banner-message');
    if (messageEl) {
      messageEl.textContent = 'SCE form detected. Choose an option below:';
    }

    // Reset buttons
    if (this.fillAllBtn) {
      this.fillAllBtn.removeAttribute('disabled');
      this.fillAllBtn.removeAttribute('data-state');
    }
    if (this.fillSectionBtn) {
      this.fillSectionBtn.removeAttribute('disabled');
      this.fillSectionBtn.removeAttribute('data-state');
    }

    // Reset buttons container mode
    const buttonsContainer = this.banner.querySelector('.sce2-banner-buttons');
    if (buttonsContainer) {
      buttonsContainer.removeAttribute('data-mode');
    }

    // Hide stop button
    if (this.stopBtn) this.stopBtn.style.display = 'none';

    // Hide progress
    if (this.progressBar) this.progressBar.style.display = 'none';
  }

  /**
   * Create banner DOM element
   */
  private createBanner(hasData: boolean): void {
    const banner = document.createElement('div');
    banner.className = 'sce2-banner';
    banner.id = 'sce2-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'sce2-banner-title');
    banner.setAttribute('data-state', 'idle');

    const titleIcon = hasData ? '✨' : '📋';
    const titleText = hasData ? 'Ready to fill form' : 'SCE Form Detected';

    banner.innerHTML = `
      <div class="sce2-banner-header">
        <h2 class="sce2-banner-title" id="sce2-banner-title">
          <span class="sce2-banner-title-icon">${titleIcon}</span>
          ${titleText}
        </h2>
        <button class="sce2-banner-close" aria-label="Close banner">×</button>
      </div>

      <div class="sce2-banner-content">
        <p class="sce2-banner-message">SCE form detected. Choose an option below:</p>
      </div>

      <div class="sce2-banner-progress" style="display: none;">
        <div class="sce2-banner-progress-bar">
          <div class="sce2-banner-progress-fill" style="width: 0%"></div>
        </div>
        <div class="sce2-banner-progress-text">
          <span class="sce2-banner-progress-section"></span>
          <span>
            <span class="sce2-banner-progress-count">0 / 0</span>
            <span class="sce2-banner-progress-percent">0%</span>
          </span>
        </div>
      </div>

      <div class="sce2-banner-buttons">
        <button id="fill-all-btn" class="sce2-btn sce2-btn-primary">
          <span>Fill All Sections</span>
        </button>
        <button id="fill-section-btn" class="sce2-btn sce2-btn-secondary">
          <span class="sce2-btn-label">Fill: Current Section</span>
        </button>
        <button id="stop-btn" class="sce2-btn sce2-btn-stop" style="display: none;">
          <span>Stop</span>
        </button>
      </div>
    `;

    document.body.appendChild(banner);
    this.banner = banner;

    // Cache element references
    this.fillAllBtn = banner.querySelector('#fill-all-btn');
    this.fillSectionBtn = banner.querySelector('#fill-section-btn');
    this.stopBtn = banner.querySelector('#stop-btn');
    this.progressBar = banner.querySelector('.sce2-banner-progress');
    this.progressFill = banner.querySelector('.sce2-banner-progress-fill');
    this.progressText = banner.querySelector('.sce2-banner-progress-text');
    this.progressSection = banner.querySelector('.sce2-banner-progress-section');

    // Cache close button
    const closeBtn = banner.querySelector('.sce2-banner-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.remove());
    }
  }

  /**
   * Attach event listeners to buttons
   */
  private attachEventListeners(): void {
    if (!this.banner) return;

    // Fill all sections button
    this.fillAllBtn?.addEventListener('click', () => {
      if (this.isFilling) return;
      this.dispatchFillAll();
    });

    // Fill current section button
    this.fillSectionBtn?.addEventListener('click', () => {
      if (this.isFilling) return;
      this.dispatchFillCurrent();
    });

    // Stop button
    this.stopBtn?.addEventListener('click', () => {
      this.shouldStop = true;
      this.dispatchStop();
    });
  }

  /**
   * Dispatch FILL_ALL_SECTIONS message to content script
   */
  private dispatchFillAll(): void {
    chrome.runtime.sendMessage({
      action: 'FILL_ALL_SECTIONS',
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send FILL_ALL_SECTIONS message:', chrome.runtime.lastError);
        Toast.error('Failed to start fill all sections');
      } else if (response?.error) {
        console.error('FILL_ALL_SECTIONS error:', response.error);
        this.setError('fill-all-btn', response.error);
      }
    });
  }

  /**
   * Dispatch FILL_CURRENT_SECTION message to content script
   */
  private dispatchFillCurrent(): void {
    chrome.runtime.sendMessage({
      action: 'FILL_CURRENT_SECTION',
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send FILL_CURRENT_SECTION message:', chrome.runtime.lastError);
        Toast.error('Failed to fill current section');
      } else if (response?.error) {
        console.error('FILL_CURRENT_SECTION error:', response.error);
        this.setError('fill-section-btn', response.error);
      }
    });
  }

  /**
   * Dispatch STOP_FILLING message to content script
   */
  private dispatchStop(): void {
    chrome.runtime.sendMessage({
      action: 'STOP_FILLING',
    }, (_response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send STOP_FILLING message:', chrome.runtime.lastError);
      }
    });
  }

  /**
   * Inject banner CSS
   */
  private injectStyles(): void {
    // CSS is injected via web_accessible_resources
    // Check if it's already loaded
    if (document.getElementById('sce2-banner-styles')) return;

    const link = document.createElement('link');
    link.id = 'sce2-banner-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('assets/banner.css');
    document.head.appendChild(link);
  }

  /**
   * Watch for section menu changes
   */
  private observeSectionMenu(): void {
    const menu = document.querySelector('.sections-menu, .section-nav');
    if (!menu) return;

    const observer = new MutationObserver(() => {
      this.updateSectionButton();
    });

    observer.observe(menu, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-selected'],
    });

    // Store observer for cleanup (optional)
    (this.banner as any)._sectionObserver = observer;
  }
}
