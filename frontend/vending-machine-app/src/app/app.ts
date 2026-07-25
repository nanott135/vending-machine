import { Component } from '@angular/core';
import { VendingMachine } from './features/vending-machine/vending-machine/vending-machine';

@Component({
  selector: 'app-root',
  imports: [VendingMachine],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
