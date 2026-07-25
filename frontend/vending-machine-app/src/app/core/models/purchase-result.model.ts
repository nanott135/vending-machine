import { CoinCount } from './coin.model';
import { Product } from './product.model';

export type PurchaseStatus =
  | 'Success'
  | 'ProductNotFound'
  | 'OutOfStock'
  | 'InsufficientFunds'
  | 'ChangeUnavailable';

export interface PurchaseResult {
  status: PurchaseStatus;
  product: Product | null;
  changeDueCents: number;
  changeBreakdown: CoinCount[] | null;
  amountStillNeededCents: number;
}
