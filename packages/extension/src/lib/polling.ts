// SCE2 Extension - Polling Manager
// Manages polling lifecycle with proper cleanup and config responsiveness

export type PollCallback = () => void | Promise<void>;

/**
 * PollingManager handles timer-based polling with proper lifecycle management.
 * - Stops old timer before starting new one
 * - Respects config changes
 * - Cleans up on destroy
 */
export class PollingManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentInterval: number = 0;
  private pollCallback: PollCallback;
  private isRunning: boolean = false;

  constructor(pollCallback: PollCallback) {
    this.pollCallback = pollCallback;
  }

  /**
   * Start polling with specified interval.
   * Stops any existing timer before starting new one.
   */
  start(interval: number): void {
    this.stop(); // Clear existing timer first

    this.currentInterval = interval;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      try {
        await this.pollCallback();
      } catch (error) {
        console.error('[PollingManager] Poll callback error:', error);
      }
    }, interval);

    console.log(`[PollingManager] Started with ${interval}ms interval`);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.isRunning = false;
      console.log('[PollingManager] Stopped');
    }
  }

  /**
   * Update polling interval if it changed.
   * Restarts timer if interval is different.
   */
  updateInterval(newInterval: number): void {
    if (!this.isRunning) {
      return; // Not running, don't start
    }

    if (newInterval !== this.currentInterval) {
      console.log(`[PollingManager] Interval changed: ${this.currentInterval}ms -> ${newInterval}ms`);
      this.start(newInterval);
    }
  }

  /**
   * Check if polling is currently active.
   */
  active(): boolean {
    return this.isRunning;
  }

  /**
   * Cleanup: stop timer and release references.
   */
  destroy(): void {
    this.stop();
    this.pollCallback = () => {};
    console.log('[PollingManager] Destroyed');
  }
}
