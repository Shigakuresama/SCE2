# SCE2 Enhancement Plan - Critical, High, and Medium Priority Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement critical improvements to SCE2 including Redfin fallback scraper, enhanced error messages, health checks, and test coverage.

**Architecture:**
- Add Redfin as fallback when Zillow fails (mirroring SCE v1 pattern)
- Implement cascading fallback: Zillow → Redfin → Config → Hardcoded defaults
- Add health check endpoints to monitor scraper status
- Enhance error messages with specific failure reasons
- Add Vitest tests for new functions

**Tech Stack:** TypeScript, Express, Vitest, cheerio (for HTML parsing), fetch API

---

## Task 1: Implement Redfin Scraper Module

**Files:**
- Create: `packages/cloud-server/src/lib/redfin-scraper.ts`
- Create: `packages/cloud-server/src/lib/redfin-scraper.test.ts`

**Step 1: Write the Redfin scraper function**

```typescript
// packages/cloud-server/src/lib/redfin-scraper.ts
/**
 * Redfin Property Data Scraper
 * Fallback when Zillow fails
 */

export interface RedfinPropertyData {
  sqFt?: number;
  yearBuilt?: number;
  lotSize?: number;
  bedrooms?: number;
  bathrooms?: number;
}

/**
 * Scrapes Redfin for property data
 * Redfin is often more accessible than Zillow
 */
export async function scrapeRedfin(
  address: string,
  zipCode: string
): Promise<Partial<RedfinPropertyData>> {
  const formattedAddress = address.toLowerCase().replace(/\s+/g, '-');
  const redfinUrl = `https://www.redfin.com/${zipCode}/${formattedAddress}`;

  console.log('[Redfin] Fetching:', redfinUrl);

  const response = await fetch(redfinUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Redfin error: ${response.status}`);
  }

  const html = await response.text();
  return parseRedfinHtml(html);
}

function parseRedfinHtml(html: string): Partial<RedfinPropertyData> {
  // Redfin puts data in a JavaScript variable
  const dataMatch = html.match(/window\.plutoPageData = (\{.+?\});/);

  if (!dataMatch) {
    return {};
  }

  try {
    const data = JSON.parse(dataMatch[1]);
    const property = Object.values(data)[0] as any;

    return {
      sqFt: property.livingArea || property.squareFootage,
      yearBuilt: property.yearBuilt,
      lotSize: property.lotSize,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
    };
  } catch {
    return {};
  }
}
```

**Step 2: Write test file**

```typescript
// packages/cloud-server/src/lib/redfin-scraper.test.ts
import { describe, it, expect } from 'vitest';
import { scrapeRedfin } from './redfin-scraper.js';

describe('Redfin Scraper', () => {
  it('should return property data for valid address', async () => {
    const result = await scrapeRedfin('123 Main St', '90210');
    expect(result).toHaveProperty('sqFt');
    expect(result).toHaveProperty('yearBuilt');
  });

  it('should return empty object for invalid address', async () => {
    const result = await scrapeRedfin(' nonexistent address', '00000');
    expect(Object.keys(result).length).toBe(0);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd packages/cloud-server && npm test -- redfin-scraper.test`
Expected: FAIL (file not yet created or implementation missing)

**Step 4: Commit**

```bash
git add packages/cloud-server/src/lib/redfin-scraper.ts
git add packages/cloud-server/src/lib/redfin-scraper.test.ts
git commit -m "feat: Add Redfin scraper as fallback to Zillow"
```

---

## Task 2: Implement Cascading Fallback Chain

**Files:**
- Modify: `packages/cloud-server/src/lib/proxy-scraper.ts`
- Modify: `packages/cloud-server/src/lib/zillow.ts`

**Step 1: Add Redfin import and update scrapeZillowData function**

```typescript
// packages/cloud-server/src/lib/zillow.ts
import { scrapeZillowWithProxy } from './proxy-scraper.js';
import { scrapeRedfin } from './redfin-scraper.js';
import type { ZillowPropertyData } from './proxy-scraper.js';

export async function scrapeZillowData(
  address: string,
  zipCode: string
): Promise<Partial<ZillowPropertyData>> {
  const cacheKey = `${address}_${zipCode}`;

  // Check cache first (existing code)
  const cached = zillowCache.get(cacheKey);
  if (cached && Date.now() - cacheTimestamps.get(cacheKey)! < CACHE_TTL) {
    return cached;
  }

  // Try Zillow first
  console.log('[Scrape] Trying Zillow...');
  let propertyData = await scrapeZillowWithProxy(address, zipCode);

  // If Zillow returned minimal data, try Redfin
  if (!propertyData.sqFt || !propertyData.yearBuilt) {
    console.log('[Scrape] Zillow incomplete, trying Redfin...');
    try {
      const redfinData = await scrapeRedfin(address, zipCode);
      // Merge data (Redfin fills in missing fields)
      propertyData = { ...propertyData, ...redfinData };
      console.log('[Scrape] Redfin filled in missing data');
    } catch (error) {
      console.warn('[Scrape] Redfin also failed:', error);
    }
  }

  // If still no data, use fallback defaults
  if (!propertyData.sqFt || !propertyData.yearBuilt) {
    console.warn('[Scrape] Using fallback defaults');
    propertyData = {
      sqFt: propertyData.sqFt || 1200,
      yearBuilt: propertyData.yearBuilt || 1970,
      ...propertyData,
    };
  }

  // Cache the result
  zillowCache.set(cacheKey, propertyData);
  cacheTimestamps.set(cacheKey, Date.now());

  return propertyData;
}
```

**Step 2: Test the fallback chain**

Run: `curl "http://localhost:3333/api/zillow/scrape?address=test&zipCode=90210"`
Expected: Returns data (either from Zillow, Redfin, or defaults)

**Step 3: Commit**

```bash
git add packages/cloud-server/src/lib/zillow.ts
git commit -m "feat: Add Redfin fallback when Zillow fails"
```

---

## Task 3: Add Scraper Health Check Endpoint

**Files:**
- Create: `packages/cloud-server/src/routes/health.ts`
- Modify: `packages/cloud-server/src/routes/index.ts`

**Step 1: Create health check routes**

```typescript
// packages/cloud-server/src/routes/health.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getCacheStats } from '../lib/proxy-scraper.js';

export const healthRoutes = Router();

/**
 * GET /api/health/scraper
 * Returns status of all scrapers
 */
healthRoutes.get('/scraper', asyncHandler(async (req, res) => {
  const status = {
    zillow: {
      configured: !!process.env.SCRAPER_API_KEY,
      status: 'unknown'
    },
    redfin: {
      configured: true, // No API key needed
      status: 'unknown'
    },
    cache: {
      size: getCacheStats().size,
      entries: getCacheStats().entries.length
    },
    timestamp: new Date().toISOString()
  };

  // Quick test each scraper
  try {
    await fetch('https://www.zillow.com');
    status.zillow.status = 'reachable';
  } catch {
    status.zillow.status = 'unreachable';
  }

  try {
    await fetch('https://www.redfin.com');
    status.redfin.status = 'reachable';
  } catch {
    status.redfin.status = 'unreachable';
  }

  res.json({ success: true, data: status });
}));
```

**Step 2: Register health routes**

```typescript
// packages/cloud-server/src/routes/index.ts
import { healthRoutes } from './health.js';

app.use('/api/health', healthRoutes);
```

**Step 3: Test health endpoint**

Run: `curl http://localhost:3333/api/health/scraper`
Expected: JSON with scraper statuses

**Step 4: Commit**

```bash
git add packages/cloud-server/src/routes/health.ts packages/cloud-server/src/routes/index.ts
git commit -m "feat: Add scraper health check endpoint"
```

---

## Task 4: Enhanced Error Messages

**Files:**
- Modify: `packages/cloud-server/src/lib/proxy-scraper.ts`
- Modify: `packages/cloud-server/src/routes/zillow.ts`

**Step 1: Create error classification utility**

```typescript
// packages/cloud-server/src/lib/scrape-errors.ts
export class ScrapingError extends Error {
  constructor(
    public source: string,
    public reason: string,
    public details?: any
  ) {
    super(`${source} scraping failed: ${reason}`);
    this.name = 'ScrapingError';
  }
}

export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ScrapingError) {
    switch (error.reason) {
      case 'NOT_FOUND':
        return `Property not found on ${error.source}. The address may be incorrect.`;
      case 'RATE_LIMITED':
        return `${error.source} is rate limiting us. Please try again later.`;
      case 'BLOCKED':
        return `${error.source} blocked our request. Using fallback data source.`;
      default:
        return `Could not retrieve data from ${error.source}.`;
    }
  }
  return 'An unexpected error occurred.';
}
```

**Step 2: Update scrape endpoint with better errors**

```typescript
// packages/cloud-server/src/routes/zillow.ts
import { ScrapingError, getUserFriendlyMessage } from '../lib/scrape-errors.js';

zillowRoutes.get('/scrape', asyncHandler(async (req, res) => {
  try {
    const propertyData = await scrapeZillowData(address, zipCode);
    res.json({ success: true, data: propertyData });
  } catch (error) {
    res.json({
      success: false,
      error: getUserFriendlyMessage(error),
      data: { sqFt: 1200, yearBuilt: 1970 } // Fallback
    });
  }
}));
```

**Step 3: Test error handling**

Run: `curl "http://localhost:3333/api/zillow/scrape?address=invalid&zipCode=00000"`
Expected: User-friendly error message with fallback data

**Step 4: Commit**

```bash
git add packages/cloud-server/src/lib/scrape-errors.ts packages/cloud-server/src/routes/zillow.ts
git commit -m "feat: Add user-friendly error messages"
```

---

## Task 5: Add Mobile QR Scanner UX Improvements

**Files:**
- Modify: `packages/mobile-web/src/components/QRScanner.tsx`
- Modify: `packages/mobile-web/src/App.tsx`

**Step 1: Add visual feedback and loading state**

```typescript
// packages/mobile-web/src/components/QRScanner.tsx
import React, { useState } from 'react';
import BarcodeScanner from 'react-qr-barcode-scanner';

interface QRScannerProps {
  onScan: (propertyId: string) => void;
  onError?: (error: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lastScanned, setLastScanned] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleUpdate = (error: unknown, result?) => {
    if (error) {
      onError?.(String(error));
      return;
    }

    if (result) {
      const data = result.getText();

      // Debounce: don't scan same QR twice
      if (data === lastScanned) return;
      setLastScanned(data);

      try {
        const url = new URL(data);
        const propertyId = url.searchParams.get('propertyId');
        if (propertyId) {
          // Show success feedback
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);

          onScan(propertyId);
        }
      } catch (e) {
        onError?.('Invalid QR code format');
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <BarcodeScanner
        onUpdate={handleUpdate}
        width="100%"
        height="100%"
        facingMode={facingMode}
      />

      {/* Success feedback overlay */}
      {showSuccess && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(76, 175, 80, 0.9)',
          color: 'white',
          padding: '20px 40px',
          borderRadius: '10px',
          fontSize: '18px',
          fontWeight: 'bold',
          zIndex: 100,
        }}>
          ✓ QR Code Scanned!
        </div>
      )}

      {/* Camera flip button */}
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
          zIndex: 10,
        }}
      >
        📷 Flip Camera
      </button>
    </div>
  );
};
```

**Step 2: Add loading state to App.tsx**

```typescript
// packages/mobile-web/src/App.tsx
const [isLoadingProperty, setIsLoadingProperty] = useState(false);

const handleScan = async (propertyId: string) => {
  setIsLoadingProperty(true);
  try {
    const response = await fetch(`${API_BASE}/api/properties/${propertyId}`);
    const data = await response.json();
    setProperty(data);
    setShowScanner(false);
  } catch (error) {
    setScanError('Failed to load property');
  } finally {
    setIsLoadingProperty(false);
  }
};

// Add loading overlay in JSX
{isLoadingProperty && (
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }}>
    <div style={{ color: 'white', fontSize: '18px' }}>Loading property...</div>
  </div>
)}
```

**Step 3: Test UX improvements**

Run: `cd packages/mobile-web && npm run dev`
Expected: Visual feedback when QR scanned, loading spinner shown

**Step 4: Commit**

```bash
git add packages/mobile-web/src/components/QRScanner.tsx packages/mobile-web/src/App.tsx
git commit -m "feat: Add QR scanner visual feedback and loading states"
```

---

## Task 6: Add Vitest Configuration and Tests

**Files:**
- Create: `packages/cloud-server/vitest.config.ts`
- Create: `packages/cloud-server/src/lib/__tests__/retry.test.ts`
- Modify: `packages/cloud-server/package.json`

**Step 1: Create Vitest config**

```typescript
// packages/cloud-server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

**Step 2: Add test script to package.json**

```json
// packages/cloud-server/package.json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  }
}
```

**Step 3: Write retry logic tests**

```typescript
// packages/cloud-server/src/lib/__tests__/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from '../retry.js';

