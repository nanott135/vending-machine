import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VendingMachine } from './vending-machine';

/** What ASP.NET answers with when the request body fails model validation. */
const VALIDATION_PROBLEM = {
  type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
  title: 'One or more validation errors occurred.',
  status: 400,
  errors: { ProductCode: ['The ProductCode field is required.'] },
};

const EMPTY_INVENTORY = {
  coins: [
    { denomination: 'Dollar', count: 0 },
    { denomination: 'Quarter', count: 0 },
    { denomination: 'Dime', count: 0 },
    { denomination: 'Nickel', count: 0 },
  ],
  totalCents: 0,
};

describe('VendingMachine', () => {
  let component: VendingMachine;
  let fixture: ComponentFixture<VendingMachine>;
  let http: HttpTestingController;

  const messageText = (): string | null =>
    fixture.nativeElement.querySelector('.vending-machine__message')?.textContent?.trim() ?? null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendingMachine],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(VendingMachine);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();

    // ngOnInit loads products, the balance and the coin inventory; answer all three so each
    // test starts settled.
    http.expectOne((r) => r.url.endsWith('/products')).flush([]);
    http.expectOne((r) => r.url.endsWith('/machine/balance')).flush({ balanceCents: 0 });
    http.expectOne((r) => r.url.endsWith('/machine/inventory')).flush(EMPTY_INVENTORY);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a business outcome that arrived on the error channel', async () => {
    component.onSelectCode('A1');

    http.expectOne((r) => r.url.endsWith('/purchase')).flush(
      {
        status: 'InsufficientFunds',
        product: {
          code: 'A1',
          name: 'Cola',
          priceCents: 125,
          quantity: 10,
          isOutOfStock: false,
          isLowStock: false,
          slotOrder: 1,
        },
        changeDueCents: 0,
        changeBreakdown: null,
        amountStillNeededCents: 125,
      },
      { status: 402, statusText: 'Payment Required' },
    );
    // Handling a result re-reads the balance afterwards.
    http.expectOne((r) => r.url.endsWith('/machine/balance')).flush({ balanceCents: 0 });
    await fixture.whenStable();

    expect(messageText()).toBe('Insufficient funds - insert $1.25 more.');
  });

  it('re-reads the coin inventory after a successful purchase', async () => {
    component.onSelectCode('A1');

    http.expectOne((r) => r.url.endsWith('/purchase')).flush({
      status: 'Success',
      product: {
        code: 'A1',
        name: 'Cola',
        priceCents: 125,
        quantity: 9,
        isOutOfStock: false,
        isLowStock: false,
        slotOrder: 1,
      },
      changeDueCents: 0,
      changeBreakdown: null,
      amountStillNeededCents: 0,
    });

    // A sale banks the inserted coins, so the container refetches the durable inventory.
    http.expectOne((r) => r.url.endsWith('/products')).flush([]);
    http.expectOne((r) => r.url.endsWith('/machine/inventory')).flush({
      coins: [
        { denomination: 'Dollar', count: 16 },
        { denomination: 'Quarter', count: 41 },
        { denomination: 'Dime', count: 0 },
        { denomination: 'Nickel', count: 3 },
      ],
      totalCents: 2655,
    });
    http.expectOne((r) => r.url.endsWith('/machine/balance')).flush({ balanceCents: 0 });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.coin-inventory__total-value')?.textContent).toContain('26.55');
  });

  it('shows the generic message when the error body is not a purchase result', async () => {
    component.onSelectCode('A1');

    http
      .expectOne((r) => r.url.endsWith('/purchase'))
      .flush(VALIDATION_PROBLEM, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    // The problem details carry status 400 - truthy, but not a PurchaseStatus.
    expect(messageText()).toBe('Something went wrong. Please try again.');
  });
});
