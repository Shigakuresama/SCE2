// ============= PDF Generation =============
// Generate 3x3 grid route sheets with AGE/NOTES display fields and QR codes

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Property } from '../types';
import { getMobileUrl } from './config';
import { optimizeRoute, groupIntoPages } from './route-optimizer';
import { addTextField, addTextareaField, addComboBox, generateFieldName } from './acroform-fields';

/**
 * Test customer data for PDF generation
 * Used when real customer data is missing from properties
 */
const TEST_CUSTOMERS = [
  { name: 'Maria Garcia', phone: '(714) 555-0101', age: 45 },
  { name: 'Chen Wei', phone: '(714) 555-0102', age: 52 },
  { name: 'James Rodriguez', phone: '(714) 555-0103', age: 38 },
  { name: 'Sarah Smith', phone: '(714) 555-0104', age: 61 },
  { name: 'David Kim', phone: '(714) 555-0105', age: 29 },
  { name: 'Patricia O\'Brien', phone: '(714) 555-0106', age: 55 },
  { name: 'Robert Johnson', phone: '(714) 555-0107', age: 42 },
  { name: 'Jennifer Lee', phone: '(714) 555-0108', age: 33 },
  { name: 'Michael Williams', phone: '(714) 555-0109', age: 48 },
];

/**
 * Enrich properties with test data where customer data is missing
 */
function enrichWithTestData(properties: Property[]): (Property & { _usesTestData?: boolean })[] {
  let testDataUsed = false;

  const enriched = properties.map((prop, index) => {
    const needsName = !prop.customerName || prop.customerName?.trim() === '';
    const needsPhone = !prop.customerPhone || prop.customerPhone?.trim() === '';
    const needsAge = !prop.customerAge;

    if (needsName || needsPhone || needsAge) {
      testDataUsed = true;
      const testData = TEST_CUSTOMERS[index % TEST_CUSTOMERS.length];

      return {
        ...prop,
        customerName: needsName ? testData.name : prop.customerName,
        customerPhone: needsPhone ? testData.phone : prop.customerPhone,
        customerAge: needsAge ? testData.age : prop.customerAge,
      };
    }

    return prop;
  });

  if (testDataUsed) {
    (enriched as any)._usesTestData = true;
  }

  return enriched;
}

/**
 * Options for PDF generation
 */
export interface PDFGenerationOptions {
  includeQR?: boolean;
  includeCustomerData?: boolean;
  notes?: string;
  startLat?: number;
  startLon?: number;
}

/**
 * Generate a 3x3 grid route sheet PDF
 * Properties are optimized for route order and arranged in a 3x3 grid per page
 *
 * @param properties - Array of properties to include in the PDF
 * @param options - PDF generation options
 * @returns Promise that resolves when PDF is generated and saved
 */
