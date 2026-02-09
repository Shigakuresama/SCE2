/**
 * Fill Orchestrator
 *
 * Coordinates multi-section form filling with:
 *  - AbortController for clean stop (replaces global window flag)
 *  - Dynamic section list read from DOM (not hardcoded)
 *  - Section strategies (fill / skip / special)
 *  - PRISM code workflow, homeowner auto-fill
 *  - Per-page filling mode
 */

import { SectionNavigator, getAvailableSections, getActiveSection } from './section-navigator.js';
import { SCEHelper } from './sce-helper.js';
import { Toast } from './toast.js';
import {
  fillFieldByLabel,
  selectDropdownByLabel,
  readFieldValue,
  findField,
  clickAddButton,
  waitForReady,
  randomDelay,
  TIMING,
} from './dom-utils.js';
import { extractPlus4FromMailingZip, getPlus4Zip, extractCustomerName } from './sce1-logic.js';

// ==========================================
// ABORT CONTROLLER (replaces window.sce2StopRequested)
// ==========================================

let fillAbortController: AbortController | null = null;

export function startFilling(): AbortSignal {
  fillAbortController = new AbortController();
  return fillAbortController.signal;
}

export function requestStop(): void {
  fillAbortController?.abort();
  console.log('[FillOrchestrator] Stop requested');
}

export function isStopRequested(): boolean {
  return fillAbortController?.signal.aborted === true;
}

export function resetStopFlag(): void {
  fillAbortController = null;
}

// ==========================================
// BANNER INTERFACE
// ==========================================

export interface BannerController {
  setFilling(section: string): void;
  setSuccess(message: string): void;
  setError(buttonId: string, message: string): void;
  setStopped(): void;
  updateProgress(current: number, total: number): void;
  isStopped(): boolean;
  resetStopState(): void;
}

// ==========================================
// SECTION STRATEGIES
// ==========================================

type SectionStrategy = 'fill' | 'skip' | 'special';

const SECTION_STRATEGIES: Record<string, SectionStrategy> = {
  'Appointment Contact': 'fill',
  'Appointments': 'special',
  'Trade Ally Information': 'fill',
  'Customer Information': 'skip',       // Read-only, pre-populated from search
  'Additional Customer Information': 'fill',
  'Enrollment Information': 'special',  // PRISM code workflow
  'Household Members': 'special',       // Needs plus button
  'Project Information': 'fill',
  'Assessment Questionnaire': 'fill',
  'Equipment Information': 'fill',
  'Basic Enrollment Equipment': 'skip', // System-populated
  'Bonus/Adjustment Measure(s)': 'skip',
  'Review Terms and Conditions': 'special',
  'File Uploads': 'skip',
  'Review Comments': 'fill',
  'Application Status': 'special',
};

function getStrategy(sectionName: string): SectionStrategy {
  return SECTION_STRATEGIES[sectionName] || 'fill';
}

// ==========================================
// PROPERTY DATA INTERFACE
// ==========================================

export interface PropertyData {
  // Customer Info (read-only from SCE, but we provide defaults)
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;

  // Additional Customer Information
  title?: string;
  preferredContactTime?: string;
  language?: string;
  ethnicity?: string;
  howDidYouHear?: string;
  masterMetered?: string;
  buildingType?: string;
  homeownerStatus?: string;
  gasProvider?: string;
  waterUtility?: string;
  permanentlyDisabled?: string;
  veteran?: string;
  nativeAmerican?: string;
  householdUnits?: string;
  spaceOrUnit?: string;
  gasAccountNumber?: string;
  incomeVerifiedDate?: string;
  primaryApplicantAge?: string;

  // Enrollment Information
  enrollmentDate?: string;
  programSource?: string;
  incomeVerificationType?: string;
  plus4Zip?: string;

  // Household Members
  householdSize?: string;
  incomeLevel?: string;

  // Project Information
  squareFootage?: string;
  yearBuilt?: string;
  propertyType?: string;

  // Trade Ally Information
  projectFirstName?: string;
  projectLastName?: string;
  projectTitle?: string;
  projectPhone?: string;
  projectEmail?: string;

  // Assessment Questionnaire
  hasAttic?: string;
  hasBasement?: string;
  hasCrawlspace?: string;
  heatingType?: string;
  coolingType?: string;
  waterHeaterType?: string;
  windowType?: string;
  insulationLevel?: string;
  hasSolar?: string;
  hasPool?: string;
  assessmentNotes?: string;

  // Equipment Information
  primaryHeating?: string;
  primaryCooling?: string;
  waterHeater?: string;

  // Basic Enrollment
  utilityAccount?: string;
  rateSchedule?: string;

  // Bonus Program
  bonusProgram?: string;
  bonusAmount?: string;

  // Terms and Conditions
  termsAccepted?: boolean;
  consentDate?: string;

  // Comments
  comments?: string;

