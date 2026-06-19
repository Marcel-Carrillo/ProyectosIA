const id = Number(process.argv[2]);
if (!id) {
  console.error('Usage: node scripts/delete-customer-order.js <id>');
  process.exit(1);
}
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
prisma.customerOrder
  .delete({ where: { id } })
  .then(() => console.log('deleted', id))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
