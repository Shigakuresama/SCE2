# SCE2 Critical Bug Fixes and Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical Zillow scraping infinite loop, configure production proxy, add QR scanner to mobile app, and implement quality-of-life improvements.

**Architecture:**
- **Zillow Fix:** Break circular import by updating export path in zillow.ts
- **Proxy Config:** Use Render MCP to add SCRAPER_API_KEY to production environment
- **QR Scanner:** Add react-qr-reader to mobile-web with camera permissions handling
- **Enhancements:** Add cache management endpoint, retry logic with exponential backoff, config export/import

**Tech Stack:**
- TypeScript, Express, Prisma (server)
- React, Vite (mobile/web)
- Render MCP (deployment)
- qrcode, react-qr-reader (QR functionality)

---

## Task 1: Fix Zillow Infinite Loop Bug

**Files:**
- Modify: `packages/cloud-server/src/lib/zillow.ts:10`

**Step 1: Verify the bug exists**

Read the file to confirm circular import:
```bash
cat packages/cloud-server/src/lib/zillow.ts
```

Expected: Line 10 exports from `proxy-scraper.js` which imports from `zillow-scraper.ts` which calls back to proxy-scraper

**Step 2: Fix the circular import**

Edit `packages/cloud-server/src/lib/zillow.ts` line 10:

```typescript
// REMOVE this circular import:
export { scrapeZillowData, type ZillowPropertyData } from './proxy-scraper.js';

// REPLACE with direct export:
export { scrapeZillowData, type ZillowPropertyData } from './zillow-scraper.js';
export { scrapeZillowWithProxy } from './proxy-scraper.js';
```

**Step 3: Update proxy-scraper to not call zillow-scraper**

Read `packages/cloud-server/src/lib/proxy-scraper.ts`:
```bash
cat packages/cloud-server/src/lib/proxy-scraper.ts | grep -A5 "import.*zillow-scraper"
```

If it imports and calls functions from `zillow-scraper.ts`, update `proxy-scraper.ts` to use direct scraping only:

```typescript
// Remove any imports from zillow-scraper
// Add direct scraping function inline if needed
```

**Step 4: Test the fix locally**

Start the server:
```bash
cd packages/cloud-server
npm run dev
```

In another terminal, test scraping:
```bash
curl "http://localhost:3333/api/zillow/scrape?address=1909%20W%20Martha%20Ln&zipCode=92706"
```

Expected: JSON response with property data OR graceful error, NOT "Maximum call stack size exceeded"

**Step 5: Commit the fix**

```bash
git add packages/cloud-server/src/lib/zillow.ts
git commit -m "fix(cloud-server): Fix infinite loop in Zillow scraping

Break circular import between zillow.ts, proxy-scraper.ts, and zillow-scraper.ts.
Export scrapeZillowData directly from zillow-scraper.ts instead of proxy-scraper.ts."
```

---

## Task 2: Add ScraperAPI Key to Render Production

**Files:**
- No files (use Render MCP)

**Step 1: Get the API key from local .env**

```bash
grep SCRAPER_API_KEY packages/cloud-server/.env
```

Expected: `SCRAPER_API_KEY=fc3e6f236d5ccc030835c54fe6beeea1`

**Step 2: Use Render MCP to update environment**

Using the `mcp__render__update_environment_variables` tool:

```
serviceId: srv-d63psi7pm1nc738bmqvg
envVars: [{"key": "SCRAPER_API_KEY", "value": "fc3e6f236d5ccc030835c54fe6beeea1"}]
replace: false
```

Expected: "Environment variables updated. A new deploy has been triggered"

**Step 3: Verify deployment**

Monitor Render dashboard or wait 2-3 minutes for deployment to complete.

**Step 4: Test production scraping**

```bash
curl "https://sce2-cloud-server.onrender.com/api/zillow/scrape?address=1909%20W%20Martha%20Ln&zipCode=92706"
```