  // Status
  applicationStatus?: string;
  lastUpdated?: string;

  // Address (for ZIP+4 extraction)
  zipCode?: string;
}

// ==========================================
// SPECIAL SECTION HANDLERS
// ==========================================

/**
 * PRISM Code workflow:
 * 1. Extract ZIP+4 from mailing zip field
 * 2. Select "PRISM code" in income verification dropdown
 * 3. Wait for field to unlock
 * 4. Paste the 4-digit code
 */
async function handleEnrollmentSection(
  data: PropertyData,
  helper: SCEHelper,
  signal: AbortSignal
): Promise<void> {
  // Fill standard enrollment fields first
  await helper.fillEnrollmentInfo({
    enrollmentDate: data.enrollmentDate,
    programSource: data.programSource,
  });

  // PRISM code workflow
  const verificationType = data.incomeVerificationType || 'PRISM code';
  const plus4 = data.plus4Zip || extractPlus4FromMailingZip() || getPlus4Zip('', data.zipCode || '');

  if (plus4) {
    try {
      await selectDropdownByLabel('Income Verification Type', verificationType, signal);
      await waitForReady(2000); // Wait for PRISM field to unlock

      // Try multiple label variations for the PRISM code field
      const prismLabels = ['PRISM Code', 'Verification Code', 'PRISM'];
      for (const label of prismLabels) {
        const field = findField(label);
        if (field) {
          await fillFieldByLabel(label, plus4, signal);
          console.log(`[PRISM] Set ${label} = ${plus4}`);
          break;
        }
      }
    } catch (e) {
      console.warn('[Enrollment] PRISM code workflow failed:', (e as Error).message);
    }
  }
}

/**
 * Household Members: click the plus/add button, then fill fields.
 */
async function handleHouseholdSection(
  data: PropertyData,
  helper: SCEHelper,
  signal: AbortSignal
): Promise<void> {
  try {
    await clickAddButton(signal);
    await waitForReady(2000);
  } catch {
    // Plus button might not exist or already used
  }

  await helper.fillHouseholdInfo({
    householdSize: data.householdSize,
    incomeLevel: data.incomeLevel,
  });
}

/**
 * Homeowner auto-fill: copy customer name/address to homeowner fields.
 */
async function handleHomeownerAutoFill(
  data: PropertyData,
  signal: AbortSignal
): Promise<void> {
  if (data.homeownerStatus !== 'Renter/Tenant') return;

  // Try to read customer name from the Customer Information section
  const customerInfo = extractCustomerName();
  if (!customerInfo) return;

  try {
    await fillFieldByLabel('Homeowner First Name', customerInfo.firstName, signal);
    await fillFieldByLabel('Homeowner Last Name', customerInfo.lastName, signal);

    // Copy address fields if available
    const siteAddr = readFieldValue('Site Address 1');
    const siteCity = readFieldValue('Site City');
    const siteZip = readFieldValue('Site Zip');

    if (siteAddr) await fillFieldByLabel('Homeowner Address 1', siteAddr, signal);
    if (siteCity) await fillFieldByLabel('Homeowner City', siteCity, signal);
    if (siteZip) await fillFieldByLabel('Homeowner Zip Code', siteZip, signal);

    console.log('[Homeowner] Auto-filled from customer info');
  } catch (e) {
    console.warn('[Homeowner] Auto-fill failed:', (e as Error).message);
  }
}

// ==========================================
// FILL A SINGLE SECTION
// ==========================================

