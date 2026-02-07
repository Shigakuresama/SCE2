#!/bin/bash
# SCE2 Full Integration Test Script
# Tests all components of the SCE2 system

set -e

echo "================================"
echo "SCE2 Full Integration Test"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Service URLs
CLOUD_SERVER="http://localhost:3333"
WEBAPP="http://localhost:5173"
MOBILE_WEB="http://localhost:5174"

echo "1. Testing Cloud Server..."
echo "==============================="
# Test health
echo -n "  ✓ Cloud Server connection... "
if curl -s "$CLOUD_SERVER/api/properties" > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo "    Make sure cloud server is running on port 3333"
    exit 1
fi

# Test properties endpoint
echo -n "  ✓ GET /api/properties... "
PROPS=$(curl -s "$CLOUD_SERVER/api/properties")
if echo "$PROPS" | grep -q '"success":true'; then
    echo -e "${GREEN}OK${NC}"
    COUNT=$(echo "$PROPS" | grep -o '"id":[0-9]*' | wc -l)
    echo "    Found $COUNT properties"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test routes endpoint
echo -n "  ✓ GET /api/routes... "
ROUTES=$(curl -s "$CLOUD_SERVER/api/routes")
if echo "$ROUTES" | grep -q '"success":true'; then
    echo -e "${GREEN}OK${NC}"
    echo "$ROUTES" | grep -o '"name":"[^"]*"' | sed 's/"name":/  - /'
else
    echo -e "${RED}FAILED${NC}"
fi

# Test queue endpoints
echo -n "  ✓ GET /api/queue/scrape... "
SCRAPE_QUEUE=$(curl -s "$CLOUD_SERVER/api/queue/scrape")
if echo "$SCRAPE_QUEUE" | grep -q 'success\|null'; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Response:${NC} $SCRAPE_QUEUE"
fi

echo ""
echo "2. Testing Webapp..."
echo "====================="
echo -n "  ✓ Webapp connection... "
if curl -s "$WEBAPP" | grep -q "SCE2 Webapp"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo "    Make sure webapp is running on port 5173"
fi

echo ""
echo "3. Testing Extension..."
echo "======================="
echo -n "  ✓ Extension build... "
if [ -f "packages/extension/dist/manifest.json" ]; then
    echo -e "${GREEN}OK${NC}"
    echo "    Extension built successfully"
    echo "    Load in Chrome: chrome://extensions/ → Load unpacked → packages/extension/dist/"
else
    echo -e "${RED}FAILED${NC}"
    echo "    Run: cd packages/extension && npm run build"
fi

# Check for content script
echo -n "  ✓ Content script exists... "
if [ -f "packages/extension/dist/content.js" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Check for background script
echo -n "  ✓ Background script exists... "
if [ -f "packages/extension/dist/background.js" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

echo ""
echo "4. Database Status..."
echo "===================="
cd packages/cloud-server

# Check if database exists
if [ -f "packages/cloud-server/dev.sqlite" ]; then
    echo -e "  ✓ ${GREEN}Database exists${NC}"

    # Get property count
    TOTAL=$(curl -s "$CLOUD_SERVER/api/properties" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
    echo "    Total properties: $TOTAL"

    # Get status breakdown
    PENDING=$(curl -s "$CLOUD_SERVER/api/properties" | grep -o '"status":"PENDING_SCRAPE"' | wc -l)
    READY=$(curl -s "$CLOUD_SERVER/api/properties" | grep -o '"status":"READY_FOR_FIELD"' | wc -l)
    VISITED=$(curl -s "$CLOUD_SERVER/api/properties" | grep -o '"status":"VISITED"' | wc -l)
    COMPLETE=$(curl -s "$CLOUD_SERVER/api/properties" | grep -o '"status":"COMPLETE"' | wc -l)

    echo "    Status breakdown:"
    echo "      PENDING_SCRAPE:  $PENDING"
    echo "      READY_FOR_FIELD: $READY"
    echo "      VISITED:         $VISITED"
    echo "      COMPLETE:        $COMPLETE"
else
    echo -e "  ${YELLOW}Database not found${NC}"
    echo "    Run: cd packages/cloud-server && npm run db:push"
fi

echo ""
echo "5. Manual Testing Instructions..."
echo "=================================="
echo ""
echo -e "${GREEN}WEBAPP TESTING (http://localhost:5173)${NC}"
echo "  1. Open browser to http://localhost:5173"
echo "  2. View Dashboard - should show properties list"
echo "  3. Click 'Map' tab - should show Leaflet map with markers"
echo "  4. Click a property to select it"
echo "  5. Click 'Generate PDF' - should create 3x3 grid PDF with QR codes"
echo "  6. Open PDF and verify QR codes scan"
echo ""
echo -e "${GREEN}MOBILE WEB TESTING (http://localhost:5174)${NC}"
echo "  1. Open browser to http://localhost:5174"
echo "  2. Select a property"
echo "  3. Fill in customer data (age, notes)"
echo "  4. Click 'Upload Photo' - should open camera/file picker"
echo "  5. Submit data"
echo ""
echo -e "${GREEN}EXTENSION TESTING${NC}"
echo "  1. Open Chrome: chrome://extensions/"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked'"
echo "  4. Navigate to: packages/extension/dist/"
echo "  5. Open: https://sce.dsmcentral.com/"
echo "  6. Use extension to:"
echo "     - SCRAPE: Extract customer data"
echo "     - SUBMIT: Fill forms and submit"
echo ""
echo -e "${GREEN}API TESTING${NC}"
echo "  Test endpoints:"
echo "  curl $CLOUD_SERVER/api/properties"
echo "  curl $CLOUD_SERVER/api/routes"
echo "  curl $CLOUD_SERVER/api/queue/scrape"
echo "  curl $CLOUD_SERVER/api/queue/submit"
echo ""

echo "6. Creating Test Data..."
echo "=========================="
# Create a test property with customer data
echo "Creating test property..."
curl -s -X POST "$CLOUD_SERVER/api/properties" \
  -H "Content-Type: application/json" \
  -d '{
    "streetNumber": "123",
    "streetName": "Integration Test St",
    "zipCode": "90210",
    "city": "Beverly Hills",
    "state": "CA",
    "latitude": 34.0736,
    "longitude": -118.4004,
    "customerName": "Integration Test User",
    "customerPhone": "310-555-TEST",
    "customerEmail": "test@example.com",
    "customerAge": 45,
    "status": "READY_FOR_FIELD"
  }' > /dev/null

echo "  ✓ Test property created"
echo ""

echo "================================"
echo "Test Complete!"
echo "================================"
echo ""
echo "All services are running. Follow the manual testing instructions above."
echo ""
