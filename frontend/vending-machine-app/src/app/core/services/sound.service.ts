import { Injectable, signal } from '@angular/core';
import { CoinDenomination } from '../models/coin.model';

const MUTE_STORAGE_KEY = 'vending-machine.muted';

/** Coin clinks are pitched by size - a dollar lands lower and duller than a dime. */
const COIN_PITCH: Record<CoinDenomination, number> = {
  Dime: 2600,
  Nickel: 2200,
  Quarter: 1850,
  Dollar: 1450,
};

/**
 * Every sound is synthesized at play time with the Web Audio API - there are no audio assets to
 * ship or decode. The AudioContext is created lazily on the first sound because browsers only
 * allow it to start after a user gesture, and every call site here is a click handler.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  readonly muted = signal(this.readStoredMute());

  toggleMute(): void {
    const next = !this.muted();
    this.muted.set(next);
    try {
      localStorage?.setItem(MUTE_STORAGE_KEY, String(next));
    } catch {
      // Storage can be unavailable (private mode, SSR); muting just won't persist.
    }
  }

  /** A short square blip - the keypad membrane click. */
  keyPress(): void {
    const ctx = this.audioContext();
    if (!ctx) {
      return;
    }
    this.tone(ctx, { type: 'square', frequency: 880, duration: 0.06, gain: 0.06 });
  }

  /** Metallic clink: filtered noise for the strike, plus a ringing partial. */
  coinInsert(denomination: CoinDenomination): void {
    const ctx = this.audioContext();
    if (!ctx) {
      return;
    }
    const pitch = COIN_PITCH[denomination];
    this.clink(ctx, pitch, ctx.currentTime);
  }

  /** A little cascade of clinks, as if coins were dropping into the return tray. */
  coinReturn(): void {
    const ctx = this.audioContext();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime;
    [0, 0.09, 0.17, 0.28].forEach((offset, index) => {
      this.clink(ctx, 2400 - index * 260, start + offset, 0.7);
    });
  }

  /** The vend: a mechanical thunk as the coil turns, then a two-note confirmation chime. */
  vend(): void {
    const ctx = this.audioContext();
    if (!ctx) {
      return;
    }
    const now = ctx.currentTime;
    this.tone(ctx, { type: 'square', frequency: 150, duration: 0.16, gain: 0.12, startAt: now });
    this.tone(ctx, { type: 'square', frequency: 90, duration: 0.22, gain: 0.1, startAt: now + 0.12 });
    this.tone(ctx, { type: 'triangle', frequency: 784, duration: 0.16, gain: 0.09, startAt: now + 0.34 });
    this.tone(ctx, { type: 'triangle', frequency: 1047, duration: 0.28, gain: 0.09, startAt: now + 0.46 });
  }

  /** Low buzzer for any rejected action - bad code, no funds, empty slot. */
  reject(): void {
    const ctx = this.audioContext();
    if (!ctx) {
      return;
    }
    const now = ctx.currentTime;
    this.tone(ctx, { type: 'sawtooth', frequency: 130, duration: 0.18, gain: 0.09, startAt: now });
    this.tone(ctx, { type: 'sawtooth', frequency: 98, duration: 0.3, gain: 0.09, startAt: now + 0.2 });
  }

  private clink(ctx: AudioContext, frequency: number, startAt: number, scale = 1): void {
    const buffer = this.noise(ctx);
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = frequency;
      bandpass.Q.value = 12;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5 * scale, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);

      source.connect(bandpass).connect(gain).connect(ctx.destination);
      source.start(startAt);
      source.stop(startAt + 0.12);
    }

    this.tone(ctx, {
      type: 'triangle',
      frequency,
      duration: 0.14,
      gain: 0.05 * scale,
      startAt,
    });
  }

  private tone(
    ctx: AudioContext,
    options: {
      type: OscillatorType;
      frequency: number;
      duration: number;
      gain: number;
      startAt?: number;
    },
  ): void {
    const startAt = options.startAt ?? ctx.currentTime;
    const oscillator = ctx.createOscillator();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, startAt);

    const gain = ctx.createGain();
    // Tiny attack ramp instead of an instant jump, which would click.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(options.gain, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + options.duration);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + options.duration + 0.02);
  }

  private noise(ctx: AudioContext): AudioBuffer | null {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }
    const frames = Math.floor(ctx.sampleRate * 0.15);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      channel[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /** Null whenever audio is unavailable or muted, which makes every play method a no-op. */
  private audioContext(): AudioContext | null {
    if (this.muted()) {
      return null;
    }
    if (this.context) {
      // Browsers suspend the context when it is created before a gesture; nudge it awake.
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
      return this.context;
    }

    const Ctor =
      typeof globalThis !== 'undefined'
        ? (globalThis.AudioContext ??
          (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctor) {
      return null;
    }

    try {
      this.context = new Ctor();
      return this.context;
    } catch {
      return null;
    }
  }

  private readStoredMute(): boolean {
    try {
      return localStorage?.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
