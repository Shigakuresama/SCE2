export declare const SCEUtils: {
    addHoursToTime(time: string, hoursToAdd: number): string;
    parseAddress(fullAddress: string): {
        streetNumber: string;
        streetName: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
    isValidZip(zip: string): boolean;
    isValidPhone(phone: string): boolean;
    formatPhone(phone: string): string;
};
declare global {
    interface Window {
        SCEUtils: typeof SCEUtils;
    }
}
