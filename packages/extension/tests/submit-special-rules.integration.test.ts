import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Submit automation special rules', () => {
  it('uses section-aware fill and upload navigation in submit flow', () => {
    const contentSource = readFileSync(
      path.resolve(process.cwd(), 'src/content.ts'),
      'utf-8'
    );

    expect(contentSource).toContain('await fillAllSections(propertyData, banner);');
    expect(contentSource).toContain("goTo('File Uploads')");
    expect(contentSource).toContain('helper.uploadDocuments(jobData.documents)');
  });

  it('keeps homeowner, ZIP+4, and alternate-phone special rules', () => {
    const orchestratorSource = readFileSync(
      path.resolve(process.cwd(), 'src/lib/fill-orchestrator.ts'),
      'utf-8'
    );

    expect(orchestratorSource).toContain('await clickAddButton(signal)');
    expect(orchestratorSource).toContain(
      'extractPlus4FromMailingZip() || getPlus4Zip'
    );
    expect(orchestratorSource).toContain('copyAlternatePhoneToContact');
    expect(orchestratorSource).toContain(
      'await copyAlternatePhoneToContact(signal);'
    );
  });
});
