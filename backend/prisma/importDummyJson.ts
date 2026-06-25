import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_MAP: Record<string, string> = {
  smartphones: 'Electronics',
  laptops: 'Electronics',
  tablets: 'Electronics',
  'mobile-accessories': 'Electronics',
  'womens-dresses': 'Women',
  'womens-tops': 'Women',
  'womens-bags': 'Women',
  'womens-watches': 'Women',
  'womens-jewellery': 'Women',
  'mens-shirts': 'Men',
  'mens-watches': 'Men',
  'mens-jackets': 'Men',
  'womens-shoes': 'Shoes',
  'mens-shoes': 'Shoes',
};

interface DummyProduct {
  id: number;
  title: string;
  description: string;
  price: number;
  discountPercentage: number;
  brand: string;
  category: string;
  thumbnail: string;
  images: string[];
}

function toSlug(id: number, title: string): string {
  return `djson-${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50)}`;
}

async function main() {
  // 1. Soft-delete old junk products (brand IS NULL — importación EscuelaJS)
  const hidden = await prisma.product.updateMany({
    where: { brand: null },
    data: { status: 'Inactive', deletedAt: new Date() },
  });
  console.log(`Hidden ${hidden.count} old products (brand=null)`);

  // 2. Ensure target categories exist
  const TARGET_CATEGORIES = ['Women', 'Men', 'Electronics', 'Shoes'];
  const categoryIds = new Map<string, number>();

  for (const name of TARGET_CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: { status: 'Active' },
      create: { name, status: 'Active' },
    });
    categoryIds.set(name, cat.id);
  }
  console.log('Categories:', Object.fromEntries(categoryIds));

  // 3. Fetch all products from DummyJSON
  const res = await fetch('https://dummyjson.com/products?limit=200');
  const json = (await res.json()) as { products: DummyProduct[] };
  console.log(`Fetched ${json.products.length} products from DummyJSON`);

  // 4. Import relevant products
  let imported = 0;
  let skipped = 0;

  for (const p of json.products) {
    const targetCat = CATEGORY_MAP[p.category];
    if (!targetCat) { skipped++; continue; }

    const categoryId = categoryIds.get(targetCat)!;
    const slug = toSlug(p.id, p.title);
    const compareAtPrice =
      p.discountPercentage > 0
        ? Math.round((p.price / (1 - p.discountPercentage / 100)) * 100) / 100
        : null;

    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: p.title,
          description: p.description,
          brand: p.brand || targetCat,
          mainImageUrl: p.thumbnail,
          categoryId,
          status: 'Active',
          deletedAt: null,
        },
      });
      await prisma.productVariant.deleteMany({ where: { productId: existing.id } });
      await prisma.productImage.deleteMany({ where: { productId: existing.id } });
      await prisma.productVariant.create({
        data: {
          productId: existing.id,
          sku: `DJSON-${p.id}`,
          size: null,
          color: null,
          publicPrice: p.price,
          compareAtPrice,
          stockPolicy: 'SupplierManaged',
          status: 'Active',
        },
      });
      await prisma.productImage.createMany({
        data: p.images.slice(0, 4).map((url, i) => ({
          productId: existing.id,
          url,
          altText: p.title,
          sortOrder: i,
        })),
      });
    } else {
      await prisma.product.create({
        data: {
          name: p.title,
          slug,
          description: p.description,
          brand: p.brand || targetCat,
          mainImageUrl: p.thumbnail,
          categoryId,
          status: 'Active',
          variants: {
            create: [{
              sku: `DJSON-${p.id}`,
              size: null,
              color: null,
              publicPrice: p.price,
              compareAtPrice,
              stockPolicy: 'SupplierManaged',
              status: 'Active',
            }],
          },
          images: {
            create: p.images.slice(0, 4).map((url, i) => ({
              url,
              altText: p.title,
              sortOrder: i,
            })),
          },
        },
      });
    }

    imported++;
  }

  console.log(`Done. Imported: ${imported} | Skipped (wrong category): ${skipped}`);

  // 5. Summary by category
  for (const [name, id] of categoryIds) {
    const count = await prisma.product.count({ where: { categoryId: id, status: 'Active' } });
    console.log(`  ${name}: ${count} active products`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
