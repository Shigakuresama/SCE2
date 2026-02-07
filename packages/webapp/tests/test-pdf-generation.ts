#!/usr/bin/env node
/**
 * Test PDF Generation with Mock Data
 * Generates a 3x3 grid PDF with fake property data
 * Includes ACTUAL fillable PDF form fields (editable in Chrome)
 */

import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// ============= Inline Route Optimization =============

interface MockProperty {
  id: number;
  addressFull: string;
  streetNumber: string;
  streetName: string;
  zipCode: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  customerName: string;
  customerPhone: string;
  customerAge: number;
  fieldNotes: string;
  status: string;
  sceCaseId: string | null;
  routeId: number | null;
  documents: any[];
}

function calculateDistance(
  prop1: { latitude: number | null; longitude: number | null },
  prop2: { latitude: number | null; longitude: number | null }
): number {
  if (
    !prop1.latitude ||
    !prop1.longitude ||
    !prop2.latitude ||
    !prop2.longitude
  ) {
    return Infinity;
  }

  const R = 6371;
  const dLat = toRad(prop2.latitude - prop1.latitude);
  const dLon = toRad(prop2.longitude - prop1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(prop1.latitude)) *
      Math.cos(toRad(prop2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function optimizeRoute(
  properties: MockProperty[],
  startLat?: number | null,
  startLon?: number | null
): MockProperty[] {
  if (properties.length <= 1) {
    return [...properties];
  }

  const unvisited = [...properties];
  const ordered: MockProperty[] = [];

  let currentLat: number | null = startLat ?? null;
  let currentLon: number | null = startLon ?? null;

  if (currentLat === null || currentLon === null) {
    const first = unvisited.shift();
    if (first) {
      ordered.push(first);
      currentLat = first.latitude;
      currentLon = first.longitude;
    }
  }

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const prop = unvisited[i];

      if (currentLat !== null && currentLon !== null) {
        const dist = calculateDistance(
          { latitude: currentLat, longitude: currentLon },
          prop
        );

        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestIndex = i;
        }
      }
    }

    const nearest = unvisited.splice(nearestIndex, 1)[0];
    if (nearest) {
      ordered.push(nearest);
      currentLat = nearest.latitude;
      currentLon = nearest.longitude;
    }
  }

  return ordered;
}

function groupIntoPages(properties: MockProperty[]): MockProperty[][] {
  const pages: MockProperty[][] = [];
  const pageSize = 9;

  for (let i = 0; i < properties.length; i += pageSize) {
    pages.push(properties.slice(i, i + pageSize));
  }

  return pages;
}

