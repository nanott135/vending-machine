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

    // ngOnInit loads products and the balance; answer both so each test starts settled.
    http.expectOne((r) => r.url.endsWith('/products')).flush([]);
    http.expectOne((r) => r.url.endsWith('/machine/balance')).flush({ balanceCents: 0 });
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
