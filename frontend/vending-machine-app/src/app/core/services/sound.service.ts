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

/** Pitch range the coin return sweeps through, highest clink to lowest. */
const RETURN_PITCH_TOP = 2400;
const RETURN_PITCH_BOTTOM = 1100;

/** Cap on the cascade, so returning a fistful of nickels doesn't become a machine-gun burst. */
const MAX_RETURN_CLINKS = 8;

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

  /**
   * A coin going into a real machine is not one clink - it is the strike at the slot, a scatter of
   * quick irregular impacts as it tumbles down the chute, a metallic slide along the ramp, and a
   * dull settle as it drops into the box. Impacts get lower and quieter on the way down.
   */
  coinInsert(denomination: CoinDenomination): void {
    const ctx = this.audioContext();
    if (!ctx) {
      return;
    }
    const now = ctx.currentTime;
    const pitch = COIN_PITCH[denomination];

    // The coin hitting the slot lip.
    this.clink(ctx, pitch, now);

    // Tumbling down the chute. Spacings are deliberately uneven - evenly spaced impacts read as a
    // machine-gun rattle rather than something falling.
    const bounces: [number, number, number][] = [
      [0.068, 0.94, 0.75],
      [0.121, 0.86, 0.58],
      [0.163, 0.79, 0.44],
      [0.221, 0.72, 0.3],
      [0.268, 0.66, 0.19],
    ];
    for (const [delay, pitchScale, level] of bounces) {
      this.clink(ctx, pitch * pitchScale, now + delay, level);
    }

    // Metallic slide along the ramp, under the impacts.
    this.chuteSlide(ctx, pitch, now + 0.04);

    // Landing in the coin box.
    this.tone(ctx, {
      type: 'triangle',
      frequency: pitch * 0.3,
      duration: 0.13,
      gain: 0.05,
      startAt: now + 0.31,
    });
  }

  /**
   * A cascade of clinks, one per returned coin, as if they were dropping into the return tray.
   * The pitch falls across the whole cascade, so a single coin is one high clink and a handful is
   * an audibly longer tumble down to the bottom of the range.
   */
  coinReturn(coinCount: number): void {
    const ctx = this.audioContext();
    if (!ctx) {
      return;
    }
    const clinks = Math.min(MAX_RETURN_CLINKS, Math.max(1, Math.floor(coinCount)));
    const start = ctx.currentTime;

    for (let index = 0; index < clinks; index++) {
      // 0 for the first coin, 1 for the last; a lone coin never leaves the top of the range.
      const fall = clinks === 1 ? 0 : index / (clinks - 1);
      const frequency = RETURN_PITCH_TOP + (RETURN_PITCH_BOTTOM - RETURN_PITCH_TOP) * fall;
      // Spacing widens slightly as the cascade goes on - evenly spaced clinks read as a rattle.
      const offset = index * 0.085 + index * index * 0.004;
      this.clink(ctx, frequency, start + offset, 0.7);
    }
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

  /** Noise swept down through a resonant bandpass - the coin skidding along the metal ramp. */
  private chuteSlide(ctx: AudioContext, frequency: number, startAt: number): void {
    const buffer = this.noise(ctx);
    if (!buffer) {
      return;
    }
    const duration = 0.3;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.value = 7;
    bandpass.frequency.setValueAtTime(frequency * 1.1, startAt);
    bandpass.frequency.exponentialRampToValueAtTime(frequency * 0.45, startAt + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.05, startAt + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    source.connect(bandpass).connect(gain).connect(ctx.destination);
    source.start(startAt);
    source.stop(startAt + duration + 0.02);
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
