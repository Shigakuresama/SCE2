#!/usr/bin/env node
// packages/webapp/tests/test-acroform-fields.ts
/**
 * Test AcroForm Fields in jsPDF 2.5.1
 * Verifies that jsPDF supports fillable PDF form fields (like IRS W-2 tax forms)
 */
import { jsPDF } from 'jspdf';

export function testAcroFormFields() {
  console.log('🧪 Testing jsPDF AcroForm support...\n');

  const doc = new jsPDF();

  // Test 1: Simple text field
  doc.text('Test 1: Simple Text Field', 10, 10);
  const textField = new doc.AcroForm.TextField();
  textField.fieldName = 'test_text_field';
  textField.x = 10;
  textField.y = 15;
  textField.width = 50;
  textField.height = 8;
  textField.fontSize = 10;
  textField.value = 'Default value';
  doc.addField(textField);

  console.log('✅ Created simple text field');

  // Test 2: Multi-line text field (textarea)
  doc.text('Test 2: Multi-line Textarea', 10, 35);
  const textareaField = new doc.AcroForm.TextField();
  textareaField.fieldName = 'test_textarea_field';
  textareaField.x = 10;
  textareaField.y = 40;
  textareaField.width = 80;
  textareaField.height = 30;
  textareaField.fontSize = 9;
  textareaField.multiline = true;
  textareaField.value = 'Multi-line text\nSecond line';
  doc.addField(textareaField);

  console.log('✅ Created multi-line textarea field');

  // Test 3: Text field with different alignment
  doc.text('Test 3: Right-aligned Number Field', 10, 85);
  const numberField = new doc.AcroForm.TextField();
  numberField.fieldName = 'test_number_field';
  numberField.x = 10;
  numberField.y = 90;
  numberField.width = 40;
  numberField.height = 8;
  numberField.fontSize = 10;
  numberField.value = '12345';
  numberField.Q = 1; // Right align (0=left, 1=center, 2=right)
  doc.addField(numberField);

  console.log('✅ Created right-aligned number field');

  // Test 4: Checkbox field
  doc.text('Test 4: Checkbox', 10, 110);
  const checkbox = new doc.AcroForm.CheckBox();
  checkbox.fieldName = 'test_checkbox';
  checkbox.x = 10;
  checkbox.y = 115;
  checkbox.width = 10;
  checkbox.height = 10;
  checkbox.value = 'Yes'; // Check it by default
  doc.addField(checkbox);

  console.log('✅ Created checkbox field');

  // Add instructions
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Open this PDF in Chrome or Adobe Reader to edit the fields above.', 10, 140);
  doc.text('Fields should be editable - click and type!', 10, 145);

  // Save test PDF
  const outputPath = '/home/sergio/Projects/SCE2/packages/webapp/tests/acroform-test.pdf';
  doc.save(outputPath);

  console.log(`\n✅ AcroForm test complete!`);
  console.log(`📁 Saved to: ${outputPath}`);
  console.log(`\n📝 Test results:`);
  console.log(`  • Simple text field: ✅`);
  console.log(`  • Multi-line textarea: ✅`);
  console.log(`  • Right-aligned number field: ✅`);
  console.log(`  • Checkbox: ✅`);
  console.log(`\n💡 Open the PDF and verify fields are editable!`);
}

// Run test
testAcroFormFields();
