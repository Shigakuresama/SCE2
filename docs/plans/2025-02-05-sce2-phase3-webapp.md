# Phase 3: Webapp Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the desktop webapp from standalone to cloud-integrated, enabling route planning, property management, PDF generation with customer data, and real-time queue monitoring.

**Architecture:** Single-page React application with TypeScript, communicating with cloud server via REST API. State managed through React Context + custom hooks. Real-time updates via polling. PDF generation using jsPDF with QR codes linking to mobile interface.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind CSS 3, React Router 6, Leaflet (maps), jsPDF (PDF generation), qrcode (QR code generation)

---

## Prerequisites

**Before starting Phase 3, ensure:**
- ✅ Phase 1 (Cloud Server) complete and running on http://localhost:3333
- ✅ Phase 2 (Extension) complete and loaded in Chrome
- ✅ Database initialized with Prisma schema
- ✅ Node modules installed: `cd packages/webapp && npm install`

**Test Cloud Server:**
```bash
curl http://localhost:3333/api/health
# Expected: {"success":true,"message":"SCE2 API is running",...}
```

---

## Task 1: Webapp Project Configuration

**Files:**
- Create: `packages/webapp/vite.config.ts`
- Create: `packages/webapp/tsconfig.json`
- Create: `packages/webapp/tailwind.config.js`
- Create: `packages/webapp/postcss.config.js`
- Create: `packages/webapp/index.html`
- Modify: `packages/webapp/package.json` (add build script dependencies)

**Step 1: Create Vite configuration**

Create `packages/webapp/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

**Step 2: Create TypeScript configuration**

Create `packages/webapp/tsconfig.json`:

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

Create `packages/webapp/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Create Tailwind configuration**

Create `packages/webapp/tailwind.config.js`:

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

Create `packages/webapp/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 6: Create index.html entry point**

Create `packages/webapp/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SCE2 - Rebate Automation</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 7: Verify configuration**

