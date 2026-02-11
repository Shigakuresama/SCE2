import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const webappRoot = path.resolve(process.cwd(), 'packages/webapp');
const apiSource = readFileSync(path.join(webappRoot, 'src/lib/api.ts'), 'utf-8');
const queuePageSource = readFileSync(path.join(webappRoot, 'src/pages/Queue.tsx'), 'utf-8');
const panelSource = readFileSync(
  path.join(webappRoot, 'src/components/CloudExtractionPanel.tsx'),
  'utf-8'
);

assert.match(
  apiSource,
  /createCloudExtractionRun/,
  'API should expose createCloudExtractionRun'
);
assert.match(
  apiSource,
  /startCloudExtractionRun/,
  'API should expose startCloudExtractionRun'
);
assert.match(
  apiSource,
  /getCloudExtractionRun/,
  'API should expose getCloudExtractionRun'
);
assert.match(
  queuePageSource,
  /CloudExtractionPanel/,
  'Queue page should render CloudExtractionPanel'
);
assert.match(
  panelSource,
  /Run Cloud Extraction/,
  'Cloud extraction panel should render operator action button'
);

console.log('PASS: cloud extraction panel and API wiring are in place');
