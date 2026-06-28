import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.coupon.upsert({
    where: { code: 'BIENVENIDA15' },
    update: { active: true, type: 'percentage', value: 15, maxUses: null },
    create: {
      code: 'BIENVENIDA15',
      type: 'percentage',
      value: 15,
      minOrderAmount: 0,
      maxUses: null,
      active: true,
      startsAt: new Date(),
    },
  });
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minOrderAmount: 0,
      maxUses: 1000,
      active: true,
    },
  });
  console.log('Coupons seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
