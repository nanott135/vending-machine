import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Product } from '../../../core/models/product.model';
import { productImageFor } from '../../../core/utils/product-image';

@Component({
  selector: 'app-product-slot',
  imports: [CurrencyPipe],
  templateUrl: './product-slot.html',
  styleUrl: './product-slot.scss',
})
export class ProductSlot {
  readonly product = input.required<Product>();

  protected readonly imageUrl = computed(() => productImageFor(this.product()));
}
