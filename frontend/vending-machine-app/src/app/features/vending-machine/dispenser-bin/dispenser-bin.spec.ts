import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Product } from '../../../core/models/product.model';
import { DispenserBin } from './dispenser-bin';

const candyBar: Product = {
  code: 'C3',
  name: 'Candy Bar',
  priceCents: 125,
  quantity: 18,
  isOutOfStock: false,
  slotOrder: 9,
};

describe('DispenserBin', () => {
  let fixture: ComponentFixture<DispenserBin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DispenserBin] }).compileComponents();
    fixture = TestBed.createComponent(DispenserBin);
  });

  it('shows an empty tray when nothing has been dispensed', () => {
    fixture.componentRef.setInput('item', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bin')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bin__item')).toBeNull();
  });

  it('renders the dispensed product with its own artwork', () => {
    fixture.componentRef.setInput('item', { id: 1, product: candyBar });
    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.bin__item');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('/images/products/c3-candy-bar.svg');
    expect(img.getAttribute('alt')).toBe('Candy Bar dispensed');
  });

  it('replaces the item when a second product is dispensed', () => {
    fixture.componentRef.setInput('item', { id: 1, product: candyBar });
    fixture.detectChanges();

    fixture.componentRef.setInput('item', {
      id: 2,
      product: { ...candyBar, code: 'D2', name: 'Gum' },
    });
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.bin__item');
    expect(items.length).toBe(1);
    expect(items[0].getAttribute('src')).toBe('/images/products/d2-gum.svg');
  });
});
