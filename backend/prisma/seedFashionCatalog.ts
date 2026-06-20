import { PrismaClient } from '@prisma/client';

type FashionVariant = {
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  compareAtPrice?: number | null;
};

type FashionProduct = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  images: { url: string; altText: string; sortOrder: number }[];
  variants: FashionVariant[];
};

const FASHION_PRODUCTS: FashionProduct[] = [
  {
    slug: 'wool-coat-camel',
    name: 'Wool Coat Camel',
    brand: 'Mavile',
    category: 'Women',
    description: 'Italian virgin wool coat in camel. Cupro lining, oversized cut and structured lapels.',
    images: [
      { url: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=1400&q=80', altText: 'Wool Coat Camel front', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=1400&q=80', altText: 'Wool Coat Camel detail', sortOrder: 1 },
      { url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1400&q=80', altText: 'Wool Coat Camel side', sortOrder: 2 },
    ],
    variants: [
      { sku: 'MVL-COAT-CAM-S', size: 'S', color: 'Camel', publicPrice: 289 },
      { sku: 'MVL-COAT-CAM-M', size: 'M', color: 'Camel', publicPrice: 289 },
      { sku: 'MVL-COAT-CAM-L', size: 'L', color: 'Camel', publicPrice: 289 },
    ],
  },
  {
    slug: 'poplin-shirt-white',
    name: 'Poplin Shirt White',
    brand: 'Mavile',
    category: 'Women',
    description: 'Relaxed organic cotton poplin shirt with French cuffs and classic collar.',
    images: [
      { url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1400&q=80', altText: 'Poplin Shirt White', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1564859228273-274232fdb516?auto=format&fit=crop&w=1400&q=80', altText: 'Poplin Shirt White folded', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-SHIRT-WHT-S', size: 'S', color: 'White', publicPrice: 95 },
      { sku: 'MVL-SHIRT-WHT-M', size: 'M', color: 'White', publicPrice: 95 },
    ],
  },
  {
    slug: 'tailored-trouser-grey',
    name: 'Tailored Trouser Grey',
    brand: 'Mavile',
    category: 'Women',
    description: 'Pleated cold wool trouser with fluid drape and high waist.',
    images: [
      { url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=1400&q=80', altText: 'Tailored Trouser Grey', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1548883354-94bcfe321cbb?auto=format&fit=crop&w=1400&q=80', altText: 'Tailored Trouser Grey detail', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-TRSR-GRY-36', size: '36', color: 'Stone', publicPrice: 145 },
      { sku: 'MVL-TRSR-GRY-38', size: '38', color: 'Stone', publicPrice: 145 },
    ],
  },
  {
    slug: 'cashmere-jumper-natural',
    name: 'Cashmere Jumper Natural',
    brand: 'Mavile',
    category: 'Women',
    description: 'Fine-gauge Mongolian cashmere crew neck with raw edge finish.',
    images: [
      { url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1400&q=80', altText: 'Cashmere Jumper Natural', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?auto=format&fit=crop&w=1400&q=80', altText: 'Cashmere Jumper Natural texture', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-JMP-NAT-S', size: 'S', color: 'Natural', publicPrice: 215 },
      { sku: 'MVL-JMP-NAT-M', size: 'M', color: 'Natural', publicPrice: 215 },
    ],
  },
  {
    slug: 'linen-midi-dress',
    name: 'Linen Midi Dress',
    brand: 'Mavile',
    category: 'Women',
    description: 'Belgian linen midi dress with fine straps and side slit.',
    images: [
      { url: 'https://images.unsplash.com/photo-1572804013427-4d7ca7268217?auto=format&fit=crop&w=1400&q=80', altText: 'Linen Midi Dress', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1400&q=80', altText: 'Linen Midi Dress movement', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-DRS-LIN-S', size: 'S', color: 'Natural', publicPrice: 175 },
      { sku: 'MVL-DRS-LIN-M', size: 'M', color: 'Natural', publicPrice: 175 },
    ],
  },
  {
    slug: 'oversized-blazer-black',
    name: 'Oversized Blazer Black',
    brand: 'Mavile',
    category: 'Men',
    description: 'Double-breasted blazer with structured shoulders. Made in Portugal.',
    images: [
      { url: 'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?auto=format&fit=crop&w=1400&q=80', altText: 'Oversized Blazer Black', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=1400&q=80', altText: 'Oversized Blazer Black detail', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-BLZ-BLK-M', size: 'M', color: 'Black', publicPrice: 245 },
      { sku: 'MVL-BLZ-BLK-L', size: 'L', color: 'Black', publicPrice: 245 },
    ],
  },
  {
    slug: 'heavyweight-tee-white',
    name: 'Heavyweight Tee White',
    brand: 'Mavile',
    category: 'Men',
    description: '240gsm organic cotton jersey tee with boxy cut and reinforced collar.',
    images: [
      { url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=80', altText: 'Heavyweight Tee White', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1400&q=80', altText: 'Heavyweight Tee White flat', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-TEE-WHT-M', size: 'M', color: 'White', publicPrice: 55 },
      { sku: 'MVL-TEE-WHT-L', size: 'L', color: 'White', publicPrice: 55 },
    ],
  },
  {
    slug: 'chino-trouser-sand',
    name: 'Chino Trouser Sand',
    brand: 'Mavile',
    category: 'Men',
    description: 'Straight-leg cotton gabardine chino with raw hem.',
    images: [
      { url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1400&q=80', altText: 'Chino Trouser Sand', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1400&q=80', altText: 'Chino Trouser Sand detail', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-CHN-SND-32', size: '32', color: 'Sand', publicPrice: 125 },
      { sku: 'MVL-CHN-SND-34', size: '34', color: 'Sand', publicPrice: 125 },
    ],
  },
  {
    slug: 'leather-sneaker-white',
    name: 'Leather Sneaker White',
    brand: 'Mavile',
    category: 'Men',
    description: 'Minimal nappa leather sneaker with natural rubber sole.',
    images: [
      { url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1400&q=80', altText: 'Leather Sneaker White', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=1400&q=80', altText: 'Leather Sneaker White side', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-SNK-WHT-42', size: '42', color: 'White', publicPrice: 195 },
      { sku: 'MVL-SNK-WHT-43', size: '43', color: 'White', publicPrice: 195 },
    ],
  },
  {
    slug: 'leather-tote-bag',
    name: 'Leather Tote Bag',
    brand: 'Mavile',
    category: 'Accessories',
    description: 'Vegetable-tanned nappa leather tote with zippered interior pocket.',
    images: [
      { url: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1400&q=80', altText: 'Leather Tote Bag', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1400&q=80', altText: 'Leather Tote Bag detail', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-TOTE-COG', size: null, color: 'Cognac', publicPrice: 320 },
      { sku: 'MVL-TOTE-BLK', size: null, color: 'Black', publicPrice: 320 },
    ],
  },
  {
    slug: 'classic-leather-belt',
    name: 'Classic Leather Belt',
    brand: 'Mavile',
    category: 'Accessories',
    description: 'Italian leather belt with brushed brass buckle.',
    images: [
      { url: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=1400&q=80', altText: 'Classic Leather Belt', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=1400&q=80', altText: 'Classic Leather Belt buckle', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-BLT-BLK-90', size: '90', color: 'Black', publicPrice: 85 },
      { sku: 'MVL-BLT-COG-90', size: '90', color: 'Cognac', publicPrice: 85 },
    ],
  },
  {
    slug: 'acetate-sunglasses',
    name: 'Acetate Sunglasses',
    brand: 'Mavile',
    category: 'Accessories',
    description: 'Italian acetate sunglasses with gradient mineral lenses.',
    images: [
      { url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1400&q=80', altText: 'Acetate Sunglasses', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=1400&q=80', altText: 'Acetate Sunglasses profile', sortOrder: 1 },
    ],
    variants: [
      { sku: 'MVL-SUN-TORT', size: null, color: 'Tortoise', publicPrice: 165 },
    ],
  },
];

export interface SeedFashionResult {
  categories: number;
  products: number;
}

export async function seedFashionCatalog(prisma: PrismaClient): Promise<SeedFashionResult> {
  const categoryIds = new Map<string, number>();

  for (const name of ['Women', 'Men', 'Accessories']) {
    const category = await prisma.category.upsert({
      where: { name },
      update: { status: 'Active' },
      create: { name, status: 'Active' },
    });
    categoryIds.set(name, category.id);
  }

  let products = 0;

  for (const item of FASHION_PRODUCTS) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) continue;

    const mainImageUrl = item.images[0]?.url ?? null;
    const existing = await prisma.product.findUnique({
      where: { slug: item.slug },
      select: { id: true },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          brand: item.brand,
          description: item.description,
          status: 'Active',
          mainImageUrl,
          categoryId,
          deletedAt: null,
        },
      });
      await prisma.productVariant.deleteMany({ where: { productId: existing.id } });
      await prisma.productImage.deleteMany({ where: { productId: existing.id } });
      await prisma.productVariant.createMany({
        data: item.variants.map((v) => ({
          productId: existing.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          publicPrice: v.publicPrice,
          compareAtPrice: v.compareAtPrice ?? null,
          stockPolicy: 'SupplierManaged',
          status: 'Active',
        })),
      });
      await prisma.productImage.createMany({
        data: item.images.map((img) => ({
          productId: existing.id,
          url: img.url,
          altText: img.altText,
          sortOrder: img.sortOrder,
        })),
      });
    } else {
      await prisma.product.create({
        data: {
          name: item.name,
          slug: item.slug,
          brand: item.brand,
          description: item.description,
          status: 'Active',
          mainImageUrl,
          categoryId,
          variants: {
            create: item.variants.map((v) => ({
              sku: v.sku,
              size: v.size,
              color: v.color,
              publicPrice: v.publicPrice,
              compareAtPrice: v.compareAtPrice ?? null,
              stockPolicy: 'SupplierManaged',
              status: 'Active',
            })),
          },
          images: {
            create: item.images,
          },
        },
      });
    }

    products += 1;
  }

  return { categories: categoryIds.size, products };
}
