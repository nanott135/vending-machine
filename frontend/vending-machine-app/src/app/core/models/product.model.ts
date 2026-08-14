export interface Product {
  code: string;
  name: string;
  priceCents: number;
  quantity: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
  slotOrder: number;
}
