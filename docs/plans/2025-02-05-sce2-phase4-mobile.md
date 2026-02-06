# Phase 4: Mobile Web Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build mobile-optimized web interface for field data collection, photo capture, and signature input, served by cloud server at `/mobile/:propertyId`.

**Architecture:** Single-page React application with TypeScript, mobile-first responsive design, served statically by cloud server. Uses device camera API for photos, HTML5 canvas for signature capture, and fetch API for data submission.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind CSS 3, HTML5 Camera API, Canvas API

---

## Prerequisites

**Before starting Phase 4, ensure:**
- ✅ Phase 1 (Cloud Server) complete with mobile route endpoint
- ✅ Phase 3 (Webapp) complete with PDF QR codes
- ✅ Node modules installed: `cd packages/mobile-web && npm install`
- ✅ Cloud server running on http://localhost:3333
- ✅ Test property exists in database with `READY_FOR_FIELD` status

**Test Cloud Server Mobile Route:**
```bash
# Will add endpoint: GET /api/properties/:id/mobile-data
# Returns property details for mobile interface
```

---

## Task 1: Mobile Webapp Project Configuration

**Files:**
- Create: `packages/mobile-web/vite.config.ts`
- Create: `packages/mobile-web/tsconfig.json`
- Create: `packages/mobile-web/tsconfig.node.json`
- Create: `packages/mobile-web/tailwind.config.js`
- Create: `packages/mobile-web/postcss.config.js`
- Create: `packages/mobile-web/index.html`

**Step 1: Create Vite configuration**

Create `packages/mobile-web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});
```

**Step 2: Create TypeScript configuration**

Create `packages/mobile-web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: Create tsconfig.node.json**

Create `packages/mobile-web/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Create Tailwind configuration**

Create `packages/mobile-web/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 5: Create PostCSS configuration**

Create `packages/mobile-web/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 6: Create index.html**

Create `packages/mobile-web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <title>SCE2 Mobile</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 7: Verify configuration**

Run: `cd packages/mobile-web && npm run dev`
Expected: Vite server starts on port 5174 (will error on missing src files - that's expected)

**Step 8: Commit**

```bash
git add packages/mobile-web/vite.config.ts packages/mobile-web/tsconfig*.json packages/mobile-web/tailwind.config.js packages/mobile-web/postcss.config.js packages/mobile-web/index.html
git commit -m "feat(mobile-web): add project configuration (Vite, TypeScript, Tailwind)

- Add Vite config with React plugin and dev server on :5174
- Configure TypeScript with strict mode and path aliases
- Set up Tailwind CSS for mobile-first styling
- Configure PostCSS with Tailwind and Autoprefixer
- Create index.html with mobile viewport meta tags
- Add tsconfig.node.json for build tooling

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Mobile App Structure and Types

**Files:**
- Create: `packages/mobile-web/src/main.tsx`
- Create: `packages/mobile-web/src/index.css`
- Create: `packages/mobile-web/src/types.ts`
- Create: `packages/mobile-web/src/App.tsx`

**Step 1: Create main entry point**

Create `packages/mobile-web/src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 2: Create global CSS**

Create `packages/mobile-web/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  -webkit-tap-highlight-color: transparent;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  touch-action: manipulation;
}

input,
textarea,
button {
  font-size: 16px; /* Prevents iOS zoom on focus */
}
```

**Step 3: Create TypeScript types**

Create `packages/mobile-web/src/types.ts`:

```typescript
export interface MobilePropertyData {
  id: number;
  addressFull: string;
  customerName?: string;
  customerPhone?: string;
  customerAge?: number;
  fieldNotes?: string;
  status: string;
}

export interface FieldDataSubmission {
  age?: number;
  notes?: string;
  customerSignature?: string; // Base64 data URL
}

