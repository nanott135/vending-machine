import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Product } from '../../../core/models/product.model';
import { ProductSlot } from './product-slot';

describe('ProductSlot', () => {
  let fixture: ComponentFixture<ProductSlot>;

  const baseProduct: Product = {
    code: 'A1',
    name: 'Cola',
    priceCents: 125,
    quantity: 10,
    isOutOfStock: false,
    slotOrder: 1,
  };

  function createWith(product: Product): void {
    fixture = TestBed.createComponent(ProductSlot);
    fixture.componentRef.setInput('product', product);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductSlot],
    }).compileComponents();
  });

  it('renders the product code, name, and price', () => {
    createWith(baseProduct);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.slot__code')?.textContent).toContain('A1');
    expect(el.querySelector('.slot__name')?.textContent).toContain('Cola');
    expect(el.querySelector('.slot__price')?.textContent).toContain('1.25');
  });

  it('does not light the out-of-stock indicator when in stock', () => {
    createWith(baseProduct);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.slot')?.classList.contains('out-of-stock')).toBe(false);
    expect(el.querySelector('.slot__light')?.classList.contains('lit')).toBe(false);
  });

  it('lights the out-of-stock indicator when quantity is zero', () => {
    createWith({ ...baseProduct, quantity: 0, isOutOfStock: true });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.slot')?.classList.contains('out-of-stock')).toBe(true);
    expect(el.querySelector('.slot__light')?.classList.contains('lit')).toBe(true);
  });
});
