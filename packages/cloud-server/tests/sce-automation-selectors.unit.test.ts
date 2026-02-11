import { describe, expect, it } from 'vitest';
import { pickFirstNonEmpty } from '../src/lib/sce-automation/selectors.js';

describe('SCE selector fallback', () => {
  it('returns first non-empty value in priority order', () => {
    const result = pickFirstNonEmpty(['', '  ', 'Jane Doe', 'Ignored']);
    expect(result).toBe('Jane Doe');
  });

  it('returns undefined when no values are available', () => {
    const result = pickFirstNonEmpty(['', '   ', undefined, null]);
    expect(result).toBeUndefined();
  });
});
