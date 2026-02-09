#!/usr/bin/env npx tsx
/**
 * Test script: Simulates "Extract Customer Data" workflow
 *
 * Calls the batch-update API with mock addresses and customer data,
 * mimicking what the extension does after extracting from SCE.
 *
 * Usage:
 *   npx tsx scripts/test-extract.ts                          # localhost:3333
 *   npx tsx scripts/test-extract.ts https://sce2-cloud-server.onrender.com  # production
 */

const BASE_URL = process.argv[2] || 'http://localhost:3333';

const mockAddresses = [
  {
    addressFull: '1909 W Martha Ln, Santa Ana, CA 92706',
    customerName: 'Maria Garcia',
    customerPhone: '7145551234',
    dataExtracted: true,
    extractedAt: new Date().toISOString(),
  },
  {
    addressFull: '2015 N Broadway, Santa Ana, CA 92706',
    customerName: 'John Smith',
    customerPhone: '7145555678',
    dataExtracted: true,
    extractedAt: new Date().toISOString(),
  },
  {
    addressFull: '1500 E 17th St, Santa Ana, CA 92701',
    customerName: 'Ana Rodriguez',
    customerPhone: '7145559012',
    dataExtracted: true,
    extractedAt: new Date().toISOString(),
  },
];

async function main() {
  console.log(`\nTesting Extract Customer Data against: ${BASE_URL}\n`);

  // 1. Health check
  console.log('1. Health check...');
  try {
    const health = await fetch(`${BASE_URL}/api/health`);
    const healthData = await health.json();
    console.log(`   OK: ${JSON.stringify(healthData)}\n`);
  } catch (err) {
    console.error(`   FAIL: Server unreachable at ${BASE_URL}`);
    process.exit(1);
  }

  // 2. Batch update (simulates extension saving extracted data)
  console.log('2. POST /api/properties/batch-update (simulating extension)...');
  const batchRes = await fetch(`${BASE_URL}/api/properties/batch-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates: mockAddresses }),
  });

  if (!batchRes.ok) {
    console.error(`   FAIL: HTTP ${batchRes.status} - ${await batchRes.text()}`);
    process.exit(1);
  }

  const batchData = await batchRes.json();
  console.log(`   OK: ${batchData.data.successful}/${batchData.data.total} saved`);

  if (batchData.data.failed > 0) {
    console.log(`   WARNING: ${batchData.data.failed} failed:`);
    batchData.data.results
      .filter((r: any) => !r.success)
      .forEach((r: any) => console.log(`     - ${r.addressFull}: ${r.error}`));
  }

  // 3. Verify properties exist
  console.log('\n3. GET /api/properties (verifying saved data)...');
  const propsRes = await fetch(`${BASE_URL}/api/properties`);
  const propsData = await propsRes.json();
  const extracted = propsData.data?.filter((p: any) => p.dataExtracted) || [];
  console.log(`   OK: ${extracted.length} properties with extracted data`);

  for (const prop of extracted) {
    console.log(`   - ${prop.addressFull}: ${prop.customerName || '(no name)'} / ${prop.customerPhone || '(no phone)'}`);
  }

  console.log('\nTest complete!\n');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
