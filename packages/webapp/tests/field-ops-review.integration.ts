import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const webappRoot = path.resolve(process.cwd(), 'packages/webapp');
const appSource = readFileSync(path.join(webappRoot, 'src/App.tsx'), 'utf-8');
const navigationSource = readFileSync(
  path.join(webappRoot, 'src/components/Navigation.tsx'),
  'utf-8'
);
const fieldOpsPageSource = readFileSync(
  path.join(webappRoot, 'src/pages/FieldOpsReview.tsx'),
  'utf-8'
);
const apiSource = readFileSync(path.join(webappRoot, 'src/lib/api.ts'), 'utf-8');

assert.match(
  appSource,
  /path="\/field-ops"/,
  'App must register /field-ops route'
);
assert.match(
  navigationSource,
  /path: '\/field-ops'/,
  'Navigation must include field-ops link'
);
assert.match(
  fieldOpsPageSource,
  /Missing Bill/,
  'Field ops page must expose artifact filters'
);
assert.match(
  apiSource,
  /params\.append\('limit',/,
  'API client should support explicit limit query params'
);
assert.match(
  apiSource,
  /getProperties\(\{\s*status,\s*limit:\s*5000\s*\}\)/,
  'Field ops API call should request a high limit to avoid truncation'
);

const baseUrl = process.env.CLOUD_URL || 'http://localhost:3333';

try {
  const response = await fetch(
    `${baseUrl}/api/properties?status=VISITED&limit=200`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const body = await response.json();
  if (!body.success) {
    throw new Error('API response marked unsuccessful');
  }

  const missing = body.data.filter((property: any) => {
    const types = new Set((property.documents || []).map((d: any) => d.docType));
    return !types.has('BILL') || !types.has('SIGNATURE');
  });

  console.log(`Visited=${body.data.length} MissingArtifacts=${missing.length}`);
} catch (error) {
  const reason = error instanceof Error ? error.message : 'unknown';
  console.log(`Visited=N/A MissingArtifacts=N/A (server unavailable: ${reason})`);
}
