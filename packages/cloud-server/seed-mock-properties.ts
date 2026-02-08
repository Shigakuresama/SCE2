/**
 * Seed script for testing fillable PDF fields
 * Creates mock properties with customer data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMockProperties() {
  console.log('Seeding mock properties for PDF testing...');

  // Mock properties with coordinates in Santa Ana, CA
  const mockProperties = [
    {
      addressFull: '1909 W Martha Ln, Santa Ana, CA 92706',
      zipCode: '92706',
      latitude: 33.7455,
      longitude: -117.8813,
      status: 'READY_FOR_FIELD',
      customerName: 'Maria Garcia',
      customerPhone: '7145550101',
      customerAge: 45,
      fieldNotes: 'Interested in insulation. Has central HVAC from 2015.',
    },
    {
      addressFull: '123 Main St, Santa Ana, CA 92705',
      zipCode: '92705',
      latitude: 33.7527,
      longitude: -117.8637,
      status: 'READY_FOR_FIELD',
      customerName: 'Chen Wei',
      customerPhone: '7145550102',
      customerAge: 52,
      fieldNotes: 'Owner is interested in whole home upgrade. Roof is 3 years old.',
    },
    {
      addressFull: '456 Oak Ave, Santa Ana, CA 92704',
      zipCode: '92704',
      latitude: 33.7385,
      longitude: -117.8912,
      status: 'READY_FOR_FIELD',
      customerName: 'James Johnson',
      customerPhone: '7145550103',
      customerAge: 38,
      fieldNotes: 'Renter. Needs landlord approval. Ask about window AC units.',
    },
    {
      addressFull: '789 Pine Rd, Santa Ana, CA 92703',
      zipCode: '92703',
      latitude: 33.7602,
      longitude: -117.8724,
      status: 'READY_FOR_FIELD',
      customerName: 'Sarah Williams',
      customerPhone: '7145550104',
      customerAge: 62,
      fieldNotes: 'Senior citizen. Income qualified. Has wall AC only.',
    },
    {
      addressFull: '321 Elm St, Santa Ana, CA 92702',
      zipCode: '92702',
      latitude: 33.7448,
      longitude: -117.8689,
      status: 'READY_FOR_FIELD',
      customerName: 'Miguel Rodriguez',
      customerPhone: '7145550105',
      customerAge: 41,
      fieldNotes: 'Spanish speaking. Works from home. Needs attic insulation.',
    },
    {
      addressFull: '654 Maple Dr, Santa Ana, CA 92701',
      zipCode: '92701',
      latitude: 33.7369,
      longitude: -117.8845,
      status: 'READY_FOR_FIELD',
      customerName: 'Lisa Chen',
      customerPhone: '7145550106',
      customerAge: 35,
      fieldNotes: 'First-time homebuyer. Budget conscious. Prioritizes cooling.',
    },
    {
      addressFull: '987 Cedar Ln, Santa Ana, CA 92706',
      zipCode: '92706',
      latitude: 33.7501,
      longitude: -117.8789,
      status: 'READY_FOR_FIELD',
      customerName: 'Robert Kim',
      customerPhone: '7145550107',
      customerAge: 48,
      fieldNotes: 'Engineer. Asks technical questions. Wants data on ROI.',
    },
    {
      addressFull: '147 Birch Blvd, Santa Ana, CA 92705',
      zipCode: '92705',
      latitude: 33.7472,
      longitude: -117.8657,
      status: 'READY_FOR_FIELD',
      customerName: 'Emily Davis',
      customerPhone: '7145550108',
      customerAge: 29,
      fieldNotes: 'Young family with 2 kids. Safety conscious. Ask about window upgrades.',
    },
    {
      addressFull: '258 Walnut Way, Santa Ana, CA 92704',
      zipCode: '92704',
      latitude: 33.7615,
      longitude: -117.8734,
      status: 'READY_FOR_FIELD',
      customerName: 'David Martinez',
      customerPhone: '7145550109',
      customerAge: 55,
      fieldNotes: 'Contractor referral. Knowledgeable about construction. Wants multiple quotes.',
    },
  ];

  for (const prop of mockProperties) {
    try {
      const created = await prisma.property.upsert({
        where: { addressFull: prop.addressFull },
        update: prop,
        create: prop,
      });
      console.log(`✅ Created/updated property: ${prop.addressFull}`);
    } catch (error) {
      console.error(`❌ Failed to create property: ${prop.addressFull}`, error);
    }
  }

  console.log('\n✅ Seeding complete!');
  console.log(`📊 Created ${mockProperties.length} mock properties`);

  await prisma.$disconnect();
}

seedMockProperties().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
