/**
 * Section Navigator
 * Handles navigation between form sections on the SCE website
 */

// Section names matching the SCE website navigation
export const SECTION_NAMES = [
  'Customer Information',
  'Additional Customer Information',
  'Enrollment Information',
  'Household Members',
  'Project Information',
  'Trade Ally Information',
  'Assessment Questionnaire',
  'Equipment Information',
  'Basic Enrollment',
  'Bonus Program',
  'Terms and Conditions',
  'Upload Documents',
  'Comments',
  'Status',
] as const;

export type SectionName = typeof SECTION_NAMES[number];

/**
 * Get the currently active section from the UI
 */
export function getActiveSection(): SectionName | null {
  const activeElement = document.querySelector(
    '.sections-menu-item.active .sections-menu-item__title, ' +
    '.section-nav-item.active .section-nav-item__title, ' +
    'mat-tab-list .mat-tab-labels[aria-selected="true"]'
  );

  if (activeElement) {
    const title = activeElement.textContent?.trim();
    if (title && SECTION_NAMES.includes(title as SectionName)) {
      return title as SectionName;
    }
  }

  return null;
}

/**
 * Check if a specific section is visible/active
 */
export function isSectionVisible(sectionName: SectionName): boolean {
  // Check if section title is visible in the main content area
  const sectionHeaders = Array.from(
    document.querySelectorAll('h2, h3, .section-title, mat-panel-title')
  );

  return sectionHeaders.some(header =>
    header.textContent?.trim().includes(sectionName)
  );
}

/**
 * Click on a section menu item to navigate to that section
 */
export async function navigateToSection(sectionName: SectionName): Promise<boolean> {
  // Try multiple selector patterns for section menu items
  const selectors = [
    `.sections-menu-item:has-text("${sectionName}")`,
    `.section-nav-item:has-text("${sectionName}")`,
    `mat-tab-label:has-text("${sectionName}")`,
    `[data-section="${sectionName}"]`,
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.click();
      // Wait for navigation to complete
      await sleep(500);
      // Verify we're on the right section
      return isSectionVisible(sectionName);
    }
  }

  console.warn(`Section menu item not found: ${sectionName}`);
  return false;
}

/**
 * Navigate to the next section (click Next button)
 */
export async function goToNextSection(): Promise<boolean> {
  const selectors = [
    'button[type="submit"]',
    '.btn-next',
    'button:has-text("Next")',
    'button:has-text("Continue")',
    '[data-action="next"]',
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector) as HTMLButtonElement;
    if (button && !button.disabled) {
      button.click();
      await sleep(800);
      return true;
    }
  }

  return false;
}

/**
 * Navigate to the previous section (click Previous button)
 */
export async function goToPreviousSection(): Promise<boolean> {
  const selectors = [
    '.btn-prev',
    'button:has-text("Previous")',
    'button:has-text("Back")',
    '[data-action="prev"]',
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector) as HTMLButtonElement;
    if (button && !button.disabled) {
      button.click();
      await sleep(800);
      return true;
    }
  }

  return false;
}

/**
 * Wait for a section to become visible
 */
export function waitForSection(
  sectionName: SectionName,
  timeout = 10000
): Promise<SectionName> {
  return new Promise((resolve, reject) => {
    if (isSectionVisible(sectionName)) {
      resolve(sectionName);
      return;
    }

    const observer = new MutationObserver(() => {
      if (isSectionVisible(sectionName)) {
        observer.disconnect();
        resolve(sectionName);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Section ${sectionName} not visible within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Get all visible section names in order
 */
export function getVisibleSections(): SectionName[] {
  const sections: SectionName[] = [];

  for (const sectionName of SECTION_NAMES) {
    if (isSectionVisible(sectionName)) {
      sections.push(sectionName);
    }
  }

  return sections;
}

/**
 * Check if we're on the first section
 */
export function isFirstSection(): boolean {
  const activeSection = getActiveSection();
  return activeSection === SECTION_NAMES[0];
}

/**
 * Check if we're on the last section
 */
export function isLastSection(): boolean {
  const activeSection = getActiveSection();
  const visibleSections = getVisibleSections();
  return activeSection === visibleSections[visibleSections.length - 1];
}

/**
 * Get current section index
 */
export function getCurrentSectionIndex(): number {
  const activeSection = getActiveSection();
  if (!activeSection) return -1;

  const visibleSections = getVisibleSections();
  return visibleSections.indexOf(activeSection);
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Navigate through all sections sequentially
 */
export async function navigateThroughAllSections(): Promise<{
  visited: SectionName[];
  skipped: SectionName[];
  errors: string[];
}> {
  const result = {
    visited: [] as SectionName[],
    skipped: [] as SectionName[],
    errors: [] as string[],
  };

  const visibleSections = getVisibleSections();

  for (const section of visibleSections) {
    try {
      const success = await navigateToSection(section);
      if (success) {
        result.visited.push(section);
      } else {
        result.skipped.push(section);
      }
    } catch (error) {
      result.errors.push(
        `${section}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return result;
}

/**
 * Section Navigator Class
 * Provides stateful navigation through form sections
 */
export class SectionNavigator {
  private currentSection: SectionName | null = null;
  private visitedSections: Set<SectionName> = new Set();

  /**
   * Initialize navigator and detect current section
   */
  constructor() {
    this.currentSection = getActiveSection();
    if (this.currentSection) {
      this.visitedSections.add(this.currentSection);
    }
  }

  /**
   * Get current section
   */
  getCurrentSection(): SectionName | null {
    return this.currentSection;
  }

  /**
   * Get all visited sections
   */
  getVisitedSections(): SectionName[] {
    return Array.from(this.visitedSections);
  }

  /**
   * Navigate to a specific section
   */
  async goTo(sectionName: SectionName): Promise<boolean> {
    const success = await navigateToSection(sectionName);
    if (success) {
      this.currentSection = sectionName;
      this.visitedSections.add(sectionName);
    }
    return success;
  }

  /**
   * Move to next section
   */
  async next(): Promise<boolean> {
    if (isLastSection()) {
      return false;
    }
    const success = await goToNextSection();
    if (success) {
      const newSection = getActiveSection();
      if (newSection) {
        this.currentSection = newSection;
        this.visitedSections.add(newSection);
      }
    }
    return success;
  }

  /**
   * Move to previous section
   */
  async previous(): Promise<boolean> {
    if (isFirstSection()) {
      return false;
    }
    const success = await goToPreviousSection();
    if (success) {
      const newSection = getActiveSection();
      if (newSection) {
        this.currentSection = newSection;
      }
    }
    return success;
  }

  /**
   * Check if section has been visited
   */
  hasVisited(sectionName: SectionName): boolean {
    return this.visitedSections.has(sectionName);
  }

  /**
   * Reset visited sections tracking
   */
  reset(): void {
    this.visitedSections.clear();
    this.currentSection = getActiveSection();
    if (this.currentSection) {
      this.visitedSections.add(this.currentSection);
    }
  }

  /**
   * Get progress (visited / total visible)
   */
  getProgress(): { visited: number; total: number; percentage: number } {
    const totalVisible = getVisibleSections().length;
    const visitedCount = this.visitedSections.size;
    return {
      visited: visitedCount,
      total: totalVisible,
      percentage: Math.round((visitedCount / totalVisible) * 100),
    };
  }
}
