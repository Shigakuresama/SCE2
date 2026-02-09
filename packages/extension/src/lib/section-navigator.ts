/**
 * Section Navigator
 * Handles navigation between form sections on the SCE website.
 *
 * Key fix: replaced :has-text() Playwright pseudo-selectors (which don't work
 * in browser document.querySelector) with text-content matching on
 * .sections-menu-item__title elements.
 *
 * Sections are read dynamically from the DOM — no hardcoded list.
 */

import { waitForReady, sleep } from './dom-utils.js';

// ==========================================
// SECTION NAME TYPE
// ==========================================

// Known section names (for type-safety when referencing specific sections).
// The orchestrator reads the actual list from the DOM at runtime.
export type SectionName = string;

// ==========================================
// DOM READING (dynamic, not hardcoded)
// ==========================================

/**
 * Read all currently visible section titles from the sidebar menu.
 * Returns them in display order.
 */
export function getAvailableSections(): string[] {
  const titles = Array.from(
    document.querySelectorAll('.sections-menu-item__title')
  );
  return titles
    .map(t => t.textContent?.trim() || '')
    .filter(Boolean);
}

/**
 * Get the currently active section name.
 * Looks for .sections-menu-item.active → .sections-menu-item__title
 */
export function getActiveSection(): string | null {
  const active = document.querySelector(
    '.sections-menu-item.active .sections-menu-item__title'
  );
  return active?.textContent?.trim() || null;
}

// ==========================================
// NAVIGATION (text-based, with verification)
// ==========================================

/**
 * Navigate to a section by clicking its sidebar menu item.
 * Uses text-content matching (NOT :has-text pseudo-selector).
 *
 * @returns true if navigation succeeded and the section became active.
 */
export async function navigateToSection(sectionName: string): Promise<boolean> {
  const titles = Array.from(
    document.querySelectorAll('.sections-menu-item__title')
  );

  for (const title of titles) {
    if (title.textContent?.trim() === sectionName) {
      const li = title.closest('.sections-menu-item') as HTMLElement;
      if (!li) continue;

      li.click();
      await waitForReady(3000);

      // Verify navigation succeeded
      const newActive = getActiveSection();
      if (newActive === sectionName) {
        return true;
      }

      // Retry click once — sometimes Angular needs a moment
      await sleep(300);
      li.click();
      await waitForReady(3000);
      return getActiveSection() === sectionName;
    }
  }

  console.warn(`[SectionNav] Menu item not found: "${sectionName}"`);
  return false;
}

/**
 * Check if a specific section is visible in the sidebar menu.
 */
export function isSectionAvailable(sectionName: string): boolean {
  return getAvailableSections().includes(sectionName);
}

/**
 * Wait for a section to appear in the sidebar menu.
 * Useful after completing a section that unlocks the next.
 */
export function waitForSection(
  sectionName: string,
  timeout = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isSectionAvailable(sectionName)) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (isSectionAvailable(sectionName)) {
        observer.disconnect();
        clearTimeout(timer);
        resolve();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Section "${sectionName}" did not appear within ${timeout}ms`));
    }, timeout);
  });
}

// ==========================================
// SECTION NAVIGATOR CLASS (stateful wrapper)
// ==========================================

export class SectionNavigator {
  private visitedSections: Set<string> = new Set();

  constructor() {
    const current = getActiveSection();
    if (current) this.visitedSections.add(current);
  }

  getCurrentSection(): string | null {
    return getActiveSection();
  }

  getVisitedSections(): string[] {
    return Array.from(this.visitedSections);
  }

  async goTo(sectionName: string): Promise<boolean> {
    const success = await navigateToSection(sectionName);
    if (success) {
      this.visitedSections.add(sectionName);
    }
    return success;
  }

  hasVisited(sectionName: string): boolean {
    return this.visitedSections.has(sectionName);
  }

  reset(): void {
    this.visitedSections.clear();
    const current = getActiveSection();
    if (current) this.visitedSections.add(current);
  }

  getProgress(): { visited: number; total: number; percentage: number } {
    const total = getAvailableSections().length;
    const visited = this.visitedSections.size;
    return {
      visited,
      total,
      percentage: total > 0 ? Math.round((visited / total) * 100) : 0,
    };
  }
}
