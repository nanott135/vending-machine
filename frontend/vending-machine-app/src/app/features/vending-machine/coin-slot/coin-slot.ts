import { CurrencyPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { CoinDenomination } from '../../../core/models/coin.model';
import { coinImageFor } from '../../../core/utils/coin-image';

@Component({
  selector: 'app-coin-slot',
  imports: [CurrencyPipe],
  templateUrl: './coin-slot.html',
  styleUrl: './coin-slot.scss',
})
export class CoinSlot {
  readonly balanceCents = input.required<number>();
  readonly insertCoin = output<CoinDenomination>();
  readonly returnCoins = output<void>();

  protected readonly denominations: { value: CoinDenomination; label: string; image: string }[] = [
    { value: 'Nickel', label: '5¢', image: coinImageFor('Nickel') },
    { value: 'Dime', label: '10¢', image: coinImageFor('Dime') },
    { value: 'Quarter', label: '25¢', image: coinImageFor('Quarter') },
    { value: 'Dollar', label: '$1', image: coinImageFor('Dollar') },
  ];
}
