import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const webappRoot = path.join(process.cwd(), 'packages', 'webapp');
const apiSource = readFileSync(path.join(webappRoot, 'src', 'lib', 'api.ts'), 'utf8');
const typesSource = readFileSync(path.join(webappRoot, 'src', 'types.ts'), 'utf8');
const appSource = readFileSync(path.join(webappRoot, 'src', 'App.tsx'), 'utf8');
const navSource = readFileSync(path.join(webappRoot, 'src', 'components', 'Navigation.tsx'), 'utf8');
const pageSource = readFileSync(path.join(webappRoot, 'src', 'pages', 'MobileRoutePack.tsx'), 'utf8');

assert.match(typesSource, /export interface MobileRoutePlanRequest/);
assert.match(typesSource, /export interface MobileRoutePlanResponse/);
assert.match(apiSource, /async createMobileRoutePlan\(/);
assert.match(apiSource, /\/routes\/mobile-plan/);
assert.match(appSource, /path="\/mobile-pack"/);
assert.match(appSource, /window\.location\.hash\.startsWith\('#\/'\)/);
assert.match(appSource, /navigate\(targetPath, \{ replace: true \}\)/);
assert.match(navSource, /path: '\/mobile-pack'/);
assert.match(pageSource, /createMobileRoutePlan/);
assert.match(pageSource, /generateRouteSheet/);
assert.match(
  pageSource,
  /useEffect\(\(\) => \{[\s\S]*setPlannedRoute\(null\);[\s\S]*\}, \[routeName, description, startLat, startLon, selectedPropertyIds\]\);/
);

console.log('mobile-route-plan.integration.ts: PASS');
