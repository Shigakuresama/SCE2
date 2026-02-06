// ============= PDF Generation =============
// Generate route sheets with property details and QR codes for mobile access

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Property } from '../types';
import { getCloudUrl } from './config';

/**
 * Options for PDF generation
 */
export interface PDFGenerationOptions {
  includeQR?: boolean;
  includeCustomerData?: boolean;
  notes?: string;
}

/**
 * Generate a route sheet PDF for multiple properties
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
    notes = '',
  } = options;

  // Create PDF document (portrait, millimeters, A4)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Add header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SCE2 Route Sheet', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    margin,
    yPosition
  );
  yPosition += 6;
  doc.text(`Total Properties: ${properties.length}`, margin, yPosition);
  yPosition += 10;

  // Add notes section if provided
  if (notes.trim()) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin, yPosition);
    yPosition += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Word wrap for notes
    const lines = doc.splitTextToSize(notes, pageWidth - 2 * margin);
    doc.text(lines, margin, yPosition);
    yPosition += lines.length * 5 + 10;
  }

  // Add properties
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];

    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = margin;
    }

    // Draw separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Property number and address
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Property ${i + 1}:`, margin, yPosition);
    yPosition += 7;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(
      property.addressFull,
      pageWidth - 2 * margin
    );
    doc.text(addressLines, margin, yPosition);
    yPosition += addressLines.length * 6 + 5;

    // Customer data if requested and available
    if (includeCustomerData) {
      if (property.customerName) {
        doc.setFontSize(10);
        doc.text(`Customer: ${property.customerName}`, margin, yPosition);
        yPosition += 5;
      }

      if (property.customerPhone) {
        doc.text(`Phone: ${property.customerPhone}`, margin, yPosition);
        yPosition += 5;
      }

      if (property.customerAge) {
        doc.text(`Age: ${property.customerAge}`, margin, yPosition);
        yPosition += 5;
      }
    }

    // Field notes if available
    if (property.fieldNotes) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      const noteLines = doc.splitTextToSize(
        `Field Notes: ${property.fieldNotes}`,
        pageWidth - 2 * margin - (includeQR ? 40 : 0)
      );
      doc.text(noteLines, margin, yPosition);
      yPosition += noteLines.length * 5 + 5;
      doc.setFont('helvetica', 'normal');
    }

    // Status
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Status: ${property.status}`, margin, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');

    // Document count if documents exist
    if (property.documents && property.documents.length > 0) {
      doc.text(
        `Documents: ${property.documents.length} attached`,
        margin,
        yPosition
      );
      yPosition += 5;
    }

    // QR Code for mobile access
    if (includeQR) {
      try {
        const mobileUrl = getCloudUrl(`/mobile/${property.id}`);
        const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
          width: 100,
          margin: 1,
          errorCorrectionLevel: 'L',
        });

        // Add QR code to the right side
        const qrSize = 30;
        const xPosition = pageWidth - margin - qrSize;
        const qrYPosition = yPosition - 20; // Position near the property info

        doc.addImage(qrDataUrl, 'PNG', xPosition, qrYPosition, qrSize, qrSize);

        // Add "Scan for mobile" text below QR
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const qrLabel = 'Scan for mobile';
        const qrLabelWidth =
          (doc.getStringUnitWidth(qrLabel) * 8) / doc.internal.scaleFactor;
        doc.text(
          qrLabel,
          xPosition + (qrSize - qrLabelWidth) / 2,
          qrYPosition + qrSize + 4
        );
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      }
    }

    yPosition += 10;
  }

  // Add page numbers footer
  const totalPages = doc.internal.pages.length - 1; // jsPDF adds an extra page at index 0
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF with timestamp
  const timestamp = Date.now();
  doc.save(`sce2-route-${timestamp}.pdf`);
}

/**
 * Generate a PDF for a single property
 *
 * @param property - Property to generate PDF for
 * @param options - PDF generation options
 * @returns Promise that resolves when PDF is generated and saved
 */
export async function generatePropertyPDF(
  property: Property,
  options: PDFGenerationOptions = {}
): Promise<void> {
  return generateRouteSheet([property], options);
}
