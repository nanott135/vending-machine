import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Keypad } from './keypad';

describe('Keypad', () => {
  let component: Keypad;
  let fixture: ComponentFixture<Keypad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Keypad],
    }).compileComponents();

    fixture = TestBed.createComponent(Keypad);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
