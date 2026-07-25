import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoinSlot } from './coin-slot';

describe('CoinSlot', () => {
  let fixture: ComponentFixture<CoinSlot>;
  let component: CoinSlot;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoinSlot],
    }).compileComponents();

    fixture = TestBed.createComponent(CoinSlot);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('balanceCents', 175);
    fixture.detectChanges();
  });

  it('displays the current balance formatted as currency', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.coin-slot__balance')?.textContent).toContain('1.75');
  });

  it('emits insertCoin with the chosen denomination when a coin button is clicked', () => {
    const emitted: string[] = [];
    component.insertCoin.subscribe((denomination) => emitted.push(denomination));

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.coin-slot__buttons button',
    );
    (buttons[2] as HTMLButtonElement).click(); // Quarter, per the denominations order

    expect(emitted).toEqual(['Quarter']);
  });

  it('emits returnCoins when the return button is clicked', () => {
    let emitted = false;
    component.returnCoins.subscribe(() => (emitted = true));

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.coin-slot__return')
      ?.click();

    expect(emitted).toBe(true);
  });
});
