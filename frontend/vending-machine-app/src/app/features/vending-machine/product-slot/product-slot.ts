import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-slot',
  imports: [CurrencyPipe],
  templateUrl: './product-slot.html',
  styleUrl: './product-slot.scss',
})
export class ProductSlot {
  readonly product = input.required<Product>();
}
