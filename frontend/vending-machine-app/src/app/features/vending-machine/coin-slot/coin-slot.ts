import { CurrencyPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { CoinDenomination } from '../../../core/models/coin.model';

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

  protected readonly denominations: { value: CoinDenomination; label: string }[] = [
    { value: 'Nickel', label: '5¢' },
    { value: 'Dime', label: '10¢' },
    { value: 'Quarter', label: '25¢' },
    { value: 'Dollar', label: '$1' },
  ];
}
