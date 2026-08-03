import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.toLowerCase().trim();
  await prisma.adminUser.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash,
      status: 'Active',
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      status: 'Active',
    },
  });
  console.log(`Admin user seeded for ${normalizedEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
