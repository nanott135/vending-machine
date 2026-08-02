import { Component, effect, input, signal } from '@angular/core';
import { Product } from '../../../core/models/product.model';
import { productImageFor } from '../../../core/utils/product-image';

/**
 * A dispensed product. The id makes each vend distinct, so buying the same product twice still
 * recreates the element and replays the drop animation.
 */
export interface DispensedItem {
  id: number;
  product: Product;
}

/** How long the flap stays tilted open, roughly matching the drop animation. */
const FLAP_OPEN_MS = 900;

@Component({
  selector: 'app-dispenser-bin',
  imports: [],
  templateUrl: './dispenser-bin.html',
  styleUrl: './dispenser-bin.scss',
})
export class DispenserBin {
  readonly item = input<DispensedItem | null>(null);

  protected readonly flapOpen = signal(false);
  protected readonly imageFor = productImageFor;

  private flapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (!this.item()) {
        return;
      }
      this.flapOpen.set(true);
      if (this.flapTimer) {
        clearTimeout(this.flapTimer);
      }
      this.flapTimer = setTimeout(() => this.flapOpen.set(false), FLAP_OPEN_MS);
    });
  }
}
