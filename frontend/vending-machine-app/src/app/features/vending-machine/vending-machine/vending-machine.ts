import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CoinCount, CoinDenomination } from '../../../core/models/coin.model';
import { Product } from '../../../core/models/product.model';
import { PurchaseResult, isPurchaseResult } from '../../../core/models/purchase-result.model';
import { MachineService } from '../../../core/services/machine.service';
import { ProductService } from '../../../core/services/product.service';
import { SoundService } from '../../../core/services/sound.service';
import { CoinInventory } from '../coin-inventory/coin-inventory';
import { CoinSlot } from '../coin-slot/coin-slot';
import { DispensedItem, DispenserBin } from '../dispenser-bin/dispenser-bin';
import { Keypad } from '../keypad/keypad';
import { ProductGrid } from '../product-grid/product-grid';

/** Breathing room kept between the cabinet and the viewport edges, in CSS pixels. */
const VIEWPORT_PADDING = 16;

/** Cap on enlargement, so the cabinet doesn't balloon absurdly on a very large display. */
const MAX_SCALE = 1.6;

function fitScale(element: HTMLElement): number {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!width || !height) {
    return 1;
  }
  return Math.min(
    MAX_SCALE,
    (window.innerWidth - VIEWPORT_PADDING * 2) / width,
    (window.innerHeight - VIEWPORT_PADDING * 2) / height,
  );
}

@Component({
  selector: 'app-vending-machine',
  imports: [ProductGrid, CoinSlot, Keypad, DispenserBin, CoinInventory],
  templateUrl: './vending-machine.html',
  styleUrl: './vending-machine.scss',
})
export class VendingMachine implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly machineService = inject(MachineService);
  private readonly sound = inject(SoundService);

  protected readonly products = signal<Product[]>([]);
  protected readonly balanceCents = signal(0);
  protected readonly message = signal<string | null>(null);
  protected readonly muted = this.sound.muted;
  protected readonly dispensed = signal<DispensedItem | null>(null);
  protected readonly inventoryCoins = signal<CoinCount[]>([]);
  protected readonly inventoryTotalCents = signal(0);

  private dispenseCount = 0;

  private readonly machine = viewChild.required<ElementRef<HTMLElement>>('machine');
  private readonly destroyRef = inject(DestroyRef);

  /** Uniform "fit to page" factor - the cabinet keeps its proportions and just shrinks to fit. */
  protected readonly scale = signal(1);

  constructor() {
    afterNextRender(() => {
      const element = this.machine().nativeElement;
      const fit = () => this.scale.set(fitScale(element));

      fit();
      // offsetWidth/Height ignore transforms, so re-measuring never feeds back into the scale.
      const observer = new ResizeObserver(fit);
      observer.observe(element);
      window.addEventListener('resize', fit);

      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        window.removeEventListener('resize', fit);
      });
    });
  }

  protected toggleMute(): void {
    this.sound.toggleMute();
  }

  ngOnInit(): void {
    this.refreshProducts();
    this.refreshBalance();
    this.refreshInventory();
  }

  onInsertCoin(denomination: CoinDenomination): void {
    this.machineService.insertCoin(denomination).subscribe((balance) => {
      this.balanceCents.set(balance.balanceCents);
    });
  }

  onReturnCoins(): void {
    this.machineService.returnCoins().subscribe((result) => {
      this.balanceCents.set(0);
      const hasCoins = result.returnedCoins.length > 0;
      // Only clatter when coins actually drop; an empty tray gets the reject buzz instead.
      if (hasCoins) {
        this.sound.coinReturn();
      } else {
        this.sound.reject();
      }
      this.message.set(
        hasCoins ? `Returned $${(result.returnedCents / 100).toFixed(2)}.` : 'No coins to return.',
      );
    });
  }

  onSelectCode(code: string): void {
    this.machineService.purchase(code).subscribe({
      next: (result) => this.handlePurchaseResult(result),
      // Business outcomes arrive here too - the API answers 402/404/409 with a full result body.
      error: (err: HttpErrorResponse) => {
        if (isPurchaseResult(err.error)) {
          this.handlePurchaseResult(err.error);
        } else {
          this.sound.reject();
          this.message.set('Something went wrong. Please try again.');
        }
      },
    });
  }

  private handlePurchaseResult(result: PurchaseResult): void {
    // One thunk-and-chime for a real vend, one buzz for every way it can be turned down.
    if (result.status === 'Success') {
      this.sound.vend();
    } else {
      this.sound.reject();
    }

    switch (result.status) {
      case 'Success': {
        if (result.product) {
          // A fresh id each time, so repeat buys of one product still replay the drop.
          this.dispensed.set({ id: ++this.dispenseCount, product: result.product });
        }
        const changeText = result.changeBreakdown?.length
          ? ` Change returned: ${result.changeBreakdown
              .map((c) => `${c.count}x ${c.denomination}`)
              .join(', ')}.`
          : '';
        this.message.set(`Dispensed ${result.product?.name}.${changeText}`);
        this.refreshProducts();
        // A sale is the only thing that moves the coin bank - it keeps the inserted coins and
        // pays change out of them. Inserting and returning coins leave the durable inventory alone.
        this.refreshInventory();
        break;
      }
      case 'ProductNotFound':
        this.message.set('Unknown product code. Try again.');
        break;
      case 'OutOfStock':
        this.message.set(`${result.product?.name} is out of stock.`);
        break;
      case 'InsufficientFunds':
        this.message.set(
          `Insufficient funds - insert $${(result.amountStillNeededCents / 100).toFixed(2)} more.`,
        );
        break;
      case 'ChangeUnavailable':
        this.message.set('Exact change is not available right now. Please return your coins.');
        break;
    }
    this.refreshBalance();
  }

  private refreshProducts(): void {
    this.productService.getProducts().subscribe((products) => this.products.set(products));
  }

  private refreshInventory(): void {
    this.machineService.getInventory().subscribe((inventory) => {
      this.inventoryCoins.set(inventory.coins);
      this.inventoryTotalCents.set(inventory.totalCents);
    });
  }

  private refreshBalance(): void {
    this.machineService.getBalance().subscribe((balance) => this.balanceCents.set(balance.balanceCents));
  }
}