export interface DocumentUpload {
  docType: 'bill' | 'unit' | 'signature' | 'other';
  fileName: string;
  fileData: string; // Base64 data URL
  mimeType: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
```

**Step 4: Create App component**

Create `packages/mobile-web/src/App.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { MobilePropertyData } from './types';

function App() {
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Extract property ID from URL path
    // URL format: /mobile/:id
    const pathParts = window.location.pathname.split('/');
    const idFromPath = pathParts[pathParts.length - 1];

    if (idFromPath && idFromPath !== 'mobile') {
      const id = parseInt(idFromPath);
      if (!isNaN(id)) {
        setPropertyId(id);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!propertyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600">No property ID found in URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold">SCE2 Field Entry</h1>
        <p className="text-blue-100 text-sm">Property ID: {propertyId}</p>
      </div>
      <div className="p-4">
        <p className="text-gray-600 text-center py-12">
          Property data loading...
        </p>
      </div>
    </div>
  );
}

export default App;
```

**Step 5: Test app structure**

Run: `cd packages/mobile-web && npm run dev`
Expected: App loads, shows "Property data loading..." message

**Step 6: Commit**

```bash
git add packages/mobile-web/src/
git commit -m "feat(mobile-web): add application structure and type definitions

- Create React entry point with StrictMode
- Add mobile-optimized global styles (touch-action, tap highlight)
- Define TypeScript interfaces for mobile data
- Create App component with URL parsing for property ID
- Add loading and error states

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Cloud Server API Integration

**Files:**
- Add: `packages/cloud-server/src/routes/properties.ts` (mobile-data endpoint)
- Create: `packages/mobile-web/src/lib/api.ts`

**Step 1: Add mobile data endpoint to cloud server**

Edit `packages/cloud-server/src/routes/properties.ts` (add after GET /:id endpoint):

```typescript
// GET /api/properties/:id/mobile-data
propertyRoutes.get(
  '/:id/mobile-data',
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { documents: true },
    });

    if (!property) {
      throw new NotFoundError('Property', req.params.id);
    }

    // Return minimal data needed for mobile interface
    res.json({
      success: true,
      data: {
        id: property.id,
        addressFull: property.addressFull,
        customerName: property.customerName,
        customerPhone: property.customerPhone,
        customerAge: property.customerAge,
        fieldNotes: property.fieldNotes,
        status: property.status,
      },
    });
  })
);
```

**Step 2: Create mobile API client**

Create `packages/mobile-web/src/lib/api.ts`:

```typescript
import { MobilePropertyData, FieldDataSubmission, ApiResponse } from '../types';

const API_BASE = '/api';

class MobileAPI {
  async fetchPropertyData(id: number): Promise<MobilePropertyData> {
    const response = await fetch(`${API_BASE}/properties/${id}/mobile-data`);
    const result: ApiResponse<MobilePropertyData> = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch property data');
    }

    return result.data;
  }

  async submitFieldData(id: number, data: FieldDataSubmission): Promise<void> {
    const response = await fetch(`${API_BASE}/properties/${id}/field-data`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result: ApiResponse<{ id: number }> = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to submit field data');
    }
  }

  async uploadDocument(
    propertyId: number,
    docType: string,
    fileData: string,
    fileName: string,
    mimeType: string
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/properties/${propertyId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docType,
        fileData,
        fileName,
        mimeType,
      }),
    });

    const result: ApiResponse<{ id: number }> = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to upload document');
    }
  }
}

export const api = new MobileAPI();
```

**Step 3: Test API integration**

Start cloud server: `cd packages/cloud-server && npm run dev`
Test endpoint: `curl http://localhost:3333/api/properties/1/mobile-data`

**Step 4: Commit**

```bash
git add packages/cloud-server/src/routes/properties.ts packages/mobile-web/src/lib/api.ts
git commit -m "feat(mobile-web): add cloud server API integration

- Add GET /api/properties/:id/mobile-data endpoint
- Create mobile API client with fetch methods
- Implement fetchPropertyData() for loading property
- Implement submitFieldData() for saving field data
- Implement uploadDocument() for photo uploads

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Property Info Display Component

**Files:**
- Create: `packages/mobile-web/src/components/PropertyInfo.tsx`
- Modify: `packages/mobile-web/src/App.tsx`

**Step 1: Create property info component**

Create `packages/mobile-web/src/components/PropertyInfo.tsx`:

```typescript
import { MobilePropertyData } from '../types';

interface PropertyInfoProps {
  property: MobilePropertyData;
}

export function PropertyInfo({ property }: PropertyInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-xl font-bold text-gray-900 mb-3">{property.addressFull}</h2>

      {(property.customerName || property.customerPhone) && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3">
          <p className="text-sm text-gray-600 mb-1">Customer Information</p>
          {property.customerName && (
            <p className="text-base font-semibold text-gray-900">
              {property.customerName}
            </p>
          )}
          {property.customerPhone && (
            <p className="text-base text-gray-700">
              📞 {property.customerPhone}
            </p>
          )}
        </div>
      )}

      {property.fieldNotes && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 mb-3">
          <p className="text-sm font-medium text-gray-600 mb-1">Field Notes:</p>
          <p className="text-base text-gray-800">{property.fieldNotes}</p>
        </div>
      )}

