import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Submit automation safety gates', () => {
  it('defaults to visible section only and disables upload/final submit', () => {
    const storageSource = readFileSync(
      path.resolve(process.cwd(), 'src/lib/storage.ts'),
      'utf-8'
    );

    expect(storageSource).toContain('submitVisibleSectionOnly: true');
    expect(storageSource).toContain('enableDocumentUpload: false');
    expect(storageSource).toContain('enableFinalSubmit: false');
  });

  it('uses config gates in submit flow', () => {
    const contentSource = readFileSync(
      path.resolve(process.cwd(), 'src/content.ts'),
      'utf-8'
    );

    expect(contentSource).toContain('const config = await getConfig();');
    expect(contentSource).toContain('config.submitVisibleSectionOnly');
    expect(contentSource).toContain('await fillCurrentSection(propertyData, banner);');
    expect(contentSource).toContain('if (config.enableDocumentUpload)');
    expect(contentSource).toContain('if (!config.enableFinalSubmit)');
    expect(contentSource).toContain('Final submit disabled by configuration');
  });

  it('exposes safety controls in options UI', () => {
    const optionsSource = readFileSync(
      path.resolve(process.cwd(), 'src/options.ts'),
      'utf-8'
    );
    const optionsHtml = readFileSync(
      path.resolve(process.cwd(), 'options.html'),
      'utf-8'
    );

    expect(optionsSource).toContain('submitVisibleSectionOnly');
    expect(optionsSource).toContain('enableDocumentUpload');
    expect(optionsSource).toContain('enableFinalSubmit');

    expect(optionsHtml).toContain('id="submitVisibleSectionOnly"');
    expect(optionsHtml).toContain('id="enableDocumentUpload"');
    expect(optionsHtml).toContain('id="enableFinalSubmit"');
  });

  it('skips submit queue polling when final submit is disabled', () => {
    const backgroundSource = readFileSync(
      path.resolve(process.cwd(), 'src/background.ts'),
      'utf-8'
    );

    expect(backgroundSource).toContain('if (!config.enableFinalSubmit)');
    expect(backgroundSource).toContain('Final submit automation disabled');
  });
});
