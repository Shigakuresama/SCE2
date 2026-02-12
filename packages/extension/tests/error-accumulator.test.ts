// packages/extension/tests/error-accumulator.test.ts
import { describe, it, expect } from 'vitest';
import { ErrorAccumulator } from '../src/lib/error-accumulator.js';

describe('ErrorAccumulator', () => {
  it('should start with no errors', () => {
    const accumulator = new ErrorAccumulator();
    expect(accumulator.hasErrors()).toBe(false);
    expect(accumulator.getErrors()).toEqual([]);
  });

  it('should record errors with context', () => {
    const accumulator = new ErrorAccumulator();
    accumulator.add('Customer Info', 'firstName', 'Field not found');

    expect(accumulator.hasErrors()).toBe(true);
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(accumulator.getErrors()[0]).toMatchObject({
      section: 'Customer Info',
      field: 'firstName',
      message: 'Field not found',
    });
  });

  it('should format errors as readable string', () => {
    const accumulator = new ErrorAccumulator();
    accumulator.add('Customer Info', 'firstName', 'Field not found');
    accumulator.add('Project Info', 'squareFootage', 'Invalid value');

    const summary = accumulator.getSummary();
    expect(summary).toContain('Customer Info');
    expect(summary).toContain('firstName');
    expect(summary).toContain('2 error(s)');
  });

  it('should wrap async operations and capture errors', async () => {
    const accumulator = new ErrorAccumulator();

    // Successful operation
    await accumulator.wrap('Section', 'field1', async () => 'success');

    // Failed operation
    await accumulator.wrap('Section', 'field2', async () => {
      throw new Error('Operation failed');
    });

    expect(accumulator.hasErrors()).toBe(true);
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(accumulator.getErrors()[0].field).toBe('field2');
  });

  it('should throw combined error when requested', () => {
    const accumulator = new ErrorAccumulator();
    accumulator.add('Section', 'field', 'Error 1');

    expect(() => accumulator.throwIfErrors()).toThrow('1 error(s)');
  });

  it('should not throw when no errors', () => {
    const accumulator = new ErrorAccumulator();
    expect(() => accumulator.throwIfErrors()).not.toThrow();
  });
});
