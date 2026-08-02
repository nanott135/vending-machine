import { Component, inject, output, signal } from '@angular/core';
import { SoundService } from '../../../core/services/sound.service';

const ROWS = ['A', 'B', 'C', 'D'];
const COLUMNS = ['1', '2', '3'];

@Component({
  selector: 'app-keypad',
  imports: [],
  templateUrl: './keypad.html',
  styleUrl: './keypad.scss',
})
export class Keypad {
  private readonly sound = inject(SoundService);

  readonly selectCode = output<string>();

  protected readonly rows = ROWS;
  protected readonly columns = COLUMNS;
  protected readonly entry = signal('');

  press(key: string): void {
    if (this.entry().length < 2) {
      this.entry.set(this.entry() + key);
      this.sound.keyPress();
    }
  }

  clear(): void {
    this.entry.set('');
    this.sound.keyPress();
  }

  submit(): void {
    if (this.entry().length !== 2) {
      return;
    }
    this.sound.keyPress();
    this.selectCode.emit(this.entry());
    this.entry.set('');
  }
}
