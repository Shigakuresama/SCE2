import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const webappRoot = path.join(process.cwd(), 'packages', 'webapp');
const apiSource = readFileSync(path.join(webappRoot, 'src', 'lib', 'api.ts'), 'utf8');
const typesSource = readFileSync(path.join(webappRoot, 'src', 'types.ts'), 'utf8');

assert.match(typesSource, /export interface MobileRoutePlanRequest/);
assert.match(typesSource, /export interface MobileRoutePlanResponse/);
assert.match(apiSource, /async createMobileRoutePlan\(/);
assert.match(apiSource, /\/routes\/mobile-plan/);

console.log('mobile-route-plan.integration.ts: PASS');
