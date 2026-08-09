import { CoinCount } from './coin.model';
import { Product } from './product.model';

/**
 * The runtime twin of `PurchaseStatus`. The union is derived from it rather than declared
 * separately, so a status can't be added to one and forgotten in the other.
 */
export const PURCHASE_STATUSES = [
  'Success',
  'ProductNotFound',
  'OutOfStock',
  'InsufficientFunds',
  'ChangeUnavailable',
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export interface PurchaseResult {
  status: PurchaseStatus;
  product: Product | null;
  changeDueCents: number;
  changeBreakdown: CoinCount[] | null;
  amountStillNeededCents: number;
}

/**
 * The API sends a full PurchaseResult body with the non-2xx codes it uses for business outcomes
 * (402 insufficient funds, 409 out of stock), so the error callback has to tell those apart from a
 * genuine failure. Testing for a *known* status matters: ASP.NET's validation problem details carry
 * a numeric `status` of their own, and a plain truthiness check would wave one of those through.
 */
export function isPurchaseResult(body: unknown): body is PurchaseResult {
  return (
    typeof body === 'object' &&
    body !== null &&
    PURCHASE_STATUSES.includes((body as PurchaseResult).status)
  );
}
