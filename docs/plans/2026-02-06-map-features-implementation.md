# SCE2 Map Features Implementation Plan

**Created:** 2026-02-06
**Status:** Ready for implementation

## Overview

Implement three critical missing features to make SCE2 functional for route planning:
1. Fix map drawing (rectangles/circles) to fetch addresses via Overpass API
2. Add fuzzy address search with Nominatim API and automatic pin placement
3. Add test data generation to PDF generator

## Phase 1: Fix Map Drawing (Priority: CRITICAL)

### Task 1.1: Fix EditControl Integration

**File:** `packages/webapp/src/components/MapLayout.tsx`

**Steps:**
1. Review current MapLayout.tsx implementation
2. Verify EditControl is imported but not functional
3. Fix EditControl positioning to "topright"
4. Configure EditControl to enable only rectangle and circle tools
5. Disable polygon, polyline, marker, circlemarker tools
6. Add drawing controls: undo, clear buttons

**Verification:**
- Drawing toolbar visible on map (top-right corner)
- Rectangle and circle buttons enabled
- Other tools disabled

### Task 1.2: Implement Draw Event Listener

**File:** `packages/webapp/src/components/MapLayout.tsx`

**Steps:**
1. Add useEffect to listen for FeatureGroup draw:created event
2. When shape created:
   - Extract bounds (L.rectangle.getBounds() or L.circle.getBounds())
   - Convert to Overpass API bounding box format
   - Call fetchAddressesInBounds()
3. Handle draw:deleted event (remove markers from deleted shape)

**Code to add:**
```typescript
useEffect(() => {
  if (!drawLayer) return;

  const handleDrawCreated = (e: L.LeafletEvent) => {
    const layer = e.layer;

    if (layer instanceof L.Rectangle) {
      const bounds = layer.getBounds();
      const south = bounds.getSouth();
      const west = bounds.getWest();
      const north = bounds.getNorth();
      const east = bounds.getEast();
      fetchAddressesInBounds({ south, west, north, east });
    } else if (layer instanceof L.Circle) {
      const bounds = layer.getBounds();
      fetchAddressesInBounds({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast()
      });
    }
  };

  drawLayer.on('draw:created', handleDrawCreated);
  drawLayer.on('draw:deleted', handleDrawDeleted);
}, [drawLayer]);
```

**Verification:**
- Draw rectangle → console.log(bounds)
- Draw circle → console.log(bounds)

### Task 1.3: Create Overpass API Integration

**New File:** `packages/webapp/src/lib/overpass.ts`

**Steps:**
1. Create fetchAddressesInBounds() function
2. Use OVERPASS_API_URL from config
3. Build Overpass XML query for addresses in bounding box
4. Parse XML response to extract address data
5. Return array of AddressInput objects

