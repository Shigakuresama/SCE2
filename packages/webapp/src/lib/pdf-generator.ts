// ============= PDF Generation =============
// Generate 3x3 grid route sheets with AGE/NOTES display fields and QR codes

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Property } from '../types';
import { getMobileUrl } from './config';
import { optimizeRoute, groupIntoPages } from './route-optimizer';
import { addTextField, addTextareaField, generateFieldName } from './acroform-fields';

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

        // Property number (small in corner)
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`#${index + 1}`, x + 3, y + 6);

        // Address (truncated if needed)
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const maxWidth = cellWidth - 50;
        const addressLines = doc.splitTextToSize(property.addressFull, maxWidth);
        const displayAddress = addressLines[0] || property.addressFull;

        // Add address
        doc.text(displayAddress.substring(0, 45), x + 3, y + 12);

        let yPos = y + 20;

        // Customer info
        if (includeCustomerData) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');

          if (property.customerName) {
            doc.text(`Name: ${property.customerName}`, x + 3, yPos);
            yPos += 4;
          }

          if (property.customerPhone) {
            doc.text(`Phone: ${property.customerPhone}`, x + 3, yPos);
            yPos += 4;
          }
        }

        // Fillable AGE field (AcroForm)
        const ageFieldName = generateFieldName(property.id, 'age');
        const ageValue = property.customerAge?.toString() || '';
        addTextField(doc, 'AGE:', {
          name: ageFieldName,
          value: ageValue,
          x: x + 3,
          y: yPos,
          width: 25,
          height: 8,
          fontSize: 10,
          maxLength: 3,
        });
        yPos += 14;

        // Fillable NOTES field (AcroForm textarea)
        const notesFieldName = generateFieldName(property.id, 'notes');
        const notesHeight = 28;
        const notesWidth = cellWidth - 48;
        addTextareaField(doc, 'NOTES:', {
          name: notesFieldName,
          value: property.fieldNotes || '',
          x: x + 3,
          y: yPos,
          width: notesWidth,
          height: notesHeight,
          fontSize: 8,
        });

        // QR Code for mobile access (right side of cell)
        if (includeQR) {
          try {
            // Use mobile URL with query parameter for property ID
            const mobileUrl = getMobileUrl(`/?propertyId=${property.id}`);
            const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
              width: 80,
              margin: 1,
              errorCorrectionLevel: 'L',
            });

            const qrSize = 35;
            const qrX = x + cellWidth - qrSize - 3;
            const qrY = y + 3;

            doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

            // "Scan" label below QR
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            const qrLabel = 'Scan me';
            const qrLabelWidth = (doc.getStringUnitWidth(qrLabel) * 6) / doc.internal.scaleFactor;
            doc.text(
              qrLabel,
              qrX + (qrSize - qrLabelWidth) / 2,
              qrY + qrSize + 3
            );
          } catch (error) {
            console.error('Failed to generate QR code:', error);
          }
        }

        // Status badge at bottom
        const statusColors: Record<string, [number, number, number]> = {
          'PENDING_SCRAPE': [150, 150, 150],
          'READY_FOR_FIELD': [59, 130, 246],
          'VISITED': [147, 51, 234],
          'READY_FOR_SUBMISSION': [245, 158, 11],
          'COMPLETE': [34, 197, 94],
          'FAILED': [239, 68, 68],
        };

        const [r, g, b] = statusColors[property.status] || [100, 100, 100];
        doc.setFillColor(r, g, b);
        doc.roundedRect(
          x + 3,
          y + cellHeight - 7,
          28,
          5,
          1,
          1,
          'F'
        );

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        const statusText = property.status.replace(/_/g, ' ').toLowerCase();
        doc.text(
          statusText,
          x + 4,
          y + cellHeight - 4
        );
        doc.setTextColor(0);
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
