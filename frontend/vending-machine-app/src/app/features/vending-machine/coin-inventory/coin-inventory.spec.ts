import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoinCount } from '../../../core/models/coin.model';
import { CoinInventory } from './coin-inventory';

describe('CoinInventory', () => {
  let fixture: ComponentFixture<CoinInventory>;

  // Server order: descending by coin value, with a depleted denomination still present.
  const COINS: CoinCount[] = [
    { denomination: 'Dollar', count: 15 },
    { denomination: 'Quarter', count: 40 },
    { denomination: 'Dime', count: 0 },
    { denomination: 'Nickel', count: 7 },
  ];

  const rows = (): HTMLElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.coin-inventory__row'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoinInventory],
    }).compileComponents();

    fixture = TestBed.createComponent(CoinInventory);
    fixture.componentRef.setInput('coins', COINS);
    fixture.componentRef.setInput('totalCents', 2570);
    fixture.detectChanges();
  });

  it('renders one row per denomination in the order given', () => {
    expect(rows()).toHaveLength(4);
    expect(rows().map((row) => row.querySelector('img')?.getAttribute('alt'))).toEqual([
      'Dollar',
      'Quarter',
      'Dime',
      'Nickel',
    ]);
  });

  it('renders a zero count rather than dropping the depleted denomination', () => {
    const dime = rows()[2];
    expect(dime.querySelector('img')?.getAttribute('alt')).toBe('Dime');
    expect(dime.querySelector('.coin-inventory__count')?.textContent?.trim()).toBe('0');
  });

  it('shows each denomination count', () => {
    expect(rows().map((row) => row.querySelector('.coin-inventory__count')?.textContent?.trim()))
      .toEqual(['15', '40', '0', '7']);
  });

  it('uses the slot artwork for each denomination', () => {
    expect(rows()[0].querySelector('img')?.getAttribute('src')).toBe('/images/coins/dollar-coin.svg');
    expect(rows()[3].querySelector('img')?.getAttribute('src')).toBe('/images/coins/nickel.svg');
  });

  it('formats the total as dollars', () => {
    const total = (fixture.nativeElement as HTMLElement).querySelector(
      '.coin-inventory__total-value',
    );
    expect(total?.textContent).toContain('25.70');
  });
});
