import { Component, input } from '@angular/core';
import { Product } from '../../../core/models/product.model';
import { ProductSlot } from '../product-slot/product-slot';

@Component({
  selector: 'app-product-grid',
  imports: [ProductSlot],
  templateUrl: './product-grid.html',
  styleUrl: './product-grid.scss',
})
export class ProductGrid {
  readonly products = input.required<Product[]>();
}