      <div className="text-sm text-gray-500">
        Status: <span className="font-medium">{property.status}</span>
      </div>
    </div>
  );
}
```

**Step 2: Update App to use PropertyInfo**

Edit `packages/mobile-web/src/App.tsx` (replace placeholder content):

```typescript
import { useState, useEffect } from 'react';
import { PropertyLoader } from './components/PropertyLoader';
```

Add PropertyLoader component first in Task 5, then update App.

**Step 3: Commit**

```bash
git add packages/mobile-web/src/components/PropertyInfo.tsx
git commit -m "feat(mobile-web): add property info display component

- Create PropertyInfo component showing address, customer data, and notes
- Display customer name and phone in blue info card
- Show field notes in yellow warning card
- Add mobile-optimized spacing and typography

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Data Fetching and Loading State

**Files:**
- Create: `packages/mobile-web/src/components/PropertyLoader.tsx`
- Modify: `packages/mobile-web/src/App.tsx`

**Step 1: Create property loader component**

Create `packages/mobile-web/src/components/PropertyLoader.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { MobilePropertyData } from '../types';
import { api } from '../lib/api';
import { PropertyInfo } from './PropertyInfo';

interface PropertyLoaderProps {
  propertyId: number;
  onDataLoaded?: (data: MobilePropertyData) => void;
}

export function PropertyLoader({ propertyId, onDataLoaded }: PropertyLoaderProps) {
  const [property, setProperty] = useState<MobilePropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const data = await api.fetchPropertyData(propertyId);
        setProperty(data);
        onDataLoaded?.(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load property';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [propertyId, onDataLoaded]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
        <h3 className="text-red-800 font-semibold mb-1">Error Loading Property</h3>
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
        <p className="text-yellow-800">Property not found</p>
      </div>
    );
  }

  return <PropertyInfo property={property} />;
}
```

**Step 2: Update App to use PropertyLoader**

Edit `packages/mobile-web/src/App.tsx`:

```typescript
import { useState } from 'react';
import { PropertyLoader } from './components/PropertyLoader';
import { FieldDataForm } from './components/FieldDataForm'; // Create in next task

function App() {
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [propertyData, setPropertyData] = useState<any>(null);

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const idFromPath = pathParts[pathParts.length - 1];

    if (idFromPath && idFromPath !== 'mobile') {
      const id = parseInt(idFromPath);
      if (!isNaN(id)) {
        setPropertyId(id);
      }
    }
  }, []);

  if (!propertyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600">No property ID found in URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-10">
        <h1 className="text-xl font-bold">SCE2 Field Entry</h1>
        <p className="text-blue-100 text-sm">Property: {propertyId}</p>
      </header>

      <PropertyLoader
        propertyId={propertyId}
        onDataLoaded={setPropertyData}
      />

      {propertyData && (
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Field Data</h2>
          <FieldDataForm propertyId={propertyId} />
        </div>
      )}
    </div>
  );
}

export default App;
```

**Step 3: Commit**

```bash
git add packages/mobile-web/src/components/PropertyLoader.tsx packages/mobile-web/src/App.tsx
git commit -m "feat(mobile-web): add data fetching with loading and error states

- Create PropertyLoader component with data fetching
- Implement loading spinner with smooth animation
- Add error display with retry button
- Update App to load property data on mount
- Pass property data to form component

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Field Data Form Component

**Files:**
- Create: `packages/mobile-web/src/components/FieldDataForm.tsx`

**Step 1: Create field data form**

Create `packages/mobile-web/src/components/FieldDataForm.tsx`:

```typescript
import { useState } from 'react';

interface FieldDataFormProps {
  propertyId: number;
}

export function FieldDataForm({ propertyId }: FieldDataFormProps) {
  const [age, setAge] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/properties/${propertyId}/field-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: age ? parseInt(age) : undefined,
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Field data saved successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save data' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Age
        </label>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="e.g. 45"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          inputMode="numeric"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Gate code, dog, special instructions, etc."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Saving...' : 'Save Field Data'}
      </button>
    </form>
  );
}
```

**Step 2: Test form**

Run: `npm run dev`
Expected: Form renders, age input shows numeric keyboard on mobile

**Step 3: Commit**

```bash
git add packages/mobile-web/src/components/FieldDataForm.tsx
git commit -m "feat(mobile-web): add field data form component

- Create FieldDataForm with age and notes inputs
- Add numeric keyboard mode for age input
- Implement form submission to API
- Add loading and success/error states
- Mobile-optimized spacing and touch targets

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Photo Capture Component