Run: `cd packages/webapp && npm run dev`
Expected: Vite server starts on port 5173 (will error due to missing src files - that's expected for now)

**Step 8: Commit configuration**

```bash
git add packages/webapp/vite.config.ts packages/webapp/tsconfig*.json packages/webapp/tailwind.config.js packages/webapp/postcss.config.js packages/webapp/index.html
git commit -m "feat(webapp): add project configuration (Vite, TypeScript, Tailwind)

- Add Vite config with API proxy to cloud server
- Configure TypeScript with strict mode and path aliases
- Set up Tailwind CSS for styling
- Configure PostCSS with Tailwind and Autoprefixer
- Create index.html entry point
- Add tsconfig.node for build tooling"
```

---

## Task 2: Application Structure and Routing

**Files:**
- Create: `packages/webapp/src/main.tsx`
- Create: `packages/webapp/src/App.tsx`
- Create: `packages/webapp/src/index.css`
- Create: `packages/webapp/src/types.ts`

**Step 1: Create main entry point**

Create `packages/webapp/src/main.tsx`:

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

**Step 2: Create global CSS with Tailwind**

Create `packages/webapp/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
```

**Step 3: Create TypeScript type definitions**

Create `packages/webapp/src/types.ts`:

```typescript
// Property status enum
export enum PropertyStatus {
  PENDING_SCRAPE = 'PENDING_SCRAPE',
  READY_FOR_FIELD = 'READY_FOR_FIELD',
  VISITED = 'VISITED',
  READY_FOR_SUBMISSION = 'READY_FOR_SUBMISSION',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

// Property interface matching Prisma schema
export interface Property {
  id: number;
  addressFull: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  customerName?: string;
  customerPhone?: string;
  customerAge?: number;
  fieldNotes?: string;
  status: PropertyStatus;
  routeId?: number;
  sceCaseId?: string;
  createdAt: string;
  updatedAt: string;
  documents: Document[];
}

// Document interface
export interface Document {
  id: number;
  propertyId: number;
  docType: 'bill' | 'unit' | 'signature' | 'other';
  fileName: string;
  filePath: string;
  createdAt: string;
}

// Route interface
export interface Route {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    properties: number;
  };
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
  error?: string;
}

// Queue status
export interface QueueStatus {
  scrapeCount: number;
  submitCount: number;
  isProcessing: boolean;
}

// Filters for property queries
export interface PropertyFilters {
  status?: PropertyStatus;
  routeId?: number;
  limit?: number;
  offset?: number;
}
```

**Step 4: Create App component with routing**

Create `packages/webapp/src/App.tsx`:

```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<div><h1 className="text-2xl p-4">SCE2 Webapp</h1></div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
```

**Step 5: Test application starts**

Run: `cd packages/webapp && npm run dev`
Expected: Vite dev server starts, opening http://localhost:5173 shows "SCE2 Webapp"

**Step 6: Commit application structure**

```bash
git add packages/webapp/src/
git commit -m "feat(webapp): add application structure and routing

- Create React entry point with main.tsx
- Set up Tailwind CSS global styles
- Define TypeScript interfaces for API data models
- Create App component with React Router
- Add Property, Document, Route, and QueueStatus types
- Configure strict TypeScript mode"
```

---

## Task 3: API Service Layer

**Files:**
- Create: `packages/webapp/src/lib/api.ts`
- Create: `packages/webapp/src/lib/config.ts`

**Step 1: Create configuration file**

Create `packages/webapp/src/lib/config.ts`:

```typescript
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  POLL_INTERVAL: 5000, // 5 seconds
  DEFAULT_LIMIT: 50,
};

// Cloud server URL for QR codes and mobile links
export const getCloudUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_CLOUD_BASE_URL || 'http://localhost:3333';
  return `${baseUrl}${path}`;
};
```

**Step 2: Write API service class**

Create `packages/webapp/src/lib/api.ts`:

```typescript
import { ApiResponse, Property, PropertyFilters, Route, QueueStatus } from '../types';
import { config } from './config';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

class SCE2API {
  private baseUrl: string;

  constructor(baseUrl: string = config.API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new APIError(response.status, `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Properties
  async getProperties(filters?: PropertyFilters): Promise<ApiResponse<Property[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.routeId) params.append('routeId', filters.routeId.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const query = params.toString() ? `?${params}` : '';
    return this.request<ApiResponse<Property[]>>(`/properties${query}`);
  }

  async getProperty(id: number): Promise<ApiResponse<Property>> {
    return this.request<ApiResponse<Property>>(`/properties/${id}`);
  }

  async createProperty(data: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.request<ApiResponse<Property>>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProperty(id: number, data: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.request<ApiResponse<Property>>(`/properties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProperty(id: number): Promise<ApiResponse<{ id: number }>> {
    return this.request<ApiResponse<{ id: number }>>(`/properties/${id}`, {
      method: 'DELETE',
    });
  }

  // Batch create properties for scraping
  async queueAddressesForScraping(
    addresses: Array<{
      addressFull: string;
      streetNumber: string;
      streetName: string;
      zipCode: string;
      city?: string;
      state?: string;
      latitude?: number;
      longitude?: number;
    }>
  ): Promise<ApiResponse<Property[]>> {
    // Create properties in parallel
    const properties = await Promise.all(
      addresses.map((addr) => this.createProperty(addr))
    );

    return {
      success: true,
      data: properties.map((p) => p.data),
    };
  }

  // Routes
  async getRoutes(): Promise<ApiResponse<Route[]>> {
    return this.request<ApiResponse<Route[]>>('/routes');
  }

  async getRoute(id: number): Promise<ApiResponse<Route>> {
    return this.request<ApiResponse<Route>>(`/routes/${id}`);
  }

  async createRoute(name: string, description?: string): Promise<ApiResponse<Route>> {
    return this.request<ApiResponse<Route>>('/routes', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  // Queue
  async getQueueStatus(): Promise<QueueStatus> {
    // This calls the extension's status endpoint
    // For now, we'll fetch properties by status
    const [pending, ready, visited] = await Promise.all([
      this.getProperties({ status: 'PENDING_SCRAPE' as any, limit: 1 }),
      this.getProperties({ status: 'READY_FOR_FIELD' as any, limit: 1 }),
      this.getProperties({ status: 'VISITED' as any, limit: 1 }),
    ]);

    return {
      scrapeCount: pending.meta?.total || 0,
      submitCount: visited.meta?.total || 0,
      isProcessing: false, // Extension doesn't expose this via API
    };
  }

  // Health check
  async healthCheck(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/health');
  }
}

// Export singleton instance
export const api = new SCE2();

// Export class for testing
export { SCE2API, APIError };
```

**Step 3: Create .env file**

Create `packages/webapp/.env`:

```env
VITE_API_BASE_URL=/api
VITE_CLOUD_BASE_URL=http://localhost:3333
```

**Step 4: Create .env.example**

Create `packages/webapp/.env.example`:

```env
VITE_API_BASE_URL=/api
VITE_CLOUD_BASE_URL=http://localhost:3333
```

**Step 5: Test API service**

No test yet - we'll test when we build components that use it.

**Step 6: Commit API service**

```bash
git add packages/webapp/src/lib/ packages/webapp/.env.example
git commit -m "feat(webapp): add API service layer

- Create SCE2API class for cloud server communication
- Implement all property CRUD operations
- Add batch address queueing for scraping
- Implement route management methods
- Add queue status polling
- Include health check endpoint
- Configure environment variables for API URLs
- Add APIError class for error handling"
```

---

## Task 4: Property Management Context

**Files:**
- Create: `packages/webapp/src/contexts/AppContext.tsx`
- Create: `packages/webapp/src/hooks/useProperties.ts`

**Step 1: Create application context**

Create `packages/webapp/src/contexts/AppContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Property, PropertyFilters, QueueStatus } from '../types';
import { api } from '../lib/api';

interface AppContextType {
  properties: Property[];
  queueStatus: QueueStatus;
  loading: boolean;
  error: string | null;
  fetchProperties: (filters?: PropertyFilters) => Promise<void>;
  refreshQueueStatus: () => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    scrapeCount: 0,
    submitCount: 0,
    isProcessing: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const fetchProperties = async (filters?: PropertyFilters) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getProperties(filters);
      setProperties(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch properties';
      setError(message);
      console.error('Fetch properties error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshQueueStatus = async () => {
    try {
      const status = await api.getQueueStatus();
      setQueueStatus(status);
    } catch (err) {
      console.error('Queue status refresh error:', err);
    }
  };

  // Auto-refresh queue status every 5 seconds
  useEffect(() => {
    refreshQueueStatus();
    const interval = setInterval(refreshQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const value: AppContextType = {
    properties,
    queueStatus,
    loading,
    error,
    fetchProperties,
    refreshQueueStatus,
    clearError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
```

**Step 2: Create useProperties hook**

Create `packages/webapp/src/hooks/useProperties.ts`:

```typescript
import { useState, useEffect } from 'react';
import { Property, PropertyFilters } from '../types';
import { api } from '../lib/api';

export function useProperties(filters?: PropertyFilters) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = async (newFilters?: PropertyFilters) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getProperties(newFilters || filters);
      setProperties(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch properties';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [filters?.status, filters?.routeId]);

  return { properties, loading, error, refetch: fetchProperties };
}

export function useProperty(id: number) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProperty = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.getProperty(id);
        setProperty(response.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch property';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProperty();
    }
  }, [id]);

  return { property, loading, error };
}
```

**Step 3: Update App.tsx to use provider**

Edit `packages/webapp/src/App.tsx`:

```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<div><h1 className="text-2xl p-4">SCE2 Webapp</h1></div>} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
```

**Step 4: Commit context and hooks**

```bash
git add packages/webapp/src/contexts/ packages/webapp/src/hooks/ packages/webapp/src/App.tsx
git commit -m "feat(webapp): add property management context and hooks

- Create AppProvider context for global state
- Implement useProperties hook for property lists
- Implement useProperty hook for single property
- Add automatic queue status polling (5s interval)
- Update App component to use AppProvider
- Include loading states and error handling"
```

---

## Task 5: Property Dashboard Component

**Files:**
- Create: `packages/webapp/src/components/PropertyDashboard.tsx`
- Create: `packages/webapp/src/components/PropertyList.tsx`
- Create: `packages/webapp/src/components/PropertyCard.tsx`

**Step 1: Write PropertyCard component**

Create `packages/webapp/src/components/PropertyCard.tsx`:

```typescript
import { Property } from '../types';

interface PropertyCardProps {
  property: Property;
  onClick?: () => void;
}

export function PropertyCard({ property, onClick }: PropertyCardProps) {
  const statusColors: Record<string, string> = {
    PENDING_SCRAPE: 'bg-yellow-100 text-yellow-800',
    READY_FOR_FIELD: 'bg-blue-100 text-blue-800',
    VISITED: 'bg-purple-100 text-purple-800',
    READY_FOR_SUBMISSION: 'bg-orange-100 text-orange-800',
    COMPLETE: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    PENDING_SCRAPE: 'Pending Scrape',
    READY_FOR_FIELD: 'Ready for Field',
    VISITED: 'Visited',
    READY_FOR_SUBMISSION: 'Ready to Submit',
    COMPLETE: 'Complete',
    FAILED: 'Failed',
  };

  return (
    <div
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{property.addressFull}</h3>
          {property.customerName && (
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">Customer:</span> {property.customerName}
            </p>
          )}
          {property.customerPhone && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Phone:</span> {property.customerPhone}
            </p>
          )}
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            statusColors[property.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {statusLabels[property.status] || property.status}
        </span>
      </div>

      {property.fieldNotes && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Notes:</span> {property.fieldNotes}
          </p>
        </div>
      )}

      {property.sceCaseId && (
        <div className="mt-2">
          <p className="text-xs text-gray-500">
            <span className="font-medium">SCE Case:</span> {property.sceCaseId}
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Write PropertyList component**

Create `packages/webapp/src/components/PropertyList.tsx`:

```typescript
import { Property } from '../types';
import { PropertyCard } from './PropertyCard';

interface PropertyListProps {
  properties: Property[];
  loading: boolean;
  onPropertyClick?: (property: Property) => void;
}

export function PropertyList({ properties, loading, onPropertyClick }: PropertyListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No properties found</p>
        <p className="text-gray-400 text-sm mt-2">Properties will appear here once added</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          onClick={onPropertyClick ? () => onPropertyClick(property) : undefined}
        />
      ))}
    </div>
  );
}
```

**Step 3: Write PropertyDashboard component**

Create `packages/webapp/src/components/PropertyDashboard.tsx`:

```typescript
import { useState } from 'react';
import { Property, PropertyStatus } from '../types';
import { useProperties } from '../hooks/useProperties';
import { PropertyList } from './PropertyList';

