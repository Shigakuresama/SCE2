import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Example: Create a sample route
  // const route = await prisma.route.create({
  //   data: {
  //     name: 'Sample Route',
  //     description: 'A sample route for testing',
  //   },
  // });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