Expected: JSON response with Zillow property data (sqFt, yearBuilt, etc.)

**Step 5: Document the key**

Add to `.env.example`:
```bash
echo "SCRAPER_API_KEY=your_scraperapi_key_here" >> packages/cloud-server/.env.example
```

```bash
git add packages/cloud-server/.env.example
git commit -m "docs(cloud-server): Add SCRAPER_API_KEY to .env.example"
```

---

## Task 3: Add QR Scanner to Mobile App

**Files:**
- Create: `packages/mobile-web/src/components/QRScanner.tsx`
- Modify: `packages/mobile-web/src/App.tsx:17-33`
- Modify: `packages/mobile-web/package.json`
- Test: Manual testing with camera

**Step 1: Install react-qr-reader**

```bash
cd packages/mobile-web
npm install react-qr-reader
```

Expected: Package added to package.json and node_modules

**Step 2: Create QRScanner component**

Create `packages/mobile-web/src/components/QRScanner.tsx`:

```tsx
import React, { useState } from 'react';
import { QrReader } from 'react-qr-reader';

interface QRScannerProps {
  onScan: (propertyId: string) => void;
  onError?: (error: Error) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const handleScan = (result: any, error: any) => {
    if (result) {
      const text = result?.getText();
      if (text) {
        try {
          const url = new URL(text);
          const propertyId = url.searchParams.get('propertyId');
          if (propertyId) {
            onScan(propertyId);
          } else {
            onError?.(new Error('No propertyId found in QR code'));
          }
        } catch (e) {
          onError?.(new Error('Invalid QR code format'));
        }
      }
    }

    if (error) {
      console.warn('QR scan error:', error);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <QrReader
        onResult={handleScan}
        constraints={{ facingMode }}
        videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
        containerStyle={{ width: '100%', height: '100%' }}
      />
      <button
        onClick={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          background: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        Flip Camera
      </button>
    </div>
  );
};
```

**Step 3: Update App.tsx to add scanner mode**

Modify `packages/mobile-web/src/App.tsx`:

```tsx
import { QRScanner } from './components/QRScanner';
import { useState, useEffect } from 'react';

function App() {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URL param takes precedence
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('propertyId');
    if (id) {
      setPropertyId(id);
      setShowScanner(false);
    }
  }, []);

  const handleScan = (scannedId: string) => {
    setPropertyId(scannedId);
    setShowScanner(false);
    setError(null);
  };

  const handleError = (err: Error) => {
    setError(err.message);
  };

  const handleNewScan = () => {
    setPropertyId(null);
    setShowScanner(true);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {showScanner ? (
        <div className="h-screen">
          <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white p-4 z-10">
            <h1 className="text-xl font-bold">Scan QR Code</h1>
            <p className="text-sm opacity-90">Point camera at property QR code</p>
          </div>
          <QRScanner onScan={handleScan} onError={handleError} />
          {error && (
            <div className="absolute bottom-20 left-4 right-4 bg-red-500 text-white p-4 rounded-lg">
              {error}
            </div>
          )}
        </div>
      ) : propertyId ? (
        <PropertyDetails propertyId={propertyId} onNewScan={handleNewScan} />
      ) : (
        <div className="p-4">
          <p className="text-red-600">No property ID found</p>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Update camera permissions in vite.config**

Modify `packages/mobile-web/vite.config.ts` to ensure HTTPS dev server (required for camera):

```typescript
export default defineConfig({
  // ... existing config
  server: {
    https: true, // Add this for camera access in development
  },
});
```

**Step 5: Test QR scanner**

```bash
cd packages/mobile-web
npm run dev
```

1. Open https://localhost:5174 (accept camera permission)
2. Generate a QR code from desktop app
3. Scan with mobile app
4. Verify it navigates to property details

Expected: Camera opens, QR code scans successfully, property ID extracted, navigates to property form

**Step 6: Commit**

```bash
git add packages/mobile-web/src/components/QRScanner.tsx
git add packages/mobile-web/src/App.tsx
git add packages/mobile-web/vite.config.ts
git add packages/mobile-web/package.json
git commit -m "feat(mobile-web): Add QR scanner for property IDs

