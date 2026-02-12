// Utility functions for SCE2 extension
// This file will be copied directly (not compiled)

export const SCEUtils = {
  // ==========================================
  // TIME CALCULATIONS
  // ==========================================
  addHoursToTime(time: string, hoursToAdd: number): string {
    const [timePart, period = 'AM'] = time.toUpperCase().split(/(AM|PM)/i);
    let [hours, minutes = '00'] = timePart.trim().split(':').map(Number);

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    // Add hours
    hours += hoursToAdd;

    // Handle rollover
    hours = hours % 24;

    // Convert back to 12-hour format
    let newPeriod = hours >= 12 ? 'PM' : 'AM';
    let newHours = hours > 12 ? hours - 12 : hours;
    if (newHours === 0) newHours = 12;

    const newMinutes = minutes.toString().padStart(2, '0');
    return `${newHours}:${newMinutes}${newPeriod}`;
  },

  // ==========================================
  // ADDRESS PARSING
  // ==========================================
  parseAddress(fullAddress: string): {
    streetNumber: string;
    streetName: string;
    city?: string;
    state?: string;
    zipCode?: string;
  } {
    const parts = fullAddress.split(',').map((p) => p.trim());

    const addressParts = parts[0]?.split(' ') || [];
    const streetNumber = addressParts[0];
    const streetName = addressParts.slice(1).join(' ');

    return {
      streetNumber,
      streetName,
      city: parts[1],
      state: parts[2]?.split(' ')[0],
      zipCode: parts[2]?.split(' ')[1],
    };
  },

  // ==========================================
  // VALIDATION
  // ==========================================
  isValidZip(zip: string): boolean {
    return /^\d{5}$/.test(zip);
  },

  isValidPhone(phone: string): boolean {
    return /^\d{10}$/.test(phone.replace(/\D/g, ''));
  },

  // ==========================================
  // FORMATTING
  // ==========================================
  formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  },
};

// ==========================================
// ASYNC HANDLER WRAPPER
// ==========================================
/**
 * Wrap an async message handler to properly return true for async responses.
 * Ensures all async operations are properly awaited and errors are caught.
 *
 * Usage:
 * chrome.runtime.onMessage.addListener(
 *   asyncHandler(async (message, sender, sendResponse) => {
 *     const result = await someAsyncOperation();
 *     return { success: true, data: result };
 *   })
 * );
 */
export function asyncHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => boolean {
  return (...args: T) => {
    const sendResponse = args[args.length - 1] as (response: R) => void;

    handler(...args)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[AsyncHandler] Unhandled error:', errorMessage);
        sendResponse({
          success: false,
          error: errorMessage,
        } as R);
      });

    return true; // Keep channel open for async response
  };
}

// Make available globally (for content scripts)
declare global {
  interface Window {
    SCEUtils: typeof SCEUtils;
  }
}

window.SCEUtils = SCEUtils;
