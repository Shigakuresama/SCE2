// Generate test PDF with actual properties from API
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

async function generateTestPDF() {
  console.log('🧪 Generating Test PDF with QR Codes\n');

  // Fetch properties from API
  const response = await fetch('http://localhost:3333/api/properties');
  const result = await response.json();

  if (!result.success) {
    console.error('❌ Failed to fetch properties');
    return;
  }

  const properties = result.data.slice(0, 5); // Use first 5 properties
  console.log(`📋 Using ${properties.length} properties\n`);

  // Create PDF - fix for CommonJS/ESM interop
  const { default: jsPDFClass } = await import('jspdf');
  const doc = new jsPDFClass({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SCE2 Route Sheet', margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 5;
  doc.text(`Properties: ${properties.length}`, margin, y);
  y += 10;

  // Properties with QR codes
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];

    // Check if we need a new page
    if (y > 200) {
      doc.addPage();
      y = margin;
    }

    // Property number and address
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}. ${prop.addressFull}`, margin, y);
    y += 7;

    // Property details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const details = [
      `ID: ${prop.id}`,
      prop.customerName ? `Customer: ${prop.customerName}` : 'Customer: Not scraped',
      prop.customerPhone ? `Phone: ${prop.customerPhone}` : 'Phone: Not scraped',
      `Status: ${prop.status}`
    ];

    details.forEach(detail => {
      doc.text(detail, margin + 5, y);
      y += 5;
    });

    // Generate QR code for mobile access
    const mobileUrl = `http://localhost:3333/mobile/${prop.id}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
        width: 100,
        margin: 1,
        errorCorrectionLevel: 'L'
      });

      // Add QR code to PDF
      doc.addImage(qrDataUrl, 'PNG', pageWidth - 35, y - 15, 25, 25);
      doc.setFontSize(7);
      doc.text('Scan for mobile', pageWidth - 35, y + 12);
    } catch (err) {
      console.error(`  ❌ QR code generation failed for property ${prop.id}:`, err.message);
    }

    y += 30;

    // Separator line
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  }

  // Save PDF
  const filename = '/tmp/sce2-test-route-sheet.pdf';
  doc.save(filename);
  console.log(`\n✅ PDF generated: ${filename}`);

  // Test QR code URLs
  console.log('\n🔍 QR Code URLs Generated:');
  properties.forEach(p => {
    const url = `http://localhost:3333/mobile/${p.id}`;
    console.log(`  Property ${p.id}: ${url}`);
  });

  // Test mobile endpoints
  console.log('\n🌐 Testing Mobile Endpoints:');
  for (const p of properties) {
    const url = `http://localhost:3333/mobile/${p.id}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`  ✅ Property ${p.id}: ${res.status}`);
      } else {
        console.log(`  ⚠️  Property ${p.id}: ${res.status} (endpoint may not exist yet)`);
      }
    } catch (err) {
      console.log(`  ❌ Property ${p.id}: ${err.message}`);
    }
  }

  console.log('\n✅ Test Complete!');
  console.log(`\n📄 PDF saved to: ${filename}`);
  console.log('   You can open it with: xdg-open /tmp/sce2-test-route-sheet.pdf');
}

generateTestPDF().catch(console.error);
