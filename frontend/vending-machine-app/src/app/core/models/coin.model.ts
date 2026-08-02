export type CoinDenomination = 'Nickel' | 'Dime' | 'Quarter' | 'Dollar';

export interface CoinCount {
  denomination: CoinDenomination;
  count: number;
}

export interface MachineBalance {
  balanceCents: number;
}

export interface ReturnCoinsResult {
  returnedCents: number;
  returnedCoins: CoinCount[];
}