Add react-qr-reader with camera support.
Users can now scan property QR codes directly in mobile app.
Includes camera flip button and error handling."
```

---

## Task 4: Add Zillow Cache Management Endpoint

**Files:**
- Modify: `packages/cloud-server/src/routes/zillow.ts`
- Modify: `packages/cloud-server/src/lib/zillow.ts`

**Step 1: Write failing test**

No automated test - we'll test manually with curl.

**Step 2: Add cache clearing function to zillow.ts**

Add to `packages/cloud-server/src/lib/zillow.ts`:

```typescript
// Add at end of file
export function clearZillowCache(): void {
  zillowCache.clear();
  cacheTimestamps.clear();
  logger.info('Zillow cache cleared');
}

export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; timestamp: number }>;
} {
  return {
    size: zillowCache.size,
    entries: Array.from(cacheTimestamps.entries()).map(([key, timestamp]) => ({
      key,
      timestamp,
    })),
  };
}
```

**Step 3: Add DELETE endpoint to routes/zillow.ts**

```typescript
import { clearZillowCache, getCacheStats } from '../lib/zillow.js';

// Add after existing routes
zillowRoutes.delete('/cache', asyncHandler(async (req, res) => {
  clearZillowCache();
  res.json({ success: true, message: 'Cache cleared' });
}));

zillowRoutes.get('/cache/stats', asyncHandler(async (req, res) => {
  const stats = getCacheStats();
  res.json({ success: true, data: stats });
}));
```

**Step 4: Test cache management**

```bash
# Test cache stats
curl http://localhost:3333/api/zillow/cache/stats

# Test cache clear
curl -X DELETE http://localhost:3333/api/zillow/cache
```

Expected: JSON responses with cache size/entries and success message

**Step 5: Commit**

```bash
git add packages/cloud-server/src/lib/zillow.ts
git add packages/cloud-server/src/routes/zillow.ts
git commit -m "feat(cloud-server): Add Zillow cache management endpoints

Add GET /api/zillow/cache/stats to view cache
Add DELETE /api/zillow/cache to clear cache"
```

---

## Task 5: Add Retry Logic with Exponential Backoff

**Files:**
- Create: `packages/cloud-server/src/lib/retry.ts`
- Modify: `packages/cloud-server/src/lib/proxy-scraper.ts`

**Step 1: Create retry utility**

Create `packages/cloud-server/src/lib/retry.ts`:

```typescript
export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  }
): Promise<T> {
  let lastError: Error;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === options.maxAttempts) {
        break;
      }

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
    }
  }

  throw lastError!;
}
```

**Step 2: Update proxy-scraper to use retry**

Modify `packages/cloud-server/src/lib/proxy-scraper.ts` in each proxy service function:

```typescript
import { retryWithBackoff } from './retry.js';

