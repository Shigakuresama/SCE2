// packages/extension/src/lib/error-accumulator.ts
/**
 * Error accumulator for collecting multiple errors during form filling
 * without stopping the entire process.
 */

export interface FieldError {
  section: string;
  field: string;
  message: string;
  timestamp: number;
}

export class ErrorAccumulator {
  private errors: FieldError[] = [];

  /**
   * Add an error to the accumulator.
   */
  add(section: string, field: string, message: string): void {
    this.errors.push({
      section,
      field,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if any errors have been recorded.
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get all recorded errors.
   */
  getErrors(): FieldError[] {
    return [...this.errors];
  }

  /**
   * Get a human-readable summary of all errors.
   */
  getSummary(): string {
    if (this.errors.length === 0) {
      return 'No errors';
    }

    const grouped = this.errors.reduce((acc, error) => {
      const key = error.section;
      if (!acc[key]) acc[key] = [];
      acc[key].push(error);
      return acc;
    }, {} as Record<string, FieldError[]>);

    const lines = [`Form fill completed with ${this.errors.length} error(s):`];

    for (const [section, errors] of Object.entries(grouped)) {
      lines.push(`  ${section}:`);
      for (const error of errors) {
        lines.push(`    - ${error.field}: ${error.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Wrap an async operation and capture any errors.
   * Returns the result of the operation, or undefined if it failed.
   */
  async wrap<T>(
    section: string,
    field: string,
    operation: () => Promise<T>
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.add(section, field, message);
      return undefined;
    }
  }

  /**
   * Throw an error if any errors have been recorded.
   * Useful for failing fast at the end of an operation.
   */
  throwIfErrors(message?: string): void {
    if (this.errors.length > 0) {
      throw new Error(message ?? this.getSummary());
    }
  }

  /**
   * Clear all recorded errors.
   */
  clear(): void {
    this.errors = [];
  }

  /**
   * Get count of errors.
   */
  get count(): number {
    return this.errors.length;
  }
}
