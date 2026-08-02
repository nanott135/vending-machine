import { Product } from '../models/product.model';

// Every slot has its own illustration, keyed by the product's slot code. Codes are exact keys
// rather than name keywords - matching on names is what made 'Chocolate Bar' resolve to the cola
// art, since 'chocolate' contains 'cola'.
const SLOT_IMAGES: Record<string, string> = {
  A1: '/images/products/a1-cola.svg',
  A2: '/images/products/a2-diet-cola.svg',
  A3: '/images/products/a3-root-beer.svg',
  B1: '/images/products/b1-orange-soda.svg',
  B2: '/images/products/b2-sparkling-water.svg',
  B3: '/images/products/b3-bottled-water.svg',
  C1: '/images/products/c1-chips.svg',
  C2: '/images/products/c2-pretzels.svg',
  C3: '/images/products/c3-candy-bar.svg',
  D1: '/images/products/d1-chocolate-bar.svg',
  D2: '/images/products/d2-gum.svg',
  D3: '/images/products/d3-crackers.svg',
};

const FALLBACK_IMAGE = '/images/products/c3-candy-bar.svg';

export function productImageFor(product: Pick<Product, 'code'>): string {
  return SLOT_IMAGES[product.code.toUpperCase()] ?? FALLBACK_IMAGE;
}
