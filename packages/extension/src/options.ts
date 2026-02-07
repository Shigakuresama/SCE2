import { loadConfig, saveConfig } from './lib/storage.js';

interface SCE2Config {
  // API Settings
  apiBaseUrl: string;
  pollInterval: number;
  timeout: number;
  maxConcurrent: number;
  autoStart: boolean;
  debugMode: boolean;

  // Customer Search
  address: string;
  zipCode: string;

  // Customer Information
  firstName: string;
  lastName: string;
  phone: string;
  email: string;

  // Additional Customer Information
  preferredContactTime: string;
  language: string;
  householdUnits: string;
  spaceOrUnit: string;
  howDidYouHear: string;
  buildingType: string;
  masterMetered: string;
  homeownerStatus: string;
  gasProvider: string;
  gasAccountNumber: string;
  waterUtility: string;
  incomeVerifiedDate: string;
  primaryApplicantAge: string;
  ethnicity: string;
  permanentlyDisabled: string;
  veteran: string;
  nativeAmerican: string;

  // Enrollment Information
  incomeVerificationType: string;
  plus4Zip: string;

  // Household Members
  householdMembersCount: string;
  relationToApplicant: string;

  // Project Information
  zillowSqFt: string;
  zillowYearBuilt: string;
  projectSpaceOrUnit: string;

  // Trade Ally Information
  projectFirstName: string;
  projectLastName: string;
  projectTitle: string;
  projectPhone: string;
  projectEmail: string;

  // Appointment Contact
  attempt1Date: string;
  attempt1Time: string;
  attempt2Date: string;
  attempt2Time: string;

  // Appointments
  contractorName: string;
  appointmentDate: string;
  appointmentStatus: string;
  appointmentType: string;
  appointmentStartTime: string;
  appointmentEndTime: string;

  // Assessment Questionnaire
  hvacSystemType: string;
  hasRoomAC: string;
  hasEvapCooler: string;
  refrigeratorCount: string;
  fridge1Year: string;
  hasFreezer: string;
  waterHeaterFuel: string;
  waterHeaterSize: string;
  hasDishwasher: string;
  hasClothesWasher: string;
  hasClothesDryer: string;
  clothesDryerType: string;

  // Equipment Information
  equipmentToInstall: string;
  equipmentBrand: string;
  equipmentModel: string;

  // Basic Enrollment Equipment
  measureType: string;
  equipmentQuantity: string;

  // Bonus/Adjustment
  bonusMeasureType: string;
  adjustmentNotes: string;

  // Terms
  electronicAcceptance: string;
  priorIncentive: string;

  // File Uploads
  autoUploadDocs: string;

  // Comments
  reviewComment: string;

  // Status
  autoAcceptLead: string;
  finalStatus: string;

  // Behavior
  autoFillPrompt: boolean;
  customFieldMap: string;
}

