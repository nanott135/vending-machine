import { CoinDenomination } from '../models/coin.model';

const COIN_IMAGES: Record<CoinDenomination, string> = {
  Nickel: '/images/coins/nickel.svg',
  Dime: '/images/coins/dime.svg',
  Quarter: '/images/coins/quarter.svg',
  Dollar: '/images/coins/dollar-coin.svg',
};

export function coinImageFor(denomination: CoinDenomination): string {
  return COIN_IMAGES[denomination];
}
