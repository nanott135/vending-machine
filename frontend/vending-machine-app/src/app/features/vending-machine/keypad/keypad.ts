import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Product } from '../../../core/models/product.model';
import { SoundService } from '../../../core/services/sound.service';

const ROWS = ['A', 'B', 'C', 'D'];
const COLUMNS = ['1', '2', '3'];

@Component({
  selector: 'app-keypad',
  imports: [CurrencyPipe],
  templateUrl: './keypad.html',
  styleUrl: './keypad.scss',
})
export class Keypad {
  private readonly sound = inject(SoundService);

  /**
   * The keypad knows the code being typed; the price and the balance live in the container. Both
   * come down as inputs so affordability can be derived here with the entry, rather than the entry
   * being duplicated upwards.
   */
  readonly products = input.required<Product[]>();
  readonly balanceCents = input.required<number>();

  readonly selectCode = output<string>();

  protected readonly rows = ROWS;
  protected readonly columns = COLUMNS;
  protected readonly entry = signal('');

  /** Null until two characters are entered, and for a code no product answers to. */
  private readonly selectedProduct = computed(
    () => this.products().find((product) => product.code === this.entry()) ?? null,
  );

  /**
   * Only a real, in-stock product priced above the balance blocks the button. An unknown code and
   * an out-of-stock slot both stay clickable on purpose: the machine's answer ("Unknown product
   * code", "Cola is out of stock") tells the user more than a button that just refuses to move.
   */
  protected readonly tooExpensive = computed(() => {
    const product = this.selectedProduct();
    return !!product && !product.isOutOfStock && product.priceCents > this.balanceCents();
  });

  protected readonly canSubmit = computed(() => this.entry().length === 2 && !this.tooExpensive());

  /** Cents still to insert for the selected product - 0 whenever nothing is blocking the sale. */
  protected readonly shortfallCents = computed(() => {
    const product = this.selectedProduct();
    return this.tooExpensive() && product ? product.priceCents - this.balanceCents() : 0;
  });

  press(key: string): void {
    if (this.entry().length < 2) {
      this.entry.set(this.entry() + key);
      this.sound.keyPress();
    }
  }

  clear(): void {
    this.entry.set('');
    this.sound.keyPress();
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.sound.keyPress();
    this.selectCode.emit(this.entry());
    this.entry.set('');
  }
}
