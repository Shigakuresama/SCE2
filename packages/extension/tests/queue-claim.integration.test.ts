import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Queue Claim Endpoints', () => {
  it('uses atomic claim endpoints and persists failure reasons', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/background.ts'),
      'utf-8'
    );

    expect(source).toContain('/api/queue/scrape-and-claim');
    expect(source).toContain('/api/queue/submit-and-claim');
    expect(source).toContain('/api/queue/${propertyId}/fail');
    expect(source).toMatch(/body:\s*JSON\.stringify\(\{\s*type,\s*reason\s*\}\)/s);
  });
});