// Mock property data - completely fake
const MOCK_PROPERTIES: MockProperty[] = [
  {
    id: 1,
    addressFull: '123 Test Street Apt 4B, Beverly Hills, CA 90210',
    streetNumber: '123',
    streetName: 'Test Street',
    zipCode: '90210',
    city: 'Beverly Hills',
    state: 'CA',
    latitude: 34.0736,
    longitude: -118.4004,
    customerName: 'Test User 1',
    customerPhone: '(310) 555-0001',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
  {
    id: 2,
    addressFull: '456 Fake Avenue, Irvine, CA 92614',
    streetNumber: '456',
    streetName: 'Fake Avenue',
    zipCode: '92614',
    city: 'Irvine',
    state: 'CA',
    latitude: 33.6846,
    longitude: -117.8265,
    customerName: 'Test User 2',
    customerPhone: '(949) 555-0002',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
  {
    id: 3,
    addressFull: '789 Mock Blvd, Anaheim, CA 92805',
    streetNumber: '789',
    streetName: 'Mock Blvd',
    zipCode: '92805',
    city: 'Anaheim',
    state: 'CA',
    latitude: 33.8361,
    longitude: -117.8897,
    customerName: 'Test User 3',
    customerPhone: '(714) 555-0003',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
  {
    id: 4,
    addressFull: '321 Sample Road, Santa Ana, CA 92706',
    streetNumber: '321',
    streetName: 'Sample Road',
    zipCode: '92706',
    city: 'Santa Ana',
    state: 'CA',
    latitude: 33.7455,
    longitude: -117.8689,
    customerName: 'Test User 4',
    customerPhone: '(714) 555-0004',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
  {
    id: 5,
    addressFull: '654 Demo Lane, Huntington Beach, CA 92647',
    streetNumber: '656',
    streetName: 'Demo Lane',
    zipCode: '92647',
    city: 'Huntington Beach',
    state: 'CA',
    latitude: 33.6603,
    longitude: -118.0026,
    customerName: 'Test User 5',
    customerPhone: '(714) 555-0005',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
  {
    id: 6,
    addressFull: '987 pretend Ave, Costa Mesa, CA 92627',
    streetNumber: '987',
    streetName: 'Pretend Ave',
    zipCode: '92627',
    city: 'Costa Mesa',
    state: 'CA',
    latitude: 33.6416,
    longitude: -117.9188,
    customerName: 'Test User 6',
    customerPhone: '(714) 555-0006',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
  {
    id: 7,
    addressFull: '147 Fiction Street, Fullerton, CA 92832',
    streetNumber: '147',
    streetName: 'Fiction Street',
    zipCode: '92832',
    city: 'Fullerton',
    state: 'CA',
    latitude: 33.8704,
    longitude: -117.9253,
    customerName: 'Test User 7',
    customerPhone: '(714) 555-0007',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
  {
    id: 8,
    addressFull: '258 Imaginary Way, Orange, CA 92867',
    streetNumber: '258',
    streetName: 'Imaginary Way',
    zipCode: '92867',
    city: 'Orange',
    state: 'CA',
    latitude: 33.7878,
    longitude: -117.8531,
    customerName: 'Test User 8',
    customerPhone: '(714) 555-0008',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
  {
    id: 9,
    addressFull: '369 Make Believe Dr, Garden Grove, CA 92841',
    streetNumber: '369',
    streetName: 'Make Believe Dr',
    zipCode: '92841',
    city: 'Garden Grove',
    state: 'CA',
    latitude: 33.7743,
    longitude: -117.9415,
    customerName: 'Test User 9',
    customerPhone: '(714) 555-0009',
    customerAge: 0,
    fieldNotes: '',
    status: 'READY_FOR_FIELD',
    sceCaseId: null,
    routeId: null,
    documents: [],
  },
];

/**
 * Generate a 3x3 grid route sheet PDF with fillable form fields
 */
async function generateTestPDF() {
  console.log('🚀 Starting PDF generation with mock data...\n');

  // Optimize route order
  const optimizedProperties = optimizeRoute(MOCK_PROPERTIES);

  console.log(`📍 Optimized route for ${optimizedProperties.length} properties`);

  // Group into pages of 9 (3x3 grid)
  const pages = groupIntoPages(optimizedProperties);
  console.log(`📄 Generated ${pages.length} page(s)\n`);

  // Create PDF document (portrait, millimeters, Letter)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 216mm for Letter
  const pageHeight = doc.internal.pageSize.getHeight(); // 279mm for Letter
  const margin = 10;
  const headerHeight = 25;

  // Generate each page
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (pageIndex > 0) {
      doc.addPage();
    }

    const pageProperties = pages[pageIndex];

    // Add header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('SCE2 Route Sheet (TEST DATA)', margin, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${pageIndex + 1} of ${pages.length} | Generated: ${new Date().toLocaleDateString()}`,
      margin,
      20
    );

    doc.setTextColor(200, 100, 100);
    doc.setFontSize(8);
    doc.text('*** TEST DATA - NOT REAL CUSTOMERS ***', pageWidth - margin - 55, 20);
    doc.setTextColor(0);

    // Draw 3x3 grid
    const gridCols = 3;
    const gridRows = 3;
    const cellWidth = (pageWidth - 2 * margin) / gridCols;
    const cellHeight = (pageHeight - headerHeight - margin) / gridRows;

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const index = row * gridCols + col;
        const property = pageProperties[index];

        if (!property) continue;

        const x = margin + col * cellWidth;
        const y = headerHeight + row * cellHeight;

        // Draw cell border
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(x, y, cellWidth, cellHeight);

        // Layout: QR code in top-right, content on left
        const qrSize = 22;
        const qrX = x + cellWidth - qrSize - 3;
        const qrY = y + 3;

        const contentX = x + 4;
        const contentWidth = cellWidth - qrSize - 6; // Wider - less space for QR code
        let yPos = y + 6;

        // ===== PROPERTY NUMBER (top) =====
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(`#${index + 1}`, contentX, yPos);
        doc.setTextColor(0);
        yPos += 6;

        // ===== ADDRESS (on line below number) =====
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const addressLines = doc.splitTextToSize(property.addressFull, contentWidth);
        doc.text(addressLines.slice(0, 2), contentX, yPos);
        yPos += addressLines.slice(0, 2).length * 4 + 4;

        // ===== NAME =====
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        if (property.customerName) {
          const nameLines = doc.splitTextToSize(`Name: ${property.customerName}`, contentWidth);
          doc.text(nameLines, contentX, yPos);
          yPos += nameLines.length * 4 + 2;
        }

        // ===== PHONE =====
        if (property.customerPhone) {
          doc.text(`Phone: ${property.customerPhone}`, contentX, yPos);
          yPos += 7;
        }

        // ===== AGE FIELD (fillable, small) =====
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Age:', contentX, yPos);

        // Create fillable AGE field
        const ageField = new doc.AcroForm.TextField();
        ageField.fieldName = `property_${property.id}_age`;
        ageField.x = contentX;
        ageField.y = yPos + 1;
        ageField.width = 20;
        ageField.height = 6;
        ageField.fontSize = 9;
        ageField.value = property.customerAge > 0 ? property.customerAge.toString() : '';
        ageField.Q = 1; // Right align for numbers
        doc.addField(ageField);

        // Draw border around AGE field
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.3);
        doc.rect(contentX, yPos + 1, 20, 6);

        yPos += 10;

        // ===== NOTES FIELD (fillable, multiline) =====
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', contentX, yPos);

        const notesHeight = cellHeight - (yPos - y) - 5;
        const notesWidth = contentWidth;

        // Create fillable NOTES field
        const notesField = new doc.AcroForm.TextField();
        notesField.fieldName = `property_${property.id}_notes`;
        notesField.x = contentX;
        notesField.y = yPos + 1;
        notesField.width = notesWidth;
        notesField.height = notesHeight;
        notesField.fontSize = 8;
        notesField.multiline = true;
        notesField.value = property.fieldNotes || '';
        notesField.Q = 0; // Left align for text
        doc.addField(notesField);

        // Draw border around NOTES field
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.3);
        doc.rect(contentX, yPos + 1, notesWidth, notesHeight);

        // ===== QR CODE (top-right corner) =====
        try {
          const mobileUrl = `http://localhost:5174/${property.id}`;
          const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
            width: 80,
            margin: 1,
            errorCorrectionLevel: 'L',
          });

          // White background for QR
          doc.setFillColor(255, 255, 255);
          doc.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 'F');
          doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

          // "SCAN" label
          doc.setFontSize(5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 100, 100);
          const qrLabel = 'SCAN';
          const qrLabelWidth = doc.getTextWidth(qrLabel);
          doc.text(qrLabel, qrX + (qrSize - qrLabelWidth) / 2, qrY + qrSize + 3);
          doc.setTextColor(0);
        } catch (error) {
          console.error(`Failed to generate QR code for property ${property.id}:`, error);
        }
      }
    }
  }

  // Add page numbers footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${totalPages} | Fields are editable - click and type. Scan QR codes for mobile access.`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
    doc.setTextColor(0);
  }

  // Save PDF to test directory
  const outputPath = '/home/sergio/Projects/SCE2/test-output.pdf';
  doc.save(outputPath);

  console.log(`\n✅ PDF generated successfully!`);
  console.log(`📁 Path: ${outputPath}`);
  console.log(`📊 Pages: ${totalPages}`);
  console.log(`🏠 Properties: ${MOCK_PROPERTIES.length}`);
  console.log(`📝 Fillable fields: ${MOCK_PROPERTIES.length * 2} (AGE + NOTES per property)`);
  console.log(`\n✨ Features:`);
  console.log(`  • AGE and NOTES fields are EDITABLE in Chrome/Adobe Reader`);
  console.log(`  • Layout: # → Address → Name → Phone → Age → Notes`);
  console.log(`  • QR codes in top-right corner (smaller, no overlap)`);
  console.log(`  • Long names wrap properly without overlapping QR`);
  console.log(`\nYou can open the PDF with:`);
  console.log(`  xdg-open ${outputPath}`);
  console.log(`  or`);
  console.log(`  firefox ${outputPath}`);
  console.log(`  or`);
  console.log(`  evince ${outputPath}`);
  console.log(`\n📱 Open in Chrome and click on AGE or NOTES fields to edit!`);
}

// Run the test
generateTestPDF().catch(console.error);
