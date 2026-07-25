import { Product } from '../models/product.model';

// Products are matched to a shared category photo by keyword rather than sourcing a unique
// photo per product - keeps the asset set small while still giving every slot a real image.
const CATEGORY_IMAGES: { keywords: string[]; image: string }[] = [
  { keywords: ['cola', 'root beer', 'soda'], image: '/images/products/soda-can.jpg' },
  { keywords: ['water'], image: '/images/products/water-bottle.jpg' },
  { keywords: ['chips', 'pretzels'], image: '/images/products/chips.jpg' },
  { keywords: ['candy', 'chocolate'], image: '/images/products/candy-bar.jpg' },
  { keywords: ['gum'], image: '/images/products/gum.jpg' },
  { keywords: ['crackers'], image: '/images/products/crackers.jpg' },
];

const FALLBACK_IMAGE = '/images/products/candy-bar.jpg';

export function productImageFor(product: Pick<Product, 'name'>): string {
  const name = product.name.toLowerCase();
  const match = CATEGORY_IMAGES.find((category) =>
    category.keywords.some((keyword) => name.includes(keyword)),
  );
  return match?.image ?? FALLBACK_IMAGE;
}
