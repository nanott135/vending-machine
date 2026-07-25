import { CoinDenomination } from '../models/coin.model';

const COIN_IMAGES: Record<CoinDenomination, string> = {
  Nickel: '/images/coins/nickel.png',
  Dime: '/images/coins/dime.png',
  Quarter: '/images/coins/quarter.png',
  Dollar: '/images/coins/dollar-coin.png',
};

export function coinImageFor(denomination: CoinDenomination): string {
  return COIN_IMAGES[denomination];
}