describe('retryWithBackoff', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      retryWithBackoff(fn, { maxAttempts: 2, initialDelayMs: 10 })
    ).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

**Step 4: Run tests**

Run: `cd packages/cloud-server && npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/cloud-server/vitest.config.ts packages/cloud-server/package.json
git add packages/cloud-server/src/lib/__tests__/retry.test.ts
git commit -m "test: Add Vitest configuration and retry logic tests"
```

---

## Task 7: Verify Deployed Cache Endpoints

**Files:**
- None (verification only)

**Step 1: Check if cache endpoints are live**

Run: `curl https://sce2-cloud-server.onrender.com/api/zillow/cache/stats`
Expected: JSON with cache data (not 404)

If 404: Check Render logs for deployment status

**Step 2: Verify CORS is working**

Run:
```bash
curl -H "Origin: https://sce2-webap.onrender.com" \
  -I https://sce2-cloud-server.onrender.com/api/zillow/cache/stats
```
Expected: `access-control-allow-origin: https://sce2-webap.onrender.com`

**Step 3: Test Zillow scrape with fallback**

Run: `curl "https://sce2-cloud-server.onrender.com/api/zillow/scrape?address=123%20Main%20St&zipCode=90210"`
Expected: Returns data (from Zillow, Redfin, or defaults)

