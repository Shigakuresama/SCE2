# SCE2 Webapp

Desktop web application for the SCE2 rebate automation platform. Handles route planning, PDF generation, and property management.

## Features

- **Dashboard**: Overview of all SCE rebate operations with statistics and metrics
- **Properties Management**: View, filter, and manage rebate properties across all statuses
- **Queue Monitoring**: Real-time status of scrape and submission queues
- **Address Input**: Add new properties to the queue via address lookup
- **PDF Generation**: Generate route sheets with QR codes for field operations
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Architecture

### Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **PDF Generation**: jsPDF + QRCode
- **Maps**: Google Maps API (optional) and Leaflet

### Project Structure

```
packages/webapp/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Navigation.tsx   # Top navigation bar
│   │   ├── Layout.tsx       # Page layout wrapper
│   │   ├── PropertyList.tsx # Property list with filtering
│   │   ├── PropertyCard.tsx # Individual property card
│   │   ├── QueueStatus.tsx  # Queue monitoring
│   │   ├── AddressInput.tsx # Address search and queueing
│   │   └── PDFGenerator.tsx # PDF generation with QR codes
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── Properties.tsx   # Property management
│   │   ├── Queue.tsx        # Queue monitoring
│   │   └── Settings.tsx     # Settings (placeholder)
│   ├── contexts/            # React contexts
│   │   └── AppContext.tsx   # Global app state
│   ├── lib/                 # Utility libraries
│   │   └── api.ts           # API service layer
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # Exported types
│   ├── App.tsx              # Root app component
│   └── main.tsx             # Application entry point
├── public/                  # Static assets
├── index.html               # HTML template
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── README.md                # This file
```

## Development

### Prerequisites

- Node.js 18+ and npm
- SCE2 cloud server running on port 3333 (or configured via environment)

### Installation

```bash
# From workspace root
npm install

# Or install only webapp dependencies
cd packages/webapp
npm install
```

### Development Server

```bash
# Start development server with hot reload
npm run dev

# Access at http://localhost:5173
```

### Build for Production

```bash
# Build production bundle
npm run build

# Output: dist/ directory
```

### Preview Production Build

```bash
# Preview production build locally
npm run preview

# Access at http://localhost:4173
```

## Environment Variables

Create a `.env` file in the webapp directory (optional, defaults shown):

```bash
# API base URL (default: http://localhost:3333)
VITE_API_BASE_URL=http://localhost:3333

# Google Maps API Key (optional, for address autocomplete)
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

## API Integration

The webapp communicates with the SCE2 cloud server via REST API:

```typescript
// Base URL from environment
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333';

// Endpoints
GET    /api/properties              # List all properties
GET    /api/properties/:id          # Get single property
POST   /api/properties/queue        # Add property to queue
GET    /api/queue/status            # Get queue statistics
POST   /api/queue/process           # Process queue
```

## Component Usage

### Navigation

```tsx
import { Navigation } from './components/Navigation';

// Automatically highlights active route
// Links: Dashboard, Properties, Queue, Settings
```

### Layout

```tsx
import { Layout } from './components/Layout';

<Layout>
  <YourPageContent />
</Layout>
```

### Property List with Filtering

```tsx
import { PropertyList } from './components/PropertyList';

<PropertyList
  properties={filteredProperties}
  loading={loading}
  onPropertyClick={(property) => console.log(property)}
/>
```

### Address Input

```tsx
import { AddressInput } from './components/AddressInput';

<AddressInput
  onSuccess={() => {
    // Refresh properties after adding
    fetchProperties();
  }}
/>
```

### PDF Generation

```tsx
import { PDFGenerator } from './components/PDFGenerator';

<PDFGenerator
  properties={properties}
  selectedProperties={selectedProperties}
/>
```

## Property Statuses

Properties flow through these statuses:

1. **PENDING_SCRAPE**: Queued for scraping
2. **READY_FOR_FIELD**: Scraped, ready for field visit
3. **VISITED**: Field data collected
4. **READY_FOR_SUBMISSION**: Ready to submit to SCE
5. **COMPLETE**: Successfully submitted
6. **FAILED**: Error occurred (retryable)

## Type Definitions

Key types exported from `src/types/index.ts`:

```typescript
// Property status enum
enum PropertyStatus {
  PENDING_SCRAPE = 'PENDING_SCRAPE',
  READY_FOR_FIELD = 'READY_FOR_FIELD',
  VISITED = 'VISITED',
  READY_FOR_SUBMISSION = 'READY_FOR_SUBMISSION',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED'
}

// Property interface
interface Property {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  status: PropertyStatus;
  createdAt: string;
  updatedAt: string;
}

// Queue statistics
interface QueueStats {
  pendingScrape: number;
  readyForField: number;
  readyForSubmission: number;
  failed: number;
}
```

## Deployment

### Build Configuration

Production builds are optimized with:

- TypeScript compilation
- Terser minification
- CSS purging (Tailwind)
- Asset hashing
- Gzip compression ready

### Static Hosting

Deploy the `dist/` directory to any static hosting service:

- **Netlify**: Connect and deploy
- **Vercel**: Import project
- **GitHub Pages**: Use `vite-plugin-ghpages`
- **Nginx/Apache**: Serve static files

### Cloud Server Configuration

Update environment variable for production:

```bash
# .env.production
VITE_API_BASE_URL=https://your-cloud-server.com
```

## Troubleshooting

### Development server won't start

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Type errors after build

```bash
# Regenerate TypeScript types
npm run build
```

### API connection refused

1. Verify cloud server is running: `curl http://localhost:3333/health`
2. Check CORS configuration in cloud server
3. Verify `VITE_API_BASE_URL` in `.env`

### PDF generation fails

1. Check browser console for errors
2. Verify jsPDF and QRCode dependencies installed
3. Check property data includes required fields

## Contributing

When adding new features:

1. Create component in `src/components/` or page in `src/pages/`
2. Add TypeScript types to `src/types/index.ts`
3. Update navigation in `src/components/Navigation.tsx`
4. Add route in `src/App.tsx`
5. Test in development before building

## License

MIT

## Version

1.0.0
