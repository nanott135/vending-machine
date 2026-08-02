import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('clearing the tray', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('removes the product once it has faded out', () => {
      fixture.componentRef.setInput('item', { id: 1, product: candyBar });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.bin__item')).toBeTruthy();

      // Still on show partway through the hold.
      vi.advanceTimersByTime(1500);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.bin__item')).toBeTruthy();

      // Gone once the drop, hold and fade have all elapsed.
      vi.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.bin__item')).toBeNull();
    });

    it('keeps a new product when one is vended mid-fade', () => {
      fixture.componentRef.setInput('item', { id: 1, product: candyBar });
      fixture.detectChanges();

      // Mid-fade: the fade runs from 2.3s to 3.0s.
      vi.advanceTimersByTime(2600);
      fixture.componentRef.setInput('item', {
        id: 2,
        product: { ...candyBar, code: 'D2', name: 'Gum' },
      });
      fixture.detectChanges();

      // The first item's removal timer must not clear the replacement.
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      const img: HTMLImageElement = fixture.nativeElement.querySelector('.bin__item');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe('/images/products/d2-gum.svg');
    });
  });
});
