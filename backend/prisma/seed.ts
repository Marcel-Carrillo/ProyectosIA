import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const women = await prisma.category.upsert({
    where: { name: 'Women' },
    update: {},
    create: { name: 'Women', description: 'Women\'s clothing', status: 'Active' },
  });

  const accessories = await prisma.category.upsert({
    where: { name: 'Accessories' },
    update: {},
    create: { name: 'Accessories', description: 'Fashion accessories', status: 'Active' },
  });

  const dress = await prisma.product.upsert({
    where: { slug: 'black-midi-dress' },
    update: {},
    create: {
      name: 'Black Midi Dress',
      slug: 'black-midi-dress',
      description: 'An elegant black midi dress perfect for any occasion.',
      brand: 'Zara',
      status: 'Active',
      categoryId: women.id,
      mainImageUrl: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600',
      variants: {
        create: [
          { sku: 'BMD-S-BLK', size: 'S', color: 'Black', publicPrice: 49.99, compareAtPrice: 69.99, stockPolicy: 'TRACK', status: 'Active' },
          { sku: 'BMD-M-BLK', size: 'M', color: 'Black', publicPrice: 49.99, compareAtPrice: 69.99, stockPolicy: 'TRACK', status: 'Active' },
          { sku: 'BMD-L-BLK', size: 'L', color: 'Black', publicPrice: 49.99, compareAtPrice: 69.99, stockPolicy: 'TRACK', status: 'Active' },
        ],
      },
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600', altText: 'Black Midi Dress front', sortOrder: 0 },
          { url: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400', altText: 'Black Midi Dress detail', sortOrder: 1 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { slug: 'linen-blazer-ecru' },
    update: {},
    create: {
      name: 'Linen Blazer',
      slug: 'linen-blazer-ecru',
      description: 'Tailored linen blazer in ecru, ideal for warmer months.',
      brand: 'Massimo Dutti',
      status: 'Active',
      categoryId: women.id,
      mainImageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600',
      variants: {
        create: [
          { sku: 'LBE-S-ECR', size: 'S', color: 'Ecru', publicPrice: 89.99, stockPolicy: 'TRACK', status: 'Active' },
          { sku: 'LBE-M-ECR', size: 'M', color: 'Ecru', publicPrice: 89.99, stockPolicy: 'TRACK', status: 'Active' },
        ],
      },
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600', altText: 'Linen Blazer Ecru', sortOrder: 0 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { slug: 'leather-belt-tan' },
    update: {},
    create: {
      name: 'Leather Belt',
      slug: 'leather-belt-tan',
      description: 'Classic tan leather belt with a gold buckle.',
      brand: 'Zara',
      status: 'Active',
      categoryId: accessories.id,
      mainImageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
      variants: {
        create: [
          { sku: 'LBT-S-TAN', size: 'S', color: 'Tan', publicPrice: 29.99, stockPolicy: 'TRACK', status: 'Active' },
          { sku: 'LBT-M-TAN', size: 'M', color: 'Tan', publicPrice: 29.99, stockPolicy: 'TRACK', status: 'Active' },
        ],
      },
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600', altText: 'Leather Belt Tan', sortOrder: 0 },
        ],
      },
    },
  });

  console.log('Seed complete. Categories:', women.id, accessories.id, '| Products:', dress.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