**Files:**
- Create: `packages/mobile-web/src/components/PhotoCapture.tsx`
- Modify: `packages/mobile-web/src/components/FieldDataForm.tsx`

**Step 1: Create photo capture component**

Create `packages/mobile-web/src/components/PhotoCapture.tsx`:

```typescript
import { useState, useRef } from 'react';

interface PhotoCaptureProps {
  propertyId: number;
  docType: 'bill' | 'unit' | 'other';
  label: string;
}

export function PhotoCapture({ propertyId, docType, label }: PhotoCaptureProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;

        // Upload to server
        const response = await fetch(`/api/properties/${propertyId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            docType,
            fileName: file.name,
            fileData: base64,
            mimeType: file.type,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setPhoto(base64);
        } else {
          alert('Failed to upload photo');
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      alert('Error processing photo');
    } finally {
      setUploading(false);
    }
  };

  const handleRetake = () => {
    setPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{label}</h3>

      {photo ? (
        <div className="space-y-3">
          <img
            src={photo}
            alt={label}
            className="w-full h-48 object-cover rounded-lg"
          />
          <button
            onClick={handleRetake}
            className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Retake Photo
          </button>
        </div>
      ) : (
        <label className="block">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="hidden"
          />
          <div
            className={`${
              uploading
                ? 'bg-gray-400 cursor-wait'
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            } text-white rounded-lg p-4 text-center transition-colors`}
          >
            <div className="text-4xl mb-2">📸</div>
            <div className="font-medium">
              {uploading ? 'Uploading...' : `Capture ${label}`}
            </div>
          </div>
        </label>
      )}
    </div>
  );
}
```

**Step 2: Update FieldDataForm to include photo capture**

Edit `packages/mobile-web/src/components/FieldDataForm.tsx` (add after form):

```typescript
import { PhotoCapture } from './PhotoCapture';

// Add before closing form tag:
<div className="space-y-4">
  <PhotoCapture propertyId={propertyId} docType="bill" label="Bill Photo" />
  <PhotoCapture propertyId={propertyId} docType="unit" label="Unit Photo" />
</div>
```

**Step 3: Test photo capture**

Run: `npm run dev`
Expected: Camera opens on mobile when tapping capture button

**Step 4: Commit**

```bash
git add packages/mobile-web/src/components/PhotoCapture.tsx packages/mobile-web/src/components/FieldDataForm.tsx
git commit -m "feat(mobile-web): add photo capture component

- Create PhotoCapture component with camera access
- Use capture='environment' for rear camera on mobile
- Convert photos to base64 for upload
- Display uploaded photos with retake option
- Add loading state during upload
- Integrate into FieldDataForm component

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Signature Pad Component

**Files:**
- Create: `packages/mobile-web/src/components/SignaturePad.tsx`
- Modify: `packages/mobile-web/src/components/FieldDataForm.tsx`

**Step 1: Create signature pad component**

Create `packages/mobile-web/src/components/SignaturePad.tsx`:

```typescript
import { useRef, useEffect, useState } from 'react';

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void;
}

export function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;

    // Set default styles
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL('image/png');
    onSignatureChange(dataURL);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Signature</h3>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="border-2 border-gray-300 rounded-lg w-full bg-white"
        style={{ touchAction: 'none' }}
      />

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={clearSignature}
          className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={saveSignature}
          disabled={!hasSignature}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save Signature
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Update FieldDataForm to include signature**

Edit `packages/mobile-web/src/components/FieldDataForm.tsx`:

```typescript
import { useState } from 'react';
import { SignaturePad } from './SignaturePad';

interface FieldDataFormProps {
  propertyId: number;
}

export function FieldDataForm({ propertyId }: FieldDataFormProps) {
  const [age, setAge] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/properties/${propertyId}/field-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: age ? parseInt(age) : undefined,
          notes: notes || undefined,
          customerSignature: signature || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Field data saved successfully!' });
        // Optionally: clear form or redirect
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save data' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Age and notes inputs here... */}

      <SignaturePad onSignatureChange={setSignature} />

      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Saving...' : 'Save & Complete'}
      </button>
    </form>
  );
}
```

**Step 3: Test signature pad**

Run: `npm run dev`
Expected: Can draw signature with mouse or touch, clear and save buttons work

**Step 4: Commit**

```bash
git add packages/mobile-web/src/components/SignaturePad.tsx packages/mobile-web/src/components/FieldDataForm.tsx
git commit -m "feat(mobile-web): add signature pad component