// Update each proxy call (example for ScraperAPI):
async function scrapeWithScraperAPI(url: string): Promise<ZillowPropertyData> {
  return retryWithBackoff(async () => {
    const apiKey = getProxyKey('scraperapi');
    if (!apiKey) throw new Error('ScraperAPI key not configured');

    const proxyUrl = `http://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`ScraperAPI failed: ${response.status}`);
    }

    const html = await response.text();
    return parseZillowHtml(html);
  }, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
  });
}
```

**Step 3: Test retry behavior**

```bash
# Start server
cd packages/cloud-server
npm run dev

# In another terminal, test with invalid address to trigger retries
curl "http://localhost:3333/api/zillow/scrape?address=invalid&zipCode=00000"
```

Expected: Multiple retry attempts logged in server console

**Step 4: Commit**

```bash
git add packages/cloud-server/src/lib/retry.ts
git add packages/cloud-server/src/lib/proxy-scraper.ts
git commit -m "feat(cloud-server): Add retry logic with exponential backoff

Add retryWithBackoff utility for resilient proxy scraping.
Retries failed requests up to 3 times with exponential backoff."
```

---

## Task 6: Add Configuration Export/Import to Extension

**Files:**
- Create: `packages/extension/src/lib/config-manager.ts`
- Modify: `packages/extension/options.html`
- Modify: `packages/extension/src/options.ts`

**Step 1: Create config manager utility**

Create `packages/extension/src/lib/config-manager.ts`:

```typescript
import { SCE2Config, DEFAULT_CONFIG } from './options.js';

export async function exportConfig(): Promise<string> {
  const data = await chrome.storage.sync.get(null);
  return JSON.stringify(data, null, 2);
}

export async function importConfig(jsonString: string): Promise<void> {
  try {
    const data = JSON.parse(jsonString);

    // Validate structure
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid config format');
    }

    // Merge with defaults to ensure all fields exist
    const merged = { ...DEFAULT_CONFIG, ...data };

    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(merged);

    return merged;
  } catch (error) {
    throw new Error(`Failed to import config: ${(error as Error).message}`);
  }
}

export async function resetToDefaults(): Promise<void> {
  await chrome.storage.sync.clear();
  await chrome.storage.sync.set(DEFAULT_CONFIG);
}

export function downloadConfigFile() {
  exportConfig().then(json => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sce2-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
```

**Step 2: Add export/import buttons to options.html**

Add to the "Behavior" tab in `packages/extension/options.html`:

```html
<div class="config-actions">
  <button id="exportConfig">Export Configuration</button>
  <button id="importConfig">Import Configuration</button>
  <button id="resetConfig">Reset to Defaults</button>
  <input type="file" id="configFileInput" accept=".json" style="display: none;">
</div>

<style>
.config-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.config-actions button {
  padding: 10px 16px;
  border: 1px solid #ddd;
  background: #f5f5f5;
  cursor: pointer;
  border-radius: 4px;
}

.config-actions button:hover {
  background: #e0e0e0;
}
</style>
```

**Step 3: Add event handlers in options.ts**

Add to `packages/extension/src/options.ts`:

```typescript
import * as ConfigManager from './lib/config-manager.js';

// Add after existing DOMContentLoaded
document.getElementById('exportConfig')?.addEventListener('click', () => {
  ConfigManager.downloadConfigFile();
});

document.getElementById('importConfig')?.addEventListener('click', () => {
  document.getElementById('configFileInput')?.click();
});

document.getElementById('configFileInput')?.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const json = event.target?.result as string;
      await ConfigManager.importConfig(json);
      alert('Configuration imported successfully!');
      location.reload();
    } catch (error) {
      alert(`Failed to import: ${(error as Error).message}`);
    }
  };
  reader.readAsText(file);
});

document.getElementById('resetConfig')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    await ConfigManager.resetToDefaults();
    alert('Configuration reset to defaults!');
    location.reload();
  }
});
```

**Step 4: Test export/import**

```bash
cd packages/extension
npm run build
```

1. Load extension in Chrome
2. Open Options page
3. Click "Export Configuration" - should download JSON file
4. Modify some settings
5. Click "Import Configuration" - upload the JSON file
6. Verify settings are restored
7. Click "Reset to Defaults" - verify all settings reset

Expected: All three operations work correctly

**Step 5: Commit**

```bash
git add packages/extension/src/lib/config-manager.ts
git add packages/extension/options.html
git add packages/extension/src/options.ts
git commit -m "feat(extension): Add configuration export/import/reset

Add buttons to export config as JSON, import from file, and reset to defaults.
Useful for backup, sharing configs, and troubleshooting."
```

---

## Task 7: Complete Orange County Assessor Scraper

**Files:**
- Modify: `packages/cloud-server/src/lib/assessor-scraper.ts`

**Step 1: Research Orange County Assessor website**

Visit https://acpa.ocgov.com/TaxBill/PropertySearch to understand:
- Search form structure
- Required parameters
- Response format
- HTML structure of results page

**Step 2: Implement scraper**

Based on research, implement `scrapeAssessor()` function:

```typescript
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export interface AssessorPropertyData {
  sqFt?: number;
  yearBuilt?: number;
  lotSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  apn?: string;
}

export async function scrapeAssessor(address: string, zipCode: string): Promise<AssessorPropertyData | null> {
  try {
    // Step 1: Perform search
    const searchUrl = 'https://acpa.ocgov.com/TaxBill/PropertySearch';
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        // Fill in actual form field names from research
        'PropertyAddress': address,
        'ZipCode': zipCode,
      }),
    });

    const searchHtml = await searchResponse.text();

    // Step 2: Parse results
    const $ = cheerio.load(searchHtml);

    // Extract property details based on actual HTML structure
    // This is placeholder - update with actual selectors
    const sqFt = parseNumber($('selector-for-sqft').text());
    const yearBuilt = parseNumber($('selector-for-year').text());

    return {
      sqFt: sqFt || undefined,
      yearBuilt: yearBuilt || undefined,
      // ... other fields
    };
  } catch (error) {
    console.error('Assessor scraping failed:', error);
    return null;
  }
}

function parseNumber(text: string): number | null {
  const match = text.match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, ''), 10) : null;
}
```

**Step 3: Add to Zillow fallback**

Modify `packages/cloud-server/src/lib/zillow.ts` to try assessor as fallback:

```typescript
import { scrapeAssessor } from './assessor-scraper.js';

export async function scrapeZillowData(address: string, zipCode: string): Promise<ZillowPropertyData> {
  // Try Zillow with proxy first
  let result = await scrapeZillowWithProxy(address, zipCode);
  if (result && (result.sqFt || result.yearBuilt)) {
    return result;
  }

  // Fallback to Orange County Assessor
  console.log('Zillow failed, trying Orange County Assessor...');
  const assessorData = await scrapeAssessor(address, zipCode);

  return {
    sqFt: assessorData?.sqFt,
    yearBuilt: assessorData?.yearBuilt,
    // Map other fields...
  };
}
```

**Step 4: Test assessor scraper**

```bash
cd packages/cloud-server
npm run dev

curl "http://localhost:3333/api/zillow/scrape?address=1909%20W%20Martha%20Ln&zipCode=92706"
```

Expected: Returns assessor data if Zillow fails

**Step 5: Commit**

```bash
git add packages/cloud-server/src/lib/assessor-scraper.ts
git add packages/cloud-server/src/lib/zillow.ts
git commit -m "feat(cloud-server): Complete Orange County Assessor scraper

Implement fallback to county assessor when Zillow fails.
Provides reliable property data for Orange County addresses."
```

---

## Testing Checklist

After completing all tasks:

**Zillow Scraping:**
- [ ] Local scraping works without infinite loop
- [ ] Production scraping works with ScraperAPI
- [ ] Assessor fallback works when Zillow fails
- [ ] Cache management endpoints work
- [ ] Retry logic activates on failures

**Mobile QR Scanner:**
- [ ] Camera permission requested
- [ ] QR code scans correctly
- [ ] Property ID extracted from URL
- [ ] Navigates to correct property form
- [ ] Camera flip works

**Extension Config:**
- [ ] Export downloads JSON file
- [ ] Import loads and validates JSON
- [ ] Reset clears all settings
- [ ] All config persists across restarts

---

## Documentation Updates

After implementation, update:

**CLAUDE.md:**
- Add QR scanner usage to mobile section
- Document cache management endpoints
- Document retry configuration
- Add config export/import instructions

**README.md:**
- Add Orange County Assessor as alternative data source
- Update troubleshooting section

**docs/TEST_REPORT.md:**
- Add test results for new features