**Step 4: Document results**

Create note in `docs/DEPLOYMENT_STATUS.md` with current state

---

## Task 8: Update README Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Add new features section to README**

```markdown
## New Features (February 2026)

### Redfin Fallback Scraper
When Zillow fails, the system automatically falls back to Redfin for property data.

### Cache Management
- **View cache:** `GET /api/zillow/cache/stats`
- **Clear cache:** `DELETE /api/zillow/cache`

### Scraper Health
- **Check status:** `GET /api/health/scraper`

### Mobile QR Scanner
Scan property QR codes to quickly access property details in the field.
```

**Step 2: Update CLAUDE.md with fallback pattern**

```markdown
## Scraping Fallback Chain

1. **Zillow (with ScraperAPI proxy)** - Primary data source
2. **Redfin** - Fallback when Zillow fails
3. **Config values** - User-provided defaults
4. **Hardcoded defaults** - 1200 sqFt, 1970 yearBuilt
```

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: Document new features and fallback chain"
```

---

## Summary

This plan implements:
1. **Redfin scraper** as fallback to Zillow
2. **Cascading fallback chain** for reliability
3. **Health check endpoint** for monitoring
4. **Enhanced error messages** for better UX
5. **QR scanner improvements** with visual feedback
6. **Test coverage** with Vitest
7. **Documentation updates**

All commits should be pushed individually for easy rollback if needed.