export async function generateRouteSheet(
  properties: Property[],
  options: PDFGenerationOptions = {}
): Promise<void> {
  const {
    includeQR = true,
    includeCustomerData = true,
    startLat,
    startLon,
  } = options;

  // Input validation
  if (!properties || !Array.isArray(properties)) {
    throw new Error('Properties must be an array');
  }

  if (properties.length === 0) {
    throw new Error('At least one property is required to generate PDF');
  }

  // Validate each property has required fields
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    if (!prop || typeof prop !== 'object') {
      throw new Error(`Property at index ${i} is null or invalid`);
    }
    if (!prop.id) {
      throw new Error(`Property at index ${i} missing required field "id"`);
    }
    if (!prop.addressFull) {
      throw new Error(`Property ${prop.id} missing required field "addressFull"`);
    }
  }

  // Optimize route order
  const optimizedProperties = optimizeRoute(properties, startLat, startLon);

  // Enrich with test data if needed
  const enrichedProperties = enrichWithTestData(optimizedProperties);
  const usesTestData = (enrichedProperties as any)._usesTestData;

  // Group into pages of 9 (3x3 grid)
  const pages = groupIntoPages(enrichedProperties);

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
    doc.text('SCE2 Route Sheet', margin, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${pageIndex + 1} of ${pages.length} | Generated: ${new Date().toLocaleDateString()}`,
      margin,
      20
    );

    if (usesTestData && pageIndex === 0) {
      doc.setTextColor(200, 100, 100);
      doc.setFontSize(8);
      doc.text('*** CONTAINS TEST DATA ***', pageWidth - margin - 45, 20);
      doc.setTextColor(0);
    }

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

        // SMALL QR Code for mobile access (top-right corner)
        const qrSize = 20; // Much smaller QR code

        if (includeQR) {
          try {
            // Use mobile URL with query parameter for property ID
            const mobileUrl = getMobileUrl(`/?propertyId=${property.id}`);
            const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
              width: 80,
              margin: 1,
              errorCorrectionLevel: 'L',
            });

            const qrX = x + cellWidth - qrSize - 3;
            const qrY = y + 3;

            doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
          } catch (error) {
            console.error('Failed to generate QR code:', error);
          }
        }

        // Content positioning - account for QR code on right
        const xPos = x + 4;
        const contentWidth = includeQR ? cellWidth - qrSize - 6 : cellWidth - 8; // Leave room for QR code
        let yPos = y + 7;

        // Property number (smaller, in corner)
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`#${index + 1}`, xPos, yPos);
        yPos += 6;

        // Address (smaller to avoid QR code overlap)
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const addressLines = doc.splitTextToSize(property.addressFull, contentWidth);
        doc.text(addressLines, xPos, yPos);
        yPos += addressLines.length * 5 + 3;

        // Customer name (LARGER, below address)
        if (includeCustomerData && property.customerName) {
          doc.setFontSize(13);
          doc.setFont('helvetica', 'bold');
          doc.text(property.customerName, xPos, yPos);
          yPos += 7;
        }

        // Customer phone (LARGER, below name)
        if (includeCustomerData && property.customerPhone) {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          doc.text(property.customerPhone, xPos, yPos);
          doc.setTextColor(0);
          yPos += 7;
        } else if (!includeCustomerData) {
          yPos += 5;
        }

        // Age field (compact, on left)
        const ageFieldName = generateFieldName(property.id, 'age');
        const ageValue = property.customerAge?.toString() || '';
        addTextField(doc, 'AGE:', {
          name: ageFieldName,
          value: ageValue,
          x: xPos,
          y: yPos,
          width: 22,
          height: 8,
          fontSize: 10,
          maxLength: 3,
        });
        yPos += 12;

        // Notes field - FULL WIDTH of grid cell
        const notesFieldName = generateFieldName(property.id, 'notes');
        const remainingHeight = y + cellHeight - yPos - 14; // Leave room for dropdown
        addTextareaField(doc, 'NOTES:', {
          name: notesFieldName,
          value: property.fieldNotes || '',
          x: xPos,
          y: yPos,
          width: contentWidth, // FULL WIDTH - not avoiding QR code
          height: remainingHeight,
          fontSize: 9,
        });

        // Visit Status dropdown at bottom RIGHT with colored background
        const visitStatusFieldName = generateFieldName(property.id, 'visitStatus');
        const dropdownWidth = 50;
        const dropdownHeight = 8;
        const dropdownX = x + cellWidth - dropdownWidth - 4;
        const dropdownY = y + cellHeight - dropdownHeight - 4;

        // Draw colored background for dropdown area (light gray to stand out)
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(dropdownX - 2, dropdownY - 1, dropdownWidth + 4, dropdownHeight + 3, 2, 2, 'F');

        addComboBox(doc, 'STATUS:', {
          name: visitStatusFieldName,
          value: 'Not Visited',
          options: [
            'Not Visited',
            'At Home - Interested',
            'At Home - Not Interested',
            'No Answer',
            'Follow Up Required',
            'Complete',
          ],
          x: dropdownX,
          y: dropdownY,
          width: dropdownWidth,
          height: dropdownHeight,
          fontSize: 7,
        });
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
      `Page ${i} of ${totalPages} | Scan QR codes with mobile app`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
    doc.setTextColor(0);
  }

  // Save PDF with timestamp
  const timestamp = Date.now();
  doc.save(`sce2-route-${timestamp}.pdf`);
}

/**
 * Generate a PDF for a single property
 */
export async function generatePropertyPDF(
  property: Property,
  options: PDFGenerationOptions = {}
): Promise<void> {
  return generateRouteSheet([property], options);
}

/**
 * Export utilities
 */
export { calculateDistance, calculateTotalDistance, optimizeRoute } from './route-optimizer';
export type { Property } from '../types';