const DEFAULT_CONFIG: SCE2Config = {
  // API Settings
  apiBaseUrl: 'http://localhost:3333',
  pollInterval: 5000,
  timeout: 30000,
  maxConcurrent: 3,
  autoStart: false,
  debugMode: false,

  // Customer Search
  address: '22216 Seine',
  zipCode: '90716',

  // Customer Information
  firstName: 'Sergio',
  lastName: 'Correa',
  phone: '7143912727',
  email: 'scm.energysavings@gmail.com',

  // Additional Customer Information
  preferredContactTime: '1:00PM - 3:30PM',
  language: 'English',
  householdUnits: '1',
  spaceOrUnit: '1',
  howDidYouHear: 'Contractor Outreach',
  buildingType: 'Residential',
  masterMetered: 'Yes',
  homeownerStatus: 'Renter/Tenant',
  gasProvider: 'SoCalGas',
  gasAccountNumber: '1',
  waterUtility: 'N/A',
  incomeVerifiedDate: '01/31/2026',
  primaryApplicantAge: '44',
  ethnicity: 'Hispanic/Latino',
  permanentlyDisabled: 'No',
  veteran: 'No',
  nativeAmerican: 'No',

  // Enrollment Information
  incomeVerificationType: 'PRISM code',
  plus4Zip: '',

  // Household Members
  householdMembersCount: '1',
  relationToApplicant: 'Applicant',

  // Project Information
  zillowSqFt: '',
  zillowYearBuilt: '',
  projectSpaceOrUnit: '1',

  // Trade Ally Information
  projectFirstName: 'Sergio',
  projectLastName: 'Correa',
  projectTitle: 'Outreach',
  projectPhone: '7143912727',
  projectEmail: '',

  // Appointment Contact
  attempt1Date: '01/30/2026',
  attempt1Time: '2:00PM',
  attempt2Date: '01/31/2026',
  attempt2Time: '3:00PM',

  // Appointments
  contractorName: 'Sergio Correa',
  appointmentDate: '01/30/2026',
  appointmentStatus: 'Scheduled',
  appointmentType: 'On-Site Appointment',
  appointmentStartTime: '2:00PM',
  appointmentEndTime: '',

  // Assessment Questionnaire
  hvacSystemType: 'Natural Gas',
  hasRoomAC: 'Yes - Room AC',
  hasEvapCooler: 'No',
  refrigeratorCount: '1',
  fridge1Year: '',
  hasFreezer: 'No',
  waterHeaterFuel: 'Natural Gas',
  waterHeaterSize: '40 Gal',
  hasDishwasher: 'No',
  hasClothesWasher: 'No',
  hasClothesDryer: 'Electric',
  clothesDryerType: 'Electric',

  // Equipment Information
  equipmentToInstall: 'None',
  equipmentBrand: '',
  equipmentModel: '',

  // Basic Enrollment Equipment
  measureType: 'Basic',
  equipmentQuantity: '1',

  // Bonus/Adjustment
  bonusMeasureType: 'None',
  adjustmentNotes: '',

  // Terms
  electronicAcceptance: 'I Agree',
  priorIncentive: 'No',

  // File Uploads
  autoUploadDocs: 'false',

  // Comments
  reviewComment: '',

  // Status
  autoAcceptLead: 'true',
  finalStatus: 'Accepted',

  // Behavior
  autoFillPrompt: false,
  customFieldMap: '',
};

// Helper to safely get input value
function getInputValue(id: string): string {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  return element?.value ?? '';
}

// Helper to safely set input value
function setInputValue(id: string, value: string): void {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (element) {
    if (element.type === 'checkbox') {
      (element as HTMLInputElement).checked = value === 'true';
    } else {
      element.value = value;
    }
  }
}

// Helper to safely get checkbox value
function getCheckboxValue(id: string): boolean {
  const element = document.getElementById(id) as HTMLInputElement | null;
  return element?.checked ?? false;
}

// Show status message
function showStatus(message: string, isError = false): void {
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  statusDiv.textContent = message;
  statusDiv.className = isError ? 'error' : 'success';

  setTimeout(() => {
    statusDiv.className = '';
    statusDiv.textContent = '';
  }, 3000);
}

// Map of config keys to element IDs
const CONFIG_TO_ID_MAP: Record<keyof SCE2Config, string> = {
  apiBaseUrl: 'api-url',
  pollInterval: 'poll-interval',
  timeout: 'timeout',
  maxConcurrent: 'max-concurrent',
  autoStart: 'auto-start',
  debugMode: 'debug-mode',

  address: 'address',
  zipCode: 'zipCode',

  firstName: 'firstName',
  lastName: 'lastName',
  phone: 'phone',
  email: 'email',

  preferredContactTime: 'preferredContactTime',
  language: 'language',
  householdUnits: 'householdUnits',
  spaceOrUnit: 'spaceOrUnit',
  howDidYouHear: 'howDidYouHear',
  buildingType: 'buildingType',
  masterMetered: 'masterMetered',
  homeownerStatus: 'homeownerStatus',
  gasProvider: 'gasProvider',
  gasAccountNumber: 'gasAccountNumber',
  waterUtility: 'waterUtility',
  incomeVerifiedDate: 'incomeVerifiedDate',
  primaryApplicantAge: 'primaryApplicantAge',
  ethnicity: 'ethnicity',
  permanentlyDisabled: 'permanentlyDisabled',
  veteran: 'veteran',
  nativeAmerican: 'nativeAmerican',

  incomeVerificationType: 'incomeVerificationType',
  plus4Zip: 'plus4Zip',

  householdMembersCount: 'householdMembersCount',
  relationToApplicant: 'relationToApplicant',

  zillowSqFt: 'zillowSqFt',
  zillowYearBuilt: 'zillowYearBuilt',
  projectSpaceOrUnit: 'projectSpaceOrUnit',

  projectFirstName: 'projectFirstName',
  projectLastName: 'projectLastName',
  projectTitle: 'projectTitle',
  projectPhone: 'projectPhone',
  projectEmail: 'projectEmail',

  attempt1Date: 'attempt1Date',
  attempt1Time: 'attempt1Time',
  attempt2Date: 'attempt2Date',
  attempt2Time: 'attempt2Time',

  contractorName: 'contractorName',
  appointmentDate: 'appointmentDate',
  appointmentStatus: 'appointmentStatus',
  appointmentType: 'appointmentType',
  appointmentStartTime: 'appointmentStartTime',
  appointmentEndTime: 'appointmentEndTime',

  hvacSystemType: 'hvacSystemType',
  hasRoomAC: 'hasRoomAC',
  hasEvapCooler: 'hasEvapCooler',
  refrigeratorCount: 'refrigeratorCount',
  fridge1Year: 'fridge1Year',
  hasFreezer: 'hasFreezer',
  waterHeaterFuel: 'waterHeaterFuel',
  waterHeaterSize: 'waterHeaterSize',
  hasDishwasher: 'hasDishwasher',
  hasClothesWasher: 'hasClothesWasher',
  hasClothesDryer: 'hasClothesDryer',
  clothesDryerType: 'clothesDryerType',

  equipmentToInstall: 'equipmentToInstall',
  equipmentBrand: 'equipmentBrand',
  equipmentModel: 'equipmentModel',

  measureType: 'measureType',
  equipmentQuantity: 'equipmentQuantity',

  bonusMeasureType: 'bonusMeasureType',
  adjustmentNotes: 'adjustmentNotes',

  electronicAcceptance: 'electronicAcceptance',
  priorIncentive: 'priorIncentive',

  autoUploadDocs: 'autoUploadDocs',

  reviewComment: 'reviewComment',

  autoAcceptLead: 'autoAcceptLead',
  finalStatus: 'finalStatus',

  autoFillPrompt: 'autoFillPrompt',
  customFieldMap: 'customFieldMap',
};

