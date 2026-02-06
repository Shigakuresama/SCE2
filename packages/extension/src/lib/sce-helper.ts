// SCE Helper class for form interactions
// Reused from SCE project with improvements

export class SCEHelper {
  // ==========================================
  // FIELD FILLING
  // ==========================================
  async fillField(selector: string, value: string): Promise<void> {
    const element = document.querySelector(selector) as HTMLInputElement;

    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
  }

  async fillSelect(selector: string, value: string): Promise<void> {
    const trigger = document.querySelector(selector) as HTMLElement;

    if (!trigger) {
      throw new Error(`Select not found: ${selector}`);
    }

    trigger.click();

    // Wait for options to appear
    await new Promise((resolve) => setTimeout(resolve, 500));

    const options = document.querySelectorAll('.mat-option');
    const option = Array.from(options).find(
      (opt) => opt.textContent?.trim() === value
    );

    if (option) {
      (option as HTMLElement).click();
    } else {
      throw new Error(`Option not found: ${value}`);
    }
  }

  // ==========================================
  // CUSTOMER SEARCH
  // ==========================================
  async fillCustomerSearch(data: {
    address: string;
    zipCode: string;
  }): Promise<void> {
    await this.fillField('input[name="streetNum"]', data.address.split(' ')[0]);
    await this.fillField('input[name="streetName"]', data.address.split(' ').slice(1).join(' '));
    await this.fillField('input[name="zip"]', data.zipCode);
  }

  // ==========================================
  // CUSTOMER INFO
  // ==========================================
  async fillCustomerInfo(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  }): Promise<void> {
    await this.fillField('input[name="firstName"]', data.firstName);
    await this.fillField('input[name="lastName"]', data.lastName);
    await this.fillField('input[name="phone"]', data.phone);

    if (data.email) {
      await this.fillField('input[name="email"]', data.email);
    }
  }

  // ==========================================
  // NAVIGATION
  // ==========================================
  async clickNext(): Promise<void> {
    const nextButton = document.querySelector('button[type="submit"], .btn-next');

    if (nextButton) {
      (nextButton as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // ==========================================
  // DOCUMENT UPLOADS
  // ==========================================
  async uploadDocuments(documents: Array<{ url: string; name: string; type: string }>): Promise<void> {
    for (const doc of documents) {
      // Fetch file as blob
      const response = await fetch(doc.url);
      const blob = await response.blob();

      // Convert to File
      const file = new File([blob], doc.name, { type: doc.type });

      // Find file input
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        // Create DataTransfer
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;

        // Trigger change event
        input.dispatchEvent(new Event('change', { bubbles: true }));

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}