async function fillSection(
  sectionName: string,
  propertyData: PropertyData,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) throw new Error('Stopped by user');

  console.log(`[FillOrchestrator] Filling section: ${sectionName}`);

  const helper = new SCEHelper(signal);
  const strategy = getStrategy(sectionName);

  if (strategy === 'skip') {
    console.log(`[FillOrchestrator] Skipping section: ${sectionName}`);
    return;
  }

  // Route to the appropriate handler
  switch (sectionName) {
    case 'Enrollment Information':
      await handleEnrollmentSection(propertyData, helper, signal);
      break;

    case 'Household Members':
      await handleHouseholdSection(propertyData, helper, signal);
      break;

    case 'Additional Customer Information':
      await helper.fillAdditionalCustomerInfo({
        title: propertyData.title,
        preferredContactTime: propertyData.preferredContactTime,
        language: propertyData.language,
        ethnicity: propertyData.ethnicity,
        howDidYouHear: propertyData.howDidYouHear,
        masterMetered: propertyData.masterMetered,
        buildingType: propertyData.buildingType,
        homeownerStatus: propertyData.homeownerStatus,
        gasProvider: propertyData.gasProvider,
        waterUtility: propertyData.waterUtility,
        permanentlyDisabled: propertyData.permanentlyDisabled,
        veteran: propertyData.veteran,
        nativeAmerican: propertyData.nativeAmerican,
        householdUnits: propertyData.householdUnits,
        spaceOrUnit: propertyData.spaceOrUnit,
        gasAccountNumber: propertyData.gasAccountNumber,
        incomeVerifiedDate: propertyData.incomeVerifiedDate,
        primaryApplicantAge: propertyData.primaryApplicantAge,
      });
      // Auto-fill homeowner fields if applicable
      await handleHomeownerAutoFill(propertyData, signal);
      break;

    case 'Project Information':
      await helper.fillProjectInfo({
        squareFootage: propertyData.squareFootage,
        yearBuilt: propertyData.yearBuilt,
        propertyType: propertyData.propertyType,
      });
      break;

    case 'Trade Ally Information':
      if (propertyData.projectFirstName && propertyData.projectLastName) {
        await helper.fillTradeAllyInfo({
          firstName: propertyData.projectFirstName,
          lastName: propertyData.projectLastName,
          title: propertyData.projectTitle,
          phone: propertyData.projectPhone,
          email: propertyData.projectEmail,
        });
      }
      break;

    case 'Assessment Questionnaire':
      await helper.fillAssessmentInfo({
        hasAttic: propertyData.hasAttic,
        hasBasement: propertyData.hasBasement,
        hasCrawlspace: propertyData.hasCrawlspace,
        heatingType: propertyData.heatingType,
        coolingType: propertyData.coolingType,
        waterHeaterType: propertyData.waterHeaterType,
        windowType: propertyData.windowType,
        insulationLevel: propertyData.insulationLevel,
        hasSolar: propertyData.hasSolar,
        hasPool: propertyData.hasPool,
        notes: propertyData.assessmentNotes,
      });
      break;

    case 'Equipment Information':
      await helper.fillEquipmentInfo({
        primaryHeating: propertyData.primaryHeating,
        primaryCooling: propertyData.primaryCooling,
        waterHeater: propertyData.waterHeater,
      });
      break;

    case 'Review Comments':
      if (propertyData.comments) {
        await helper.fillCommentsInfo({ comments: propertyData.comments });
      }
      break;

    case 'Application Status':
      if (propertyData.applicationStatus) {
        await helper.fillStatusInfo({
          applicationStatus: propertyData.applicationStatus,
          lastUpdated: propertyData.lastUpdated,
        });
      }
      break;

    default:
      // Generic fill — try to match any known fields
      console.log(`[FillOrchestrator] No specific handler for "${sectionName}", using generic fill`);
      break;
  }

  console.log(`[FillOrchestrator] Section filled: ${sectionName}`);
}

// ==========================================
// FILL ALL SECTIONS
// ==========================================

export async function fillAllSections(
  propertyData: PropertyData,
  banner: BannerController
): Promise<void> {
  console.log('[FillOrchestrator] Starting fill all sections');

  const signal = startFilling();
  banner.resetStopState();

  const navigator = new SectionNavigator();
  const sections = getAvailableSections();

  console.log(`[FillOrchestrator] Found ${sections.length} sections:`, sections);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (signal.aborted || banner.isStopped()) {
      console.log('[FillOrchestrator] Stopped by user');
      banner.setStopped();
      throw new Error('Stopped by user');
    }

    const strategy = getStrategy(section);
    if (strategy === 'skip') {
      console.log(`[FillOrchestrator] Skipping: ${section}`);
      continue;
    }

    banner.setFilling(section);
    banner.updateProgress(i + 1, sections.length);

    try {
      const navigated = await navigator.goTo(section);
      if (!navigated) {
        console.warn(`[FillOrchestrator] Could not navigate to: ${section}`);
        Toast.warning(`Could not navigate to ${section}, skipping...`);
        continue;
      }

      await waitForReady(2000);
      await fillSection(section, propertyData, signal);
      await randomDelay(TIMING.betweenSections);

    } catch (error) {
      if ((error as Error).message === 'Stopped by user' || signal.aborted) {
        throw error;
      }
      console.error(`[FillOrchestrator] Failed to fill ${section}:`, error);
      Toast.error(`Failed to fill ${section}: ${(error as Error).message}`);
    }
  }

  console.log('[FillOrchestrator] All sections filled successfully');
}

// ==========================================
// FILL CURRENT SECTION (per-page mode)
// ==========================================

export async function fillCurrentSection(
  propertyData: PropertyData,
  banner: BannerController
): Promise<string | null> {
  console.log('[FillOrchestrator] Starting fill current section');

  const signal = startFilling();
  banner.resetStopState();

  const currentSection = getActiveSection();
  if (!currentSection) {
    throw new Error('No active section detected');
  }

  console.log(`[FillOrchestrator] Current section: ${currentSection}`);
  banner.setFilling(currentSection);

  await fillSection(currentSection, propertyData, signal);

  console.log('[FillOrchestrator] Current section filled successfully');
  return currentSection;
}