**Code:**
```typescript
const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export async function fetchAddressesInBounds(bounds: Bounds): Promise<AddressInput[]> {
  const query = `
    [out:json][timeout:25];
    (
      way["addr:housenumber"]["addr:street"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      relation["addr:housenumber"]["addr:street"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out tags;
    out center;
  `;

  const response = await fetch(OVERPASS_API_URL, {
    method: 'POST',
    body: query
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.elements) return [];

  return data.elements.map((element: any) => {
    const tags = element.tags || {};
    return {
      streetNumber: tags['addr:housenumber'] || '',
      streetName: tags['addr:street'] || '',
      city: tags['addr:city'] || '',
      state: tags['addr:state'] || 'CA',
      zipCode: tags['addr:postcode'] || ''
    };
  }).filter((addr: AddressInput) =>
    addr.streetNumber && addr.streetName && addr.zipCode
  );
}
```

**Verification:**
- Draw rectangle on map
- Console shows fetched addresses
- Markers appear on map for each address

### Task 1.4: Update MapLayout to Use Overpass

**File:** `packages/webapp/src/components/MapLayout.tsx`

**Steps:**
1. Import fetchAddressesInBounds
2. Add state for loading indicator
3. Call fetchAddressesInBounds when shape drawn
4. Add markers for each fetched address
5. Show loading indicator while fetching

**Verification:**
- Draw rectangle → "Fetching addresses..." shown
- Addresses fetched → markers placed
- Loading indicator disappears

## Phase 2: Add Fuzzy Address Search (Priority: CRITICAL)

### Task 2.1: Add Search Input to Dashboard

**File:** `packages/webapp/src/pages/Dashboard.tsx`

**Steps:**
1. Add search input field above map toggle buttons
2. Add search button and loading indicator
3. Add search state management
4. Style input to match existing UI

**Code:**
```tsx
<input
  type="text"
  placeholder="Search address (e.g., 1909 W Martha Ln)"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
/>
<button onClick={handleSearch} disabled={isSearching}>
  🔍 Search
</button>
```

**Verification:**
- Search input visible on Dashboard
- Enter key triggers search
- Button disabled while searching

### Task 2.2: Create Geocoding Service

**New File:** `packages/webapp/src/lib/geocoding.ts`

**Steps:**
1. Create searchAddress() function
2. Implement 4 search strategies:
   - Exact query
   - Query + ", Santa Ana, CA"
   - Query + ", CA"
   - Query with "Ave" instead of "Ln"
3. Use Nominatim API with User-Agent header
4. Return first successful result

**Code:**
```typescript
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

export async function searchAddress(query: string): Promise<SearchResult | null> {
  const strategies = [
    query,
    `${query}, Santa Ana, CA`,
    `${query}, CA`,
    query.replace(/\s(Ln|Lane)\s*$/i, 'Ave') + ', Santa Ana, CA'
  ];

  for (const searchQuery of strategies) {
    try {
      const url = `${NOMINATIM_API}?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=1`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'SCE2-RoutePlanner/1.0' }
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data.length > 0) {
        const result = data[0];
        return {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          display_name: result.display_name,
          address: result.address,
          name: result.display_name.split(',')[0].trim()
        };
      }
    } catch (error) {
      console.error(`Search failed for "${searchQuery}":`, error);
      continue;
    }
  }

  return null;
}
```

**Verification:**
- Search "1909 W Martha Ln" → returns coordinates
- Search "1909 W Martha" → still works (adds Santa Ana, CA)
- Invalid address → returns null

### Task 2.3: Add Auto Pin Placement

**File:** `packages/webapp/src/pages/Dashboard.tsx`

**Steps:**
1. Import searchAddress and addMarker functions
2. In handleSearch():
   - Call searchAddress()
   - If found: create marker at lat/lon
   - Pan map to location
   - Add address to selected addresses list
3. Show success/error messages

**Code:**
```typescript
async function handleSearch() {
  setIsSearching(true);

  try {
    const result = await searchAddress(searchQuery);

    if (result) {
      // Add marker to map
      const marker = L.marker([result.lat, result.lon]);
      marker.addTo(mapRef.current);
      marker.bindPopup(result.display_name);

      // Pan to location
      mapRef.current.setView([result.lat, result.lon], 16);

      // Add to selected addresses
      const address: AddressInput = {
        streetNumber: extractStreetNumber(result.display_name),
        streetName: extractStreetName(result.display_name),
        city: 'Santa Ana',
        state: 'CA',
        zipCode: extractZipCode(result.display_name)
      };

      setSelectedAddresses(prev => [...prev, address]);

      setMessage(`Found: ${result.display_name}`);
    } else {
      setMessage('Address not found. Try full address with city, state, ZIP.');
    }
  } catch (error) {
    setMessage(`Search error: ${error.message}`);
  } finally {
    setIsSearching(false);
  }
}
```

**Verification:**
- Search "1909 W Martha Ln" → marker appears
- Map automatically pans to location
- Address added to list

### Task 2.4: Update App Context for Search

**File:** `packages/webapp/src/contexts/AppContext.tsx`

**Steps:**
1. Add searchQuery state
2. Add selectedAddresses state (if not exists)
3. Add addSelectedAddress function
4. Update search state management

**Verification:**
- Context provides search functionality
- Addresses can be added to selection
- State persists across components

## Phase 3: Add Apartment Detection (Priority: HIGH)

### Task 3.1: Create isApartment Utility

**New File:** `packages/webapp/src/lib/apartment-detector.ts`

**Steps:**
1. Create isApartment() function
2. Check name/display_name for keywords
3. Check display_name for patterns
4. Return boolean

**Code:**
```typescript
export function isApartment(address: Property | SearchResult): boolean {
  const searchFields = [
    address.name || '',
    address.display_name || '',
    address.addressFull || ''
  ].join(' ').toLowerCase();

  // Keywords
  const aptKeywords = ['apartment', 'apt', 'complex', 'tower', 'condo'];

  // Patterns
  const aptPatterns = [
    /\b(unit|apt|apt\.|suite|ste|ste\.|#)\s*[a-z0-9]+/i,
    /\bapartments?\b/i,
    /\bcondos?\b/i
  ];

  return aptKeywords.some(k => searchFields.includes(k)) ||
         aptPatterns.some(p => p.test(searchFields));
}
```

**Verification:**
- isApartment({name: "Sunset Apartments"}) → true
- isApartment({display_name: "1909 W Martha Ln"}) → false

### Task 3.2: Create Custom Marker Icons

**File:** `packages/webapp/src/components/MapLayout.tsx`

**Steps:**
1. Import Leaflet and required icons
2. Create custom icons using L.divIcon
3. Orange icon for apartments with badge
4. Blue icon for houses (default Leaflet marker)

**Code:**
```typescript
// Apartment marker (orange with badge)
const apartmentIcon = L.divIcon({
  className: 'custom-marker apartment-marker',
  html: `<div style="
    position: relative;
    width: 30px;
    height: 30px;
  ">
    <div style="
      position: absolute;
      font-size: 24px;
      color: #ff6b35;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    ">📍</div>
    <div style="
      position: absolute;
      bottom: -2px;
      right: -2px;
      background: #ff6b35;
      color: white;
      font-size: 8px;
      font-weight: bold;
      padding: 1px 3px;
      border-radius: 3px;
      border: 1px solid white;
    ">Apt</div>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

// House marker (blue default)
const houseIcon = L.icon({
  iconUrl: markerIcon, // Default Leaflet marker
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: markerShadow
});
```

**Verification:**
- Apartment marker shows orange 📍 with "Apt" badge
- House marker shows blue default pin

### Task 3.3: Update Marker Creation Logic

**File:** `packages/webapp/src/components/MapLayout.tsx`

**Steps:**
1. Import isApartment function
2. Before adding marker, check if apartment
3. Use appropriate icon based on detection
4. Add popup with apartment label if applicable

**Verification:**
- Apartment address → orange marker
- House address → blue marker
- Popup shows "🏢 Apartment Complex" for apartments

## Phase 4: Add Test Data to PDF (Priority: HIGH)

### Task 4.1: Create Test Customer Data

**File:** `packages/webapp/src/lib/pdf-generator.ts`

**Steps:**
1. Add TEST_CUSTOMERS constant at top of file
2. Create diverse Orange County-appropriate test data
3. Include names: Garcia, Kim, Rodriguez, Lee, Smith, Johnson
4. Include realistic local phone numbers

**Code:**
```typescript
const TEST_CUSTOMERS = [
  { name: "Maria Garcia", phone: "(714) 555-0101" },
  { name: "Chen Wei", phone: "(714) 555-0102" },
  { name: "James Rodriguez", phone: "(714) 555-0103" },
  { name: "Sarah Smith", phone: "(714) 555-0104" },
  { name: "David Kim", phone: "(714) 555-0105" },
  { name: "Patricia O'Brien", phone: "(714) 555-0106" },
  { name: "Robert Johnson", phone: "(714) 555-0107" },
  { name: "Jennifer Lee", phone: "(714) 555-0108" },
  { name: "Michael Williams", phone: "(714) 555-0109" },
  { name: "Linda Martinez", phone: "(714) 555-0110" }
];
```

**Verification:**
- TEST_CUSTOMERS has 10 entries
- Names are diverse (Hispanic, Asian, Irish, Korean)
- Phone numbers are proper format: (714) 555-XXXX

### Task 4.2: Add Test Data Enrichment Function

**File:** `packages/webapp/src/lib/pdf-generator.ts`

**Steps:**
1. Create enrichWithTestData() function
2. Map properties to add test data where missing
3. Use modulo to cycle through TEST_CUSTOMERS
4. Add "TEST DATA" watermark to PDF when used

**Code:**
```typescript
function enrichWithTestData(properties: Property[]): Property[] {
  let testDataUsed = false;

  const enriched = properties.map((prop, index) => {
    const needsName = !prop.customerName || prop.customerName?.trim() === '';
    const needsPhone = !prop.customerPhone || prop.customerPhone?.trim() === '';

    if (needsName || needsPhone) {
      testDataUsed = true;
      const testData = TEST_CUSTOMERS[index % TEST_CUSTOMERS.length];

      return {
        ...prop,
        customerName: needsName ? testData.name : prop.customerName,
        customerPhone: needsPhone ? testData.phone : prop.customerPhone
      };
    }

    return prop;
  });

  // If test data was used, add watermark to PDF
  if (testDataUsed) {
    // Store flag for PDF generator to add watermark
    (enriched as any)._usesTestData = true;
  }

  return enriched;
}
```

**Verification:**
- Properties without customerName get test names
- Properties without customerPhone get test phones
- Properties with real data unchanged
- Flag set when test data used

### Task 4.3: Update PDF Generator to Use Test Data

**File:** `packages/webapp/src/lib/pdf-generator.ts`

**Steps:**
1. Modify generateRouteSheet() to call enrichWithTestData()
2. Check if properties have customer data
3. Add test data where missing
4. If test data used, add watermark to first page

**Code:**
```typescript
export async function generateRouteSheet(
  properties: Property[],
  options: PDFGenerationOptions = {}
): Promise<void> {
  // Enrich with test data
  const enrichedProperties = enrichWithTestData(properties);

  // Check if test data was used
  const usesTestData = (enrichedProperties as any)._usesTestData;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SCE2 Route Sheet', margin, yPosition);

  // Add test data watermark if applicable
  if (usesTestData) {
    doc.setFontSize(8);
    doc.setTextColor(200);
    doc.text('*** TEST DATA ***', margin, yPosition + 5);
    doc.setTextColor(0);
  }

  // Rest of PDF generation...
}
```

**Verification:**
- PDF with no customer data includes test data
- Watermark "*** TEST DATA ***" visible
- PDF with real customer data unchanged

## Testing Strategy

### Manual Browser Tests

**Test 1: Map Drawing**
1. Navigate to http://localhost:5173
2. Click "Map Layout" button
3. Click "Draw Rectangle" button
4. Draw rectangle around a block
5. **VERIFY:** Markers appear for all addresses in rectangle

**Test 2: Address Search**
1. On Dashboard, enter "1909 W Martha Ln" in search
2. Press Enter or click "Search"
3. **VERIFY:** Marker appears at address location
4. **VERIFY:** Map pans to address

**Test 3: Apartment Detection**
1. Search for known apartment: "Sunset Apartments"
2. **VERIFY:** Orange pin with "Apt" badge
3. Popup shows "🏢 Apartment Complex"

**Test 4: PDF with Test Data**
1. Generate PDF with addresses that have no customer data
2. **VERIFY:** PDF downloads with test names/phones
3. **VERIFY:** Watermark "*** TEST DATA ***" visible
4. Open PDF and verify test data populated

## Rollback Plan

Each phase is independent:
- Phase 1 (Map Drawing) can be reverted without affecting search/PDF
- Phase 2 (Search) can be reverted without affecting drawing/PDF
- Phase 3 (Apartment Detection) is cosmetic, safe to revert
- Phase 4 (Test Data) only affects PDF generation

Git branches:
- `feature/map-drawing` - Phase 1
- `feature/address-search` - Phase 2
- `feature/apartment-detection` - Phase 3
- `feature/test-data-pdf` - Phase 4

Or single branch: `feature/map-features` - All phases

## Success Criteria

### Map Drawing
✅ Drawing toolbar visible with rectangle and circle tools
✅ Can draw rectangle → addresses fetched from area
✅ Can draw circle → addresses fetched from area
✅ Markers placed for each found address
✅ Can undo/clear drawings

### Address Search
✅ Search input accepts address and searches
✅ Multiple search strategies tried automatically
✅ Address found → marker placed automatically
✅ Map pans to found address
✅ Address added to selected list

### Apartment Detection
✅ Apartments get orange pins with "Apt" badge
✅ Houses get blue default pins
✅ Popup shows "🏢 Apartment Complex" for apartments

### PDF Test Data
✅ PDF generates even when customer data missing
✅ Test data used: diverse Orange County names
✅ Realistic phone numbers in (714) 555-XXXX format
✅ Watermark "*** TEST DATA ***" when test data used
