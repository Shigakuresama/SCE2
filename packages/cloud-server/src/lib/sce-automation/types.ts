export interface SCEAutomationAddressInput {
  streetNumber: string;
  streetName: string;
  zipCode: string;
}

export interface SCEExtractionResult {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  screenshotPath?: string;
}

export interface SCEAutomationClient {
  extractCustomerData(
    address: SCEAutomationAddressInput,
    options?: { storageStateJson?: string }
  ): Promise<SCEExtractionResult>;
  dispose?(): Promise<void>;
}
