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

/** The coins physically loaded in the machine - the durable bank, not the pending balance. */
export interface MachineInventory {
  /** One entry per denomination, ordered by the server descending by coin value. */
  coins: CoinCount[];
  totalCents: number;
}
