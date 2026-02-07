export interface CustomerSearchData {
    address: string;
    zipCode: string;
}
export interface CustomerInfoData {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
}
export interface SelectOption {
    selector: string;
    value: string;
    byLabel?: boolean;
}
export interface DocumentData {
    url: string;
    name: string;
    type: string;
}
export declare class SCEHelper {
    fillField(selector: string, value: string, fieldName?: string): Promise<void>;
    fillSelect(selector: string, value: string, byLabel?: boolean): Promise<void>;
    findInputByMatLabel(labelText: string): HTMLInputElement | null;
    waitForElement(selector: string, timeout?: number, parent?: Element | Document): Promise<Element>;
    fillCustomerSearch(data: CustomerSearchData): Promise<void>;
    fillCustomerInfo(data: CustomerInfoData): Promise<void>;
    clickNext(): Promise<void>;
    uploadDocuments(documents: DocumentData[]): Promise<void>;
}