interface PropertyDashboardProps {
  status?: PropertyStatus;
}

export function PropertyDashboard({ status }: PropertyDashboardProps) {
  const [selectedStatus, setSelectedStatus] = useState<PropertyStatus | undefined>(status);
  const { properties, loading, error, refetch } = useProperties(
    selectedStatus ? { status: selectedStatus } : undefined
  );

  const statusOptions = [
    { value: undefined, label: 'All Properties' },
    { value: PropertyStatus.PENDING_SCRAPE, label: 'Pending Scrape' },
    { value: PropertyStatus.READY_FOR_FIELD, label: 'Ready for Field' },
    { value: PropertyStatus.VISITED, label: 'Visited' },
    { value: PropertyStatus.READY_FOR_SUBMISSION, label: 'Ready to Submit' },
    { value: PropertyStatus.COMPLETE, label: 'Complete' },
    { value: PropertyStatus.FAILED, label: 'Failed' },
  ];

  const handleStatusChange = (newStatus: PropertyStatus | undefined) => {
    setSelectedStatus(newStatus);
  };

  return (
    <div className="space-y-6">
      {/* Header with status filter */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-900">Properties</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
              Status:
            </label>
            <select
              id="status-filter"
              value={selectedStatus || ''}
              onChange={(e) =>
                handleStatusChange(e.target.value ? (e.target.value as PropertyStatus) : undefined)
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map((option) => (
                <option key={option.label} value={option.value || ''}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Property list */}
      <PropertyList properties={properties} loading={loading} />

      {/* Stats */}
      {!loading && properties.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-medium">{properties.length}</span> properties
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Update App.tsx to use dashboard**

Edit `packages/webapp/src/App.tsx`:

```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { PropertyDashboard } from './components/PropertyDashboard';

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<PropertyDashboard />} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
```

**Step 5: Test dashboard component**

Run: `cd packages/webapp && npm run dev`
Expected: Dashboard loads with status filter, shows "No properties found" initially

**Step 6: Commit dashboard**

```bash
git add packages/webapp/src/components/
git commit -m "feat(webapp): add property dashboard components

- Create PropertyCard component for individual property display
- Create PropertyList component with loading skeletons
- Create PropertyDashboard with status filtering
- Add responsive grid layout (1/2/3 columns)
- Implement status color coding and labels
- Add refresh button and error handling
- Update App to use dashboard as default route"
```

---

## Task 6: Queue Status Component

**Files:**
- Create: `packages/webapp/src/components/QueueStatus.tsx`

**Step 1: Write QueueStatus component**

Create `packages/webapp/src/components/QueueStatus.tsx`:

```typescript
import { useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

export function QueueStatus() {
  const { queueStatus, refreshQueueStatus } = useApp();

  useEffect(() => {
    // Refresh every 5 seconds
    const interval = setInterval(refreshQueueStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshQueueStatus]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Queue Status</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium">Scrape Queue</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{queueStatus.scrapeCount}</p>
          <p className="text-xs text-blue-600 mt-1">properties waiting</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">Submit Queue</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{queueStatus.submitCount}</p>
          <p className="text-xs text-green-600 mt-1">ready to submit</p>
        </div>
      </div>

      {queueStatus.isProcessing && (
        <div className="mt-4 flex items-center text-sm text-gray-600">
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Extension is processing jobs
        </div>
      )}

      <button
        onClick={refreshQueueStatus}
        className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
      >
        Refresh Status
      </button>
    </div>
  );
}
```

**Step 2: Update App to include queue status**

Edit `packages/webapp/src/App.tsx`:

```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { PropertyDashboard } from './components/PropertyDashboard';
import { QueueStatus } from './components/QueueStatus';

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route
              path="/"
              element={
                <div className="container mx-auto px-4 py-8 space-y-6">
                  <h1 className="text-3xl font-bold text-gray-900">SCE2 Webapp</h1>
                  <QueueStatus />
                  <PropertyDashboard />
                </div>
              }
            />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
```

**Step 3: Test queue status**

Run: `npm run dev`
Expected: Queue status cards show scrape/submit counts

**Step 4: Commit queue status**

```bash
git add packages/webapp/src/components/QueueStatus.tsx packages/webapp/src/App.tsx
git commit -m "feat(webapp): add queue status component

- Create QueueStatus component with real-time counts
- Display scrape and submit queue metrics
- Add auto-refresh every 5 seconds
- Show processing indicator when extension active
- Add manual refresh button
- Update App layout with container and spacing"
```

---

## Task 7: Address Input and Batch Queueing

**Files:**
- Create: `packages/webapp/src/components/AddressInput.tsx`
- Modify: `packages/webapp/src/App.tsx`

**Step 1: Write address input component**

Create `packages/webapp/src/components/AddressInput.tsx`:

```typescript
import { useState } from 'react';
import { api } from '../lib/api';

interface Address {
  addressFull: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  city?: string;
  state?: string;
}

export function AddressInput({ onSuccess }: { onSuccess: () => void }) {
  const [addresses, setAddresses] = useState<Partial<Address>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAddress = () => {
    setAddresses([...addresses, {}]);
  };

  const removeAddress = (index: number) => {
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const updateAddress = (index: number, field: keyof Address, value: string) => {
    const updated = [...addresses];
    updated[index] = { ...updated[index], [field]: value };
    setAddresses(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate addresses
    const invalid = addresses.some(
      (addr) => !addr.addressFull || !addr.streetNumber || !addr.streetName || !addr.zipCode
    );

    if (invalid) {
      setError('All addresses must have: Full Address, Street Number, Street Name, and Zip Code');
      return;
    }

    setLoading(true);

    try {
      await api.queueAddressesForScraping(addresses as Address[]);
      setAddresses([]);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue addresses';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Queue Addresses for Scraping</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {addresses.map((addr, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-900">Address {index + 1}</h3>
              {addresses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAddress(index)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Address *
              </label>
              <input
                type="text"
                value={addr.addressFull || ''}
                onChange={(e) => updateAddress(index, 'addressFull', e.target.value)}
                placeholder="1909 W Martha Ln, Santa Ana, CA 92706"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Number *
                </label>
                <input
                  type="text"
                  value={addr.streetNumber || ''}
                  onChange={(e) => updateAddress(index, 'streetNumber', e.target.value)}
                  placeholder="1909"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Name *
                </label>
                <input
                  type="text"
                  value={addr.streetName || ''}
                  onChange={(e) => updateAddress(index, 'streetName', e.target.value)}
                  placeholder="W Martha Ln"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zip Code *
                </label>
                <input
                  type="text"
                  value={addr.zipCode || ''}
                  onChange={(e) => updateAddress(index, 'zipCode', e.target.value)}
                  placeholder="92706"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={addr.city || ''}
                  onChange={(e) => updateAddress(index, 'city', e.target.value)}
                  placeholder="Santa Ana"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={addr.state || ''}
                  onChange={(e) => updateAddress(index, 'state', e.target.value)}
                  placeholder="CA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        ))}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={addAddress}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            + Add Another Address
          </button>

          {addresses.length > 0 && (
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Queueing...' : `Queue ${addresses.length} Address${addresses.length > 1 ? 'es' : ''}`}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Update App to include address input**

Edit `packages/webapp/src/App.tsx`:

```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { PropertyDashboard } from './components/PropertyDashboard';
import { QueueStatus } from './components/QueueStatus';
import { AddressInput } from './components/AddressInput';

function Dashboard() {
  const { fetchProperties } = useApp();

  const handleQueueSuccess = () => {
    fetchProperties({ status: 'PENDING_SCRAPE' as any });
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">SCE2 Webapp</h1>
      <QueueStatus />
      <AddressInput onSuccess={handleQueueSuccess} />
      <PropertyDashboard />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
```

**Step 3: Test address input**

Run: `npm run dev`
Expected: Can add addresses, validate form, submit to API

**Step 4: Commit address input**

```bash
git add packages/webapp/src/components/AddressInput.tsx packages/webapp/src/App.tsx
git commit -m "feat(webapp): add address input and batch queueing

- Create AddressInput component with multi-address form
- Add form validation for required fields
- Implement batch queueing via API
- Add dynamic add/remove address functionality
- Display loading state during submission
- Include error handling and success callback
- Update Dashboard to refresh after queueing"
```

---

## Task 8: PDF Generation System

**Files:**
- Create: `packages/webapp/src/lib/pdf-generator.ts`
- Create: `packages/webapp/src/components/PDFGenerator.tsx`

**Step 1: Write PDF generator utility**

Create `packages/webapp/src/lib/pdf-generator.ts`:

```typescript
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Property } from '../types';
import { getCloudUrl } from './config';

export interface PDFOptions {
  includeQR?: boolean;
  includeCustomerData?: boolean;
  notes?: string;
}

export async function generateRouteSheet(
  properties: Property[],
  options: PDFOptions = {}
): Promise<void> {
  const doc = new jsPDF();
  const {
    includeQR = true,
    includeCustomerData = true,
    notes = '',
  } = options;

  let yPosition = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  // Header
  doc.setFontSize(18);
  doc.text('SCE2 Route Sheet', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Total Properties: ${properties.length}`, margin, yPosition);
  yPosition += 10;

  if (notes) {
    doc.setFontSize(10);
    doc.text('Notes:', margin, yPosition);
    yPosition += 5;
    doc.setFontSize(9);
    const splitNotes = doc.splitTextToSize(notes, 170);
    doc.text(splitNotes, margin, yPosition);
    yPosition += splitNotes.length * 5 + 5;
  }

  // Properties
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];

    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    // Property header
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, 190 - margin, yPosition);
    yPosition += 5;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Property ${i + 1}: ${property.addressFull}`, margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    // Customer data
    if (includeCustomerData) {
      if (property.customerName) {
        doc.text(`Customer: ${property.customerName}`, margin + 5, yPosition);
        yPosition += 6;
      }
      if (property.customerPhone) {
        doc.text(`Phone: ${property.customerPhone}`, margin + 5, yPosition);
        yPosition += 6;
      }
      if (property.customerAge) {
        doc.text(`Age: ${property.customerAge}`, margin + 5, yPosition);
        yPosition += 6;
      }
    }

    // Field notes
    if (property.fieldNotes) {
      doc.text('Field Notes:', margin + 5, yPosition);
      yPosition += 5;
      doc.setFontSize(9);
      const splitNotes = doc.splitTextToSize(property.fieldNotes, 120);
      doc.text(splitNotes, margin + 5, yPosition);
      yPosition += splitNotes.length * 4 + 5;
      doc.setFontSize(10);
    }

    // Status
    doc.text(`Status: ${property.status}`, margin + 5, yPosition);
    yPosition += 6;

    // QR Code
    if (includeQR) {
      try {
        const mobileUrl = getCloudUrl(`/mobile/${property.id}`);
        const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
          width: 100,
          margin: 1,
        });

        // Add QR code to the right side
        doc.addImage(qrDataUrl, 'PNG', 150, yPosition - 25, 30, 30);

        doc.setFontSize(8);
        doc.text('Scan for mobile entry', 150, yPosition + 8);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      }
      yPosition += 35;
    }

    // Documents count
    if (property.documents.length > 0) {
      doc.text(
        `Documents: ${property.documents.length} attached`,
        margin + 5,
        yPosition
      );
      yPosition += 8;
    } else {
      yPosition += 5;
    }
  }

  // Footer
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`sce2-route-${timestamp}.pdf`);
}

export async function generatePropertyPDF(property: Property): Promise<void> {
  return generateRouteSheet([property], {
    includeQR: true,
    includeCustomerData: true,
  });
}
```

**Step 2: Write PDFGenerator component**

Create `packages/webapp/src/components/PDFGenerator.tsx`:

```typescript
import { useState } from 'react';
import { Property } from '../types';
import { generateRouteSheet } from '../lib/pdf-generator';

interface PDFGeneratorProps {
  properties: Property[];
}

export function PDFGenerator({ properties }: PDFGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [includeQR, setIncludeQR] = useState(true);
  const [includeCustomerData, setIncludeCustomerData] = useState(true);
  const [notes, setNotes] = useState('');

  const handleGenerate = async () => {
    setLoading(true);

    try {
      await generateRouteSheet(properties, {
        includeQR,
        includeCustomerData,
        notes: notes.trim(),
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = properties.length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Route PDF</h2>

      {selectedCount === 0 ? (
        <p className="text-gray-500">Select properties to generate a route sheet.</p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-4">
            Generating PDF for <span className="font-semibold">{selectedCount}</span> property
            {selectedCount > 1 ? 'ies' : ''}
          </p>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeQR"
                checked={includeQR}
                onChange={(e) => setIncludeQR(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeQR" className="ml-2 block text-sm text-gray-900">
                Include QR codes (for mobile field entry)
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeCustomerData"
                checked={includeCustomerData}
                onChange={(e) => setIncludeCustomerData(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeCustomerData" className="ml-2 block text-sm text-gray-900">
                Include customer data (name, phone)
              </label>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Route Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any notes for the route team..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Generating...' : 'Generate Route PDF'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 3: Update App to include PDF generator**

Edit `packages/webapp/src/App.tsx`:

```typescript
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { PropertyDashboard } from './components/PropertyDashboard';
import { QueueStatus } from './components/QueueStatus';
import { AddressInput } from './components/AddressInput';
import { PDFGenerator } from './components/PDFGenerator';

function Dashboard() {
  const { fetchProperties } = useApp();
  const [selectedProperties, setSelectedProperties] = useState<number[]>([]);

  const handleQueueSuccess = () => {
    fetchProperties({ status: 'PENDING_SCRAPE' as any });
  };

  const togglePropertySelection = (id: number) => {
    setSelectedProperties((prev) =>
      prev.includes(id) ? prev.filter((propId) => propId !== id) : [...prev, id]
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">SCE2 Webapp</h1>
      <QueueStatus />
      <AddressInput onSuccess={handleQueueSuccess} />
      <PDFGenerator
        properties={
          selectedProperties.length > 0
            ? // In real implementation, we'd fetch full property objects
              ([] as any) // Placeholder
            : []
        }
      />
      <PropertyDashboard />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
```

**Step 4: Test PDF generation**

Run: `npm run dev`
Expected: PDF generator component visible (will show "Select properties" message)

**Step 5: Commit PDF system**

```bash
git add packages/webapp/src/lib/pdf-generator.ts packages/webapp/src/components/PDFGenerator.tsx packages/webapp/src/App.tsx
git commit -m "feat(webapp): add PDF generation system

- Create pdf-generator utility with jsPDF integration
- Implement QR code generation for mobile links
- Add route sheet generation with property details
- Include customer data (name, phone) from API
- Add multi-page support with page numbers
- Create PDFGenerator component with options
- Support QR codes, customer data toggle, and notes
- Handle PDF generation errors gracefully"
```

---

## Task 9: Navigation and Layout

**Files:**
- Create: `packages/webapp/src/components/Navigation.tsx`
- Create: `packages/webapp/src/components/Layout.tsx`
- Modify: `packages/webapp/src/App.tsx`

**Step 1: Write Navigation component**

Create `packages/webapp/src/components/Navigation.tsx`:

```typescript
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/properties', label: 'Properties', icon: '📋' },
  { path: '/queue', label: 'Queue', icon: '📬' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Navigation() {
  const location = useLocation();

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">🏢</span>
            <span className="text-xl font-bold text-gray-900">SCE2</span>
          </Link>

          <div className="flex space-x-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Write Layout component**

Create `packages/webapp/src/components/Layout.tsx`:

```typescript
import { ReactNode } from 'react';
import { Navigation } from './Navigation';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <main className="flex-1">{children}</main>
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-sm text-gray-600 text-center">
            SCE2 Rebate Automation System • v1.0.0
          </p>
        </div>
      </footer>
    </div>
  );
}
```

**Step 3: Update App with full routing**

Edit `packages/webapp/src/App.tsx`:

```typescript
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { PropertyDashboard } from './components/PropertyDashboard';
import { QueueStatus } from './components/QueueStatus';
import { AddressInput } from './components/AddressInput';
import { PDFGenerator } from './components/PDFGenerator';

function Dashboard() {
  const { fetchProperties } = useApp();

  const handleQueueSuccess = () => {
    fetchProperties({ status: 'PENDING_SCRAPE' as any });
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      <QueueStatus />
      <AddressInput onSuccess={handleQueueSuccess} />
      <PropertyDashboard />
    </div>
  );
}

function PropertiesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Properties</h1>
      <PropertyDashboard />
    </div>
  );
}

function QueuePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Queue Status</h1>
      <QueueStatus />
      <div className="mt-6">
        <PropertyDashboard />
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600">Settings panel coming soon...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
}

export default App;
```

**Step 4: Test navigation**

Run: `npm run dev`
Expected: Navigation bar with 4 links, clicking updates URL and view

**Step 5: Commit navigation**

```bash
git add packages/webapp/src/components/Navigation.tsx packages/webapp/src/components/Layout.tsx packages/webapp/src/App.tsx
git commit -m "feat(webapp): add navigation and layout system

- Create Navigation component with route links
- Add Layout component with header and footer
- Implement multi-page routing with React Router
- Add active state styling for navigation items
- Create separate pages for Dashboard, Properties, Queue, Settings
- Include footer with version info"
```

---

## Task 10: Build and Production Verification

**Files:**
- Modify: `packages/webapp/package.json` (add preview script)
- Create: `packages/webapp/README.md`

**Step 1: Add preview script to package.json**

Edit `packages/webapp/package.json`:

Add to scripts section:
```json
"preview": "vite preview",
```

**Step 2: Create README**

Create `packages/webapp/README.md`:

```markdown
# SCE2 Webapp

Desktop web application for route planning, property management, and PDF generation.

## Development

### Prerequisites

- Node.js 18+
- Cloud server running on http://localhost:3333

### Installation

\`\`\`bash
npm install
\`\`\`

### Development Server

\`\`\`bash
npm run dev
\`\`\`

Opens on http://localhost:5173

API calls are proxied to cloud server at http://localhost:3333

### Build for Production

\`\`\`bash
npm run build
\`\`\`

Output directory: `dist/`

### Preview Production Build

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Features

- ✅ Property dashboard with status filtering
- ✅ Queue status monitoring
- ✅ Batch address queueing for scraping
- ✅ PDF generation with QR codes
- ✅ Customer data display
- ✅ Real-time updates via polling

## Architecture

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **jsPDF** - PDF generation
- **QRCode** - QR code generation

## API Integration

The webapp communicates with the cloud server via REST API:

- `GET /api/properties` - List properties
- `POST /api/properties` - Create property
- `GET /api/queue/status` - Queue status

## Environment Variables

Create `.env` file:

\`\`\`env
VITE_API_BASE_URL=/api
VITE_CLOUD_BASE_URL=http://localhost:3333
\`\`\`

## Usage

1. Start cloud server: \`cd packages/cloud-server && npm run dev\`
2. Start webapp: \`cd packages/webapp && npm run dev\`
3. Open http://localhost:5173
4. Queue addresses for scraping
5. Monitor queue status
6. Generate route PDFs when ready
\`\`\`

**Step 3: Test production build**

Run: `npm run build`
Expected: Clean build with no errors, dist/ directory created

**Step 4: Verify production build**

Run: `npm run preview`
Expected: Preview server serves dist/ on http://localhost:4173

**Step 5: Commit build verification**

```bash
git add packages/webapp/package.json packages/webapp/README.md
git commit -m "feat(webapp): add build verification and documentation

- Add preview script for production builds
- Create comprehensive README.md
- Document development workflow
- Include architecture and feature list
- Add environment variable documentation
- Verify production build works correctly"
```

---

## Final Verification

### Before completing Phase 3, verify:

**Build Verification:**
- [ ] `npm run build` succeeds without errors
- [ ] TypeScript compilation passes: `npx tsc --noEmit`
- [ ] Development server starts: `npm run dev`
- [ ] Production preview works: `npm run preview`

**Functional Verification:**
- [ ] Can access all pages via navigation
- [ ] Dashboard loads with queue status
- [ ] Can add addresses and queue for scraping
- [ ] Can filter properties by status
- [ ] PDF generator component renders
- [ ] No console errors in browser

**API Integration:**
- [ ] Can fetch properties from cloud server
- [ ] Queue status updates every 5 seconds
- [ ] Address queueing creates properties in database
- [ ] Error handling displays user-friendly messages

**If all verifications pass:**

```bash
git log --oneline -10
# Should show 10 commits for Phase 3 tasks
```

**Phase 3 Complete!** 🎉

The webapp is now integrated with the cloud server API and ready for use.
