import { Component, output, signal } from '@angular/core';

const ROWS = ['A', 'B', 'C', 'D'];
const COLUMNS = ['1', '2', '3'];

@Component({
  selector: 'app-keypad',
  imports: [],
  templateUrl: './keypad.html',
  styleUrl: './keypad.scss',
})
export class Keypad {
  readonly selectCode = output<string>();

  protected readonly rows = ROWS;
  protected readonly columns = COLUMNS;
  protected readonly entry = signal('');

  press(key: string): void {
    if (this.entry().length < 2) {
      this.entry.set(this.entry() + key);
    }
  }

  clear(): void {
    this.entry.set('');
  }

  submit(): void {
    if (this.entry().length !== 2) {
      return;
    }
    this.selectCode.emit(this.entry());
    this.entry.set('');
  }
}