// Load configuration from storage and populate form
async function loadConfigFromStorage(): Promise<void> {
  try {
    const stored = await loadConfig<Partial<SCE2Config>>(DEFAULT_CONFIG);
    const config = { ...DEFAULT_CONFIG, ...stored };

    // Populate all form fields
    for (const [key, id] of Object.entries(CONFIG_TO_ID_MAP)) {
      const value = config[key as keyof SCE2Config];
      if (typeof value === 'boolean') {
        const element = document.getElementById(id) as HTMLInputElement | null;
        if (element) {
          element.checked = value;
        }
      } else {
        setInputValue(id, String(value));
      }
    }

    console.log('[Options] Configuration loaded successfully');
  } catch (error) {
    console.error('[Options] Failed to load configuration:', error);
    showStatus('Failed to load configuration', true);
  }
}

// Save configuration from form to storage
async function saveConfigToStorage(): Promise<void> {
  try {
    const config: Partial<SCE2Config> = {};

    // Collect all form field values
    for (const [key, id] of Object.entries(CONFIG_TO_ID_MAP)) {
      if (key === 'autoStart') {
        config.autoStart = getInputValue(id) === 'true';
      } else if (key === 'debugMode') {
        config.debugMode = getCheckboxValue(id);
      } else if (key === 'autoFillPrompt') {
        config.autoFillPrompt = getCheckboxValue(id);
      } else {
        (config as any)[key] = getInputValue(id);
      }
    }

    await saveConfig(config);
    console.log('[Options] Configuration saved successfully');
    showStatus('Settings saved successfully!');
  } catch (error) {
    console.error('[Options] Failed to save configuration:', error);
    showStatus('Failed to save settings', true);
  }
}

// Reset to defaults
function resetToDefaults(): void {
  if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
    return;
  }

  for (const [key, id] of Object.entries(CONFIG_TO_ID_MAP)) {
    const defaultValue = DEFAULT_CONFIG[key as keyof SCE2Config];
    if (typeof defaultValue === 'boolean') {
      const element = document.getElementById(id) as HTMLInputElement | null;
      if (element) {
        element.checked = defaultValue;
      }
    } else {
      setInputValue(id, String(defaultValue));
    }
  }

  showStatus('Settings reset to defaults');
}

// Tab switching functionality
function setupTabs(): void {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      if (!targetTab) return;

      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const targetContent = document.getElementById(targetTab);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Options] Initializing options page');

  // Setup tab switching
  setupTabs();

  // Load saved configuration
  await loadConfigFromStorage();

  // Save button handler
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveConfigToStorage);
  }

  // Reset button handler
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetToDefaults);
  }

  console.log('[Options] Options page initialized');
});

// Export for use in content script
export { DEFAULT_CONFIG, loadConfigFromStorage, getInputValue };
export type { SCE2Config };
