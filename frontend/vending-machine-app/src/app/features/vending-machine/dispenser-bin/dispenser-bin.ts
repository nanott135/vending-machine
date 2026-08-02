import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
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

/**
 * When the item leaves the DOM. Must outlast the drop, the hold and the fade in
 * dispenser-bin.scss - the element is removed once it is already invisible, so a faded-out
 * product is not left sitting in the accessibility tree.
 */
const REMOVE_AFTER_MS = 4350;

@Component({
  selector: 'app-dispenser-bin',
  imports: [],
  templateUrl: './dispenser-bin.html',
  styleUrl: './dispenser-bin.scss',
})
export class DispenserBin {
  readonly item = input<DispensedItem | null>(null);

  /** Mirrors `item`, but clears itself once the product has faded out of the tray. */
  protected readonly current = signal<DispensedItem | null>(null);
  protected readonly flapOpen = signal(false);
  protected readonly imageFor = productImageFor;

  private readonly destroyRef = inject(DestroyRef);
  private flapTimer: ReturnType<typeof setTimeout> | null = null;
  private removeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const dispensed = this.item();
      if (!dispensed) {
        return;
      }

      // A vend landing mid-fade restarts the whole cycle rather than inheriting old timers.
      this.clearTimers();
      this.current.set(dispensed);
      this.flapOpen.set(true);

      this.flapTimer = setTimeout(() => this.flapOpen.set(false), FLAP_OPEN_MS);
      this.removeTimer = setTimeout(() => this.current.set(null), REMOVE_AFTER_MS);
    });

    this.destroyRef.onDestroy(() => this.clearTimers());
  }

  private clearTimers(): void {
    if (this.flapTimer) {
      clearTimeout(this.flapTimer);
      this.flapTimer = null;
    }
    if (this.removeTimer) {
      clearTimeout(this.removeTimer);
      this.removeTimer = null;
    }
  }
}