- Create SignaturePad component with canvas drawing
- Support both mouse and touch input for signing
- Implement clear and save signature buttons
- Convert canvas to base64 PNG for storage
- Integrate into FieldDataForm with state management
- Add touch-action: none to prevent scrolling while drawing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Cloud Server Document Upload Endpoint

**Files:**
- Add: `packages/cloud-server/src/routes/documents.ts` (upload endpoint)
- Modify: `packages/cloud-server/prisma/schema.prisma` (if needed)

**Step 1: Add document upload endpoint**

Add to `packages/cloud-server/src/routes/documents.ts` (or create):

```typescript
import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

export const documentUploadRoutes = Router();

// POST /api/properties/:propertyId/documents
documentUploadRoutes.post(
  '/:propertyId',
  asyncHandler(async (req, res) => {
    const { propertyId } = req.params;
    const { docType, fileName, fileData, mimeType } = req.body;

    if (!docType || !fileName || !fileData) {
      throw new ValidationError('Missing required fields: docType, fileName, fileData');
    }

    const validDocTypes = ['bill', 'unit', 'signature', 'other'];
    if (!validDocTypes.includes(docType)) {
      throw new ValidationError(`Invalid docType. Must be one of: ${validDocTypes.join(', ')}`);
    }

    // In production, you'd save the file and store the path
    // For now, we'll store the base64 data directly
    const document = await prisma.document.create({
      data: {
        propertyId: parseInt(propertyId),
        docType,
        fileName,
        filePath: fileData, // Storing base64 for now
        fileSize: fileData.length, // Approximate size
        mimeType: mimeType || 'image/jpeg',
      },
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  })
);
```

**Step 2: Register document upload routes**

Edit `packages/cloud-server/src/routes/index.ts`:

```typescript
import { documentUploadRoutes } from './documents.js';

// Add:
apiRouter.use('/properties/:propertyId/documents', documentUploadRoutes);
```

**Step 3: Test endpoint**

```bash
curl -X POST http://localhost:3333/api/properties/1/documents \
  -H "Content-Type: application/json" \
  -d '{"docType":"bill","fileName":"test.jpg","fileData":"data:image/jpeg;base64,...","mimeType":"image/jpeg"}'
```

**Step 4: Commit**

```bash
git add packages/cloud-server/src/routes/documents.ts packages/cloud-server/src/routes/index.ts
git commit -m "feat(cloud-server): add document upload endpoint for mobile

- Add POST /api/properties/:propertyId/documents endpoint
- Accept base64 file data, docType, fileName, mimeType
- Validate docType against allowed values
- Store documents in database with file metadata
- Register document upload routes in API router

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Build Verification and Documentation

**Files:**
- Create: `packages/mobile-web/README.md`

**Step 1: Verify production build**

Run: `cd packages/mobile-web && npm run build`
Expected: Clean build, dist/ directory created

**Step 2: Test preview**

Run: `npm run preview`
Expected: Preview server starts on http://localhost:4174

**Step 3: Create README**

Create `packages/mobile-web/README.md`:

```markdown
# SCE2 Mobile Web

Mobile-optimized web interface for field data collection, photo capture, and signature input.

## Development

### Prerequisites

- Node.js 18+
- Cloud server running on http://localhost:3333
- Property with READY_FOR_FIELD status in database

### Installation

\`\`\`bash
npm install
\`\`\`

### Development Server

\`\`\`bash
npm run dev
\`\`\`

Opens on http://localhost:5174

### Build for Production

\`\`\`bash
npm run build
\`\`\`

Output directory: `dist/`

### Preview Production Build

\`\`\`bash
npm run preview
\`\`\`

## Features

- ✅ Mobile-optimized responsive design
- ✅ Property information display
- ✅ Field data form (age, notes)
- ✅ Photo capture (bill, unit)
- ✅ Signature pad with canvas
- ✅ Real-time data submission
- ✅ Loading and error states

## Usage

1. Start cloud server: \`cd packages/cloud-server && npm run dev\`
2. Build mobile web: \`cd packages/mobile-web && npm run build\`
3. Copy dist/ to cloud server public directory (or serve separately)
4. Access mobile interface: `http://your-server/mobile/:propertyId`
5. Or scan QR code from generated PDF

## Architecture

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Mobile-first styling
- **HTML5 Canvas** - Signature capture
- **Camera API** - Photo capture

## Environment Variables

No environment variables required - uses relative API paths.

## Mobile Considerations

- Touch-optimized interface (minimum 16px font)
- Numeric keyboard for age input
- Rear camera preference for photos
- Prevents zoom on input focus
- Smooth touch interactions (no tap highlight)
- Proper viewport configuration
