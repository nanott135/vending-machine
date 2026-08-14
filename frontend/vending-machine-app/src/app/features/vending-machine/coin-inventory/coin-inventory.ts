import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { CoinCount } from '../../../core/models/coin.model';
import { coinImageFor } from '../../../core/utils/coin-image';

/**
 * Read-only status panel for the machine's own coin bank. Purely presentational - the container
 * fetches the inventory and passes it down, the same way it does the product list.
 */
@Component({
  selector: 'app-coin-inventory',
  imports: [CurrencyPipe],
  templateUrl: './coin-inventory.html',
  styleUrl: './coin-inventory.scss',
})
export class CoinInventory {
  /** Already ordered descending by coin value by the server - rendered as given, zeroes included. */
  readonly coins = input.required<CoinCount[]>();
  readonly totalCents = input.required<number>();

  protected imageFor(coin: CoinCount): string {
    return coinImageFor(coin.denomination);
  }
}
