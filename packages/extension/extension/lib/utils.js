// Utility functions for SCE2 extension
// This file will be copied directly (not compiled)
export const SCEUtils = {
    // ==========================================
    // TIME CALCULATIONS
    // ==========================================
    addHoursToTime(time, hoursToAdd) {
        const [timePart, period = 'AM'] = time.toUpperCase().split(/(AM|PM)/i);
        let [hours, minutes = '00'] = timePart.trim().split(':').map(Number);
        // Convert to 24-hour format
        if (period === 'PM' && hours !== 12)
            hours += 12;
        if (period === 'AM' && hours === 12)
            hours = 0;
        // Add hours
        hours += hoursToAdd;
        // Handle rollover
        const daysToAdd = Math.floor(hours / 24);
        hours = hours % 24;
        // Convert back to 12-hour format
        let newPeriod = hours >= 12 ? 'PM' : 'AM';
        let newHours = hours > 12 ? hours - 12 : hours;
        if (newHours === 0)
            newHours = 12;
        const newMinutes = minutes.toString().padStart(2, '0');
        return `${newHours}:${newMinutes}${newPeriod}`;
    },
    // ==========================================
    // ADDRESS PARSING
    // ==========================================
    parseAddress(fullAddress) {
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
    isValidZip(zip) {
        return /^\d{5}$/.test(zip);
    },
    isValidPhone(phone) {
        return /^\d{10}$/.test(phone.replace(/\D/g, ''));
    },
    // ==========================================
    // FORMATTING
    // ==========================================
    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return `(${match[1]}) ${match[2]}-${match[3]}`;
        }
        return phone;
    },
};
window.SCEUtils = SCEUtils;
//# sourceMappingURL=utils.js.map