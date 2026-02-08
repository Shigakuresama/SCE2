// ============= PDF Generation =============
// Complete rewrite with all requirements:
// - Editable phone number with "Corrected" checkbox
// - Global property numbering (continues across pages)
// - Small dropdown at bottom right
// - Improved aesthetics

import jsPDF from 'jspdf';
// @ts-ignore - qrcode CommonJS module
import * as QRCodeNS from 'qrcode';
const QRCode = (QRCodeNS as any).default || QRCodeNS;
import type { Property } from '../types';
import { getMobileUrl } from './config';
import { optimizeRoute, groupIntoPages } from './route-optimizer';
import { addTextField, addTextareaField, addComboBox, addCheckbox, generateFieldName } from './acroform-fields';

/**
 * Test customer data for PDF generation
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

export interface PDFGenerationOptions {
  includeQR?: boolean;
  includeCustomerData?: boolean;
  notes?: string;
  startLat?: number;
  startLon?: number;
}

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

  if (!properties || !Array.isArray(properties)) {
    throw new Error('Properties must be an array');
  }

  if (properties.length === 0) {
    throw new Error('At least one property is required to generate PDF');
  }

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

  const optimizedProperties = optimizeRoute(properties, startLat, startLon);
  const enrichedProperties = enrichWithTestData(optimizedProperties);
  const usesTestData = (enrichedProperties as any)._usesTestData;
  const pages = groupIntoPages(enrichedProperties);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const headerHeight = 25;

  // Track global property index for continuing numbering across pages
  let globalPropertyIndex = 0;

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
      `Page ${pageIndex + 1} of ${pages.length} | ${new Date().toLocaleDateString()}`,
      margin,
      20
    );

    if (usesTestData && pageIndex === 0) {
      doc.setTextColor(200, 100, 100);
      doc.setFontSize(8);
      doc.text('*** CONTAINS TEST DATA ***', pageWidth - margin - 45, 20);
      doc.setTextColor(0);
    }

    if (usesTestData && pageIndex === 0) {
      doc.setTextColor(200, 100, 100);
      doc.setFontSize(7);
      doc.text('*** TEST DATA ***', pageWidth - margin - 30, 20);
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

        if (!property) {
          globalPropertyIndex++;
          continue;
        }

        const x = margin + col * cellWidth;
        const y = headerHeight + row * cellHeight;

        // Draw cell border with subtle styling
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.5);
        doc.rect(x, y, cellWidth, cellHeight);

        // QR Code (small, top-right)
        const qrSize = 12;

        if (includeQR) {
          try {
            const mobileUrl = getMobileUrl(`/?propertyId=${property.id}`);
            const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
              width: 80,
              margin: 1,
              errorCorrectionLevel: 'L',
            });

            doc.addImage(qrDataUrl, 'PNG', x + cellWidth - qrSize - 2, y + 2, qrSize, qrSize);
          } catch (error) {
            console.error('Failed to generate QR code:', error);
          }
        }

        const xPos = x + 4;
        const contentWidth = includeQR ? cellWidth - qrSize - 6 : cellWidth - 8;
        let yPos = y + 7;

        // Property number (GLOBAL - continues across pages)
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`#${globalPropertyIndex + 1}`, xPos, yPos);
        yPos += 5;

        // Address
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const addressLines = doc.splitTextToSize(property.addressFull, contentWidth);
        doc.text(addressLines, xPos, yPos);
        yPos += addressLines.length * 4 + 2;

        // Customer name
        if (includeCustomerData && property.customerName) {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(property.customerName, xPos, yPos);
          yPos += 5;
        }

        // Phone number - EDITABLE with checkbox
        if (includeCustomerData && property.customerPhone) {
          const phoneFieldName = generateFieldName(property.id, 'phone');
          addTextField(doc, '', {
            name: phoneFieldName,
            value: property.customerPhone,
            x: xPos,
            y: yPos,
            width: 45,
            height: 6,
            fontSize: 9,
            maxLength: 20,
          });

          const phoneCheckboxName = generateFieldName(property.id, 'phoneCorrected');
          addCheckbox(doc, {
            name: phoneCheckboxName,
            value: false,
            x: xPos + 48,
            y: yPos + 1,
            width: 4,
            height: 4,
          });

          yPos += 9;
        } else if (!includeCustomerData) {
          yPos += 4;
        }

        // Age field (compact, label on left)
        const ageFieldName = generateFieldName(property.id, 'age');
        const ageValue = property.customerAge?.toString() || '';
        addTextField(doc, 'AGE:', {
          name: ageFieldName,
          value: ageValue,
          x: xPos,
          y: yPos,
          width: 18,
          height: 6,
          fontSize: 8,
          maxLength: 3,
          labelPosition: 'left',
        });
        yPos += 10;

        // Notes field - FULL WIDTH (extends under QR code area)
        const notesFieldName = generateFieldName(property.id, 'notes');
        const notesHeight = y + cellHeight - yPos - 8;
        addTextareaField(doc, 'NOTES:', {
          name: notesFieldName,
          value: property.fieldNotes || '',
          x: x + 2,
          y: yPos,
          width: cellWidth - 4,
          height: notesHeight,
          fontSize: 8,
        });

        // Small status dropdown at bottom right
        const visitStatusFieldName = generateFieldName(property.id, 'visitStatus');
        const dropdownWidth = 32;
        const dropdownHeight = 5;
        const dropdownX = x + cellWidth - dropdownWidth - 4;
        const dropdownY = y + cellHeight - dropdownHeight - 3;

        addComboBox(doc, '', {
          name: visitStatusFieldName,
          value: 'Pending',
          options: ['Pending', 'No Home', 'Not Int\'d', 'Follow', 'Done'],
          x: dropdownX,
          y: dropdownY,
          width: dropdownWidth,
          height: dropdownHeight,
          fontSize: 5,
        });

        globalPropertyIndex++;
      }
    }
  }

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text(
      `SCE2 Rebate Automation • Scan QR codes with mobile app`,
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' }
    );
    doc.setTextColor(0);
  }

  const timestamp = Date.now();
  doc.save(`sce2-route-${timestamp}.pdf`);
}

export async function generatePropertyPDF(
  property: Property,
  options: PDFGenerationOptions = {}
): Promise<void> {
  return generateRouteSheet([property], options);
}

export { calculateDistance, calculateTotalDistance, optimizeRoute } from './route-optimizer';
export type { Property } from '../types';
