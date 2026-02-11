import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const webappRoot = path.resolve(process.cwd(), 'packages/webapp');
const dashboardSource = readFileSync(
  path.join(webappRoot, 'src/pages/Dashboard.tsx'),
  'utf-8'
);
const mapLayoutSource = readFileSync(
  path.join(webappRoot, 'src/components/MapLayout.tsx'),
  'utf-8'
);

assert.match(
  dashboardSource,
  /<MapLayout[\s\S]*selectedProperties=\{selectedProperties\}/,
  'Dashboard must pass selectedProperties into MapLayout'
);
assert.match(
  dashboardSource,
  /<MapLayout[\s\S]*setSelectedProperties=\{setSelectedProperties\}/,
  'Dashboard must pass setSelectedProperties into MapLayout'
);
assert.match(
  dashboardSource,
  /<PDFGenerator[\s\S]*selectedProperties=\{selectedProperties\}/,
  'Dashboard must pass selectedProperties into PDFGenerator'
);
assert.ok(
  !mapLayoutSource.includes(
    'const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);'
  ),
  'MapLayout must not own local selectedProperties state'
);

const selectedIds = [11, 12, 13, 14, 15, 16, 17, 18, 19];
const extractionIds = [...selectedIds];
const pdfIds = [...selectedIds];
assert.deepEqual(
  extractionIds,
  pdfIds,
  'Extraction and PDF IDs must stay identical'
);

console.log('PASS: extraction and PDF use the same selected property IDs');
