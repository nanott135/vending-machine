import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendingMachine } from './vending-machine';

describe('VendingMachine', () => {
  let component: VendingMachine;
  let fixture: ComponentFixture<VendingMachine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendingMachine],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(VendingMachine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
