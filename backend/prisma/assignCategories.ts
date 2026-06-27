import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Maps Printful catalog product ID → storefront category name
const PRODUCT_CATEGORY_MAP: Record<number, string> = {
  // Women
  507: 'Women',   // All-Over Print Biker Shorts

  // Men
  1367: 'Men',    // All-Over Print Boxy Football Jersey
  918: 'Men',     // All-Over Print American Football Jersey
  770: 'Men',     // Unisex Adidas Space Dyed Polo Shirt
  655: 'Men',     // Unisex Adidas Premium Polo Shirt
  531: 'Men',     // Men's Adidas Quarter-Zip Pullover
  679: 'Men',     // Unisex Performance Crew Neck T-Shirt

  // Accessories
  458: 'Accessories',  // All-Over Print Beanie
  630: 'Accessories',  // All-Over Print Bandana
  279: 'Accessories',  // All-Over Print Backpack
  262: 'Accessories',  // All-Over Print Drawstring Bag
  605: 'Accessories',  // Rubber Case for AirPods
  638: 'Accessories',  // Adidas Dad Hat
  938: 'Accessories',  // Luggage Tag

  // Other
  89: 'Other',   // All-Over Print Basic Pillow Case
  83: 'Other',   // All-Over Print Basic Pillow
  793: 'Other',  // Acrylic Ornaments
  924: 'Other',  // Area Rug
};

async function main() {
  // Ensure all needed categories exist
  const categoryNames = ['Women', 'Men', 'Accessories', 'Shoes', 'Other'];
  const categoryIds: Record<string, number> = {};

  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: { status: 'Active' },
      create: { name, status: 'Active' },
    });
    categoryIds[name] = cat.id;
    console.log(`Category "${name}" id=${cat.id}`);
  }

  // Update each Printful catalog product
  for (const [printfulId, categoryName] of Object.entries(PRODUCT_CATEGORY_MAP)) {
    const slug = `pf-cat-${printfulId}-`;
    const products = await prisma.product.findMany({
      where: { slug: { startsWith: slug } },
      select: { id: true, slug: true },
    });

    for (const p of products) {
      await prisma.product.update({
        where: { id: p.id },
        data: { categoryId: categoryIds[categoryName] },
      });
      console.log(`  ${p.slug} → ${categoryName}`);
    }
  }

  console.log('Done.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
