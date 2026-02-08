/**
 * Toast Notification System
 * Provides non-intrusive feedback messages for SCE2 extension
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  duration?: number;
  actionButton?: {
    text: string;
    onClick: () => void;
  };
}

/**
 * Toast notification class
 * Creates and manages toast notifications in a fixed container
 */
export class Toast {
  private static container: HTMLElement | null = null;
  private static toasts: Set<HTMLElement> = new Set();

  /**
   * Initialize toast container (called automatically)
   */
  private static ensureContainer(): void {
    if (this.container) return;

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'sce2-toast-container';
    this.container.className = 'sce2-toast-container';
    document.body.appendChild(this.container);

    // Inject styles if not already present
    this.injectStyles();
  }

  /**
   * Inject toast CSS styles
   */
  private static injectStyles(): void {
    if (document.getElementById('sce2-toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'sce2-toast-styles';
    style.textContent = this.getCSS();
    document.head.appendChild(style);
  }

  /**
   * Get toast CSS
   */
  private static getCSS(): string {
    return `
      .sce2-toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }

      .sce2-toast {
        pointer-events: auto;
        min-width: 300px;
        max-width: 500px;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        animation: sce2-toast-slide-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #1a1a1a;
      }

      .sce2-toast.removing {
        animation: sce2-toast-slide-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }

      .sce2-toast-success {
        background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        border-left: 4px solid #4caf50;
      }

      .sce2-toast-error {
        background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
        border-left: 4px solid #f44336;
      }

      .sce2-toast-info {
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        border-left: 4px solid #2196f3;
      }

      .sce2-toast-warning {
        background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
        border-left: 4px solid #ff9800;
      }

      .sce2-toast-icon {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        border-radius: 50%;
      }

      .sce2-toast-success .sce2-toast-icon {
        background: #4caf50;
        color: white;
      }

      .sce2-toast-error .sce2-toast-icon {
        background: #f44336;
        color: white;
      }

      .sce2-toast-info .sce2-toast-icon {
        background: #2196f3;
        color: white;
      }

      .sce2-toast-warning .sce2-toast-icon {
        background: #ff9800;
        color: white;
      }

      .sce2-toast-content {
        flex: 1;
        min-width: 0;
      }

      .sce2-toast-message {
        word-wrap: break-word;
      }

      .sce2-toast-close {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.2s;
        color: #666;
        font-size: 18px;
        line-height: 1;
      }

      .sce2-toast-close:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .sce2-toast-action {
        margin-top: 8px;
      }

      .sce2-toast-action-button {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.1);
        color: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }

      .sce2-toast-action-button:hover {
        background: rgba(0, 0, 0, 0.2);
      }

      @keyframes sce2-toast-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes sce2-toast-slide-out {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      @media (max-width: 600px) {
        .sce2-toast-container {
          top: 10px;
          right: 10px;
          left: 10px;
        }

        .sce2-toast {
          min-width: 0;
          max-width: none;
        }
      }
    `;
  }

  /**
   * Show a toast notification
   * @param message - Message to display
   * @param type - Toast type
   * @param options - Optional duration and action button
   */
  static show(message: string, type: ToastType, options?: ToastOptions): void {
    this.ensureContainer();

    const duration = options?.duration ?? this.getDefaultDuration(type);

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `sce2-toast sce2-toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    // Icon
    const icon = document.createElement('div');
    icon.className = 'sce2-toast-icon';
    icon.textContent = this.getIcon(type);
    icon.setAttribute('aria-hidden', 'true');

    // Content
    const content = document.createElement('div');
    content.className = 'sce2-toast-content';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'sce2-toast-message';
    messageDiv.textContent = message;
    content.appendChild(messageDiv);

    // Action button (optional)
    if (options?.actionButton) {
      const actionDiv = document.createElement('div');
      actionDiv.className = 'sce2-toast-action';

      const actionButton = document.createElement('button');
      actionButton.className = 'sce2-toast-action-button';
      actionButton.textContent = options.actionButton.text;
      actionButton.onclick = () => {
        options.actionButton!.onClick();
        this.removeToast(toast);
      };

      actionDiv.appendChild(actionButton);
      content.appendChild(actionDiv);
    }

    // Close button
    const closeButton = document.createElement('div');
    closeButton.className = 'sce2-toast-close';
    closeButton.textContent = '×';
    closeButton.setAttribute('role', 'button');
    closeButton.setAttribute('aria-label', 'Close notification');
    closeButton.onclick = () => this.removeToast(toast);

    // Assemble
    toast.appendChild(icon);
    toast.appendChild(content);
    toast.appendChild(closeButton);

    // Add to container
    this.container!.appendChild(toast);
    this.toasts.add(toast);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.removeToast(toast), duration);
    }

    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * Show success toast
   * @param message - Message to display
   * @param options - Optional duration and action button
   */
  static success(message: string, options?: ToastOptions): void {
    this.show(message, 'success', options);
  }

  /**
   * Show error toast
   * @param message - Message to display
   * @param options - Optional duration and action button
   */
  static error(message: string, options?: ToastOptions): void {
    this.show(message, 'error', options);
  }

  /**
   * Show info toast
   * @param message - Message to display
   * @param options - Optional duration and action button
   */
  static info(message: string, options?: ToastOptions): void {
    this.show(message, 'info', options);
  }

  /**
   * Show warning toast
   * @param message - Message to display
   * @param options - Optional duration and action button
   */
  static warning(message: string, options?: ToastOptions): void {
    this.show(message, 'warning', options);
  }

  /**
   * Remove a toast notification
   * @param toast - Toast element to remove
   */
  private static removeToast(toast: HTMLElement): void {
    if (!this.toasts.has(toast)) return;

    toast.classList.add('removing');

    setTimeout(() => {
      toast.remove();
      this.toasts.delete(toast);
    }, 300); // Match animation duration
  }

  /**
   * Clear all toasts
   */
  static clear(): void {
    const toasts = Array.from(this.toasts);
    toasts.forEach(toast => this.removeToast(toast));
  }

  /**
   * Get default duration for toast type
   * @param type - Toast type
   * @returns Duration in milliseconds
   */
  private static getDefaultDuration(type: ToastType): number {
    switch (type) {
      case 'success':
        return 4000;
      case 'error':
        return 6000; // Longer for errors
      case 'info':
        return 4000;
      case 'warning':
        return 4000;
      default:
        return 4000;
    }
  }

  /**
   * Get icon character for toast type
   * @param type - Toast type
   * @returns Icon character
   */
  private static getIcon(type: ToastType): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
        return 'ⓘ';
      case 'warning':
        return '⚠';
      default:
        return 'ⓘ';
    }
  }
}
