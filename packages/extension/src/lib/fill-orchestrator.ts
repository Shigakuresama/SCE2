/**
 * Fill Orchestrator
 * Orchestrates multi-section form filling with navigation and progress tracking
 */

import { SectionNavigator, type SectionName } from './section-navigator.js';
import { SCEHelper } from './sce-helper.js';
import { Toast } from './toast.js';

/**
 * Global stop flag - set by user clicking stop button
 */
(window as any).sce2StopRequested = false;

/**
 * All sections in order
 */
const ALL_SECTIONS: SectionName[] = [
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
  'Status',
] as const;

/**
 * Banner interface for progress updates
 */
export interface BannerController {
  setFilling(section: string): void;
  setSuccess(message: string): void;
  setError(buttonId: string, message: string): void;
  setStopped(): void;
  updateProgress(current: number, total: number): void;
  isStopped(): boolean;
  resetStopState(): void;
}

/**
 * Property data interface
 */
export interface PropertyData {
  // Customer Information
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

  // Household Members
  householdSize?: string;
  incomeLevel?: string;

  // Enrollment Information
  enrollmentDate?: string;
  programSource?: string;

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
}

/**
 * Fill a single section with property data
 */
async function fillSection(
  sectionName: SectionName,
  propertyData: PropertyData
): Promise<void> {
  console.log(`[FillOrchestrator] Filling section: ${sectionName}`);

  // Check stop flag
  if ((window as any).sce2StopRequested) {
    throw new Error('Stopped by user');
  }

  const helper = new SCEHelper();

  switch (sectionName) {
    case 'Customer Information':
      if (propertyData.firstName && propertyData.lastName && propertyData.phone) {
        await helper.fillCustomerInfo({
          firstName: propertyData.firstName,
          lastName: propertyData.lastName,
          phone: propertyData.phone,
          email: propertyData.email,
        });
      }
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
      break;

    case 'Enrollment Information':
      await helper.fillEnrollmentInfo({
        enrollmentDate: propertyData.enrollmentDate,
        programSource: propertyData.programSource,
      });
      break;

    case 'Household Members':
      await helper.fillHouseholdInfo({
        householdSize: propertyData.householdSize,
        incomeLevel: propertyData.incomeLevel,
      });
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

    case 'Basic Enrollment':
      await helper.fillBasicEnrollmentInfo({
        utilityAccount: propertyData.utilityAccount,
        rateSchedule: propertyData.rateSchedule,
      });
      break;

    case 'Bonus Program':
      await helper.fillBonusInfo({
        bonusProgram: propertyData.bonusProgram,
        bonusAmount: propertyData.bonusAmount,
      });
      break;

    case 'Terms and Conditions':
      await helper.fillTermsInfo({
        termsAccepted: propertyData.termsAccepted,
        consentDate: propertyData.consentDate,
      });
      break;

    case 'Status':
      await helper.fillStatusInfo({
        applicationStatus: propertyData.applicationStatus,
        lastUpdated: propertyData.lastUpdated,
      });
      break;

    default:
      throw new Error(`Unsupported section: ${sectionName}`);
  }

  console.log(`[FillOrchestrator] Section filled: ${sectionName}`);
}

/**
 * Fill all sections sequentially with progress tracking
 */
export async function fillAllSections(
  propertyData: PropertyData,
  banner: BannerController
): Promise<void> {
  console.log('[FillOrchestrator] Starting fill all sections');

  // Reset stop flag
  (window as any).sce2StopRequested = false;
  banner.resetStopState();

  const navigator = new SectionNavigator();

  for (let i = 0; i < ALL_SECTIONS.length; i++) {
    const section = ALL_SECTIONS[i];

    // Check stop flag
    if ((window as any).sce2StopRequested || banner.isStopped()) {
      console.log('[FillOrchestrator] Stopped by user');
      banner.setStopped();
      throw new Error('Stopped by user');
    }

    // Update banner
    banner.setFilling(section);
    banner.updateProgress(i + 1, ALL_SECTIONS.length);

    try {
      // Navigate to section
      console.log(`[FillOrchestrator] Navigating to: ${section}`);
      const navigated = await navigator.goTo(section);

      if (!navigated) {
        console.warn(`[FillOrchestrator] Could not navigate to: ${section}`);
        Toast.warning(`Could not navigate to ${section}, skipping...`);
        continue;
      }

      // Wait a moment for section to fully load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fill the section
      await fillSection(section, propertyData);

      // Small delay between sections
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      if ((error as Error).message === 'Stopped by user') {
        throw error; // Re-throw to be caught by caller
      }

      // Log error but continue to next section
      console.error(`[FillOrchestrator] Failed to fill ${section}:`, error);
      Toast.error(`Failed to fill ${section}: ${(error as Error).message}`);
    }
  }

  console.log('[FillOrchestrator] All sections filled successfully');
}

/**
 * Fill current section only
 */
export async function fillCurrentSection(
  propertyData: PropertyData,
  banner: BannerController
): Promise<SectionName | null> {
  console.log('[FillOrchestrator] Starting fill current section');

  // Reset stop flag
  (window as any).sce2StopRequested = false;
  banner.resetStopState();

  // Get current section
  const navigator = new SectionNavigator();
  const currentSection = navigator.getCurrentSection();

  if (!currentSection) {
    throw new Error('No active section detected');
  }

  console.log(`[FillOrchestrator] Current section: ${currentSection}`);

  // Update banner
  banner.setFilling(currentSection);

  // Fill the section
  await fillSection(currentSection, propertyData);

  console.log('[FillOrchestrator] Current section filled successfully');
  return currentSection;
}

/**
 * Reset stop flag (called before starting new fill operation)
 */
export function resetStopFlag(): void {
  (window as any).sce2StopRequested = false;
}

/**
 * Check if stop was requested
 */
export function isStopRequested(): boolean {
  return (window as any).sce2StopRequested === true;
}

/**
 * Request stop (called by stop button)
 */
export function requestStop(): void {
  (window as any).sce2StopRequested = true;
  console.log('[FillOrchestrator] Stop requested');
}
