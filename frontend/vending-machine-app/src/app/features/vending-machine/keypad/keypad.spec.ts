import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Product } from '../../../core/models/product.model';
import { Keypad } from './keypad';

const COLA: Product = {
  code: 'A1',
  name: 'Cola',
  priceCents: 125,
  quantity: 10,
  isOutOfStock: false,
  isLowStock: false,
  slotOrder: 1,
};

const SOLD_OUT: Product = {
  code: 'B2',
  name: 'Pretzels',
  priceCents: 100,
  quantity: 0,
  isOutOfStock: true,
  isLowStock: false,
  slotOrder: 5,
};

describe('Keypad', () => {
  let component: Keypad;
  let fixture: ComponentFixture<Keypad>;

  const selectButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelectorAll('.keypad__actions button')[1] as HTMLButtonElement;

  const hintText = (): string =>
    (fixture.nativeElement.querySelector('.keypad__hint') as HTMLElement).textContent?.trim() ?? '';

  /** Types a two-character code the way a user would, then settles the view. */
  const type = (code: string): void => {
    for (const key of code) {
      component.press(key);
    }
    fixture.detectChanges();
  };

  const setBalance = (balanceCents: number): void => {
    fixture.componentRef.setInput('balanceCents', balanceCents);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Keypad],
    }).compileComponents();

    fixture = TestBed.createComponent(Keypad);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('products', [COLA, SOLD_OUT]);
    fixture.componentRef.setInput('balanceCents', 0);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('disables Select until two characters are entered', () => {
    fixture.detectChanges();
    expect(selectButton().disabled).toBe(true);

    setBalance(200);
    type('A');
    expect(selectButton().disabled).toBe(true);

    component.press('1');
    fixture.detectChanges();
    expect(selectButton().disabled).toBe(false);
  });

  it('disables Select when the balance cannot cover the selected product', () => {
    setBalance(100);
    type('A1');

    expect(selectButton().disabled).toBe(true);
    expect(hintText()).toBe('Insert $0.25 more');
  });

  it('enables Select as soon as the balance reaches the price', () => {
    setBalance(120);
    type('A1');
    expect(selectButton().disabled).toBe(true);

    setBalance(125);
    expect(selectButton().disabled).toBe(false);
    expect(hintText()).toBe('');
  });

  it('does not emit while the balance is too low', () => {
    let emitted: string | null = null;
    component.selectCode.subscribe((code) => (emitted = code));

    setBalance(100);
    type('A1');
    component.submit();

    expect(emitted).toBeNull();
    // The entry survives, so inserting another coin lets the same selection through.
    expect(selectButton().disabled).toBe(true);

    setBalance(125);
    component.submit();
    expect(emitted).toBe('A1');
  });

  it('leaves Select enabled for an unknown code, so the machine can say why', () => {
    setBalance(0);
    type('D3');

    expect(selectButton().disabled).toBe(false);
    expect(hintText()).toBe('');
  });

  it('leaves Select enabled for an out-of-stock product even with no balance', () => {
    setBalance(0);
    type('B2');

    // "Pretzels is out of stock" is more use than a button that just refuses to move.
    expect(selectButton().disabled).toBe(false);
    expect(hintText()).toBe('');
  });
});
