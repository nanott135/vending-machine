import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundService } from './sound.service';

/**
 * Just enough of the Web Audio API for the service to run against, recording the frequency of
 * every oscillator it starts. Each clink plays exactly one tone, so the recorded frequencies are
 * the cascade's pitches, in order.
 */
function fakeAudioContext(frequencies: number[]) {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const routed = <T extends object>(node: T) => ({
    ...node,
    connect: <U>(target: U) => target,
    start() {},
    stop() {},
  });

  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createOscillator: () =>
      routed({
        type: 'sine',
        frequency: {
          ...param(),
          setValueAtTime: (value: number) => frequencies.push(value),
        },
      }),
    createGain: () => routed({ gain: param() }),
    createBiquadFilter: () => routed({ type: 'bandpass', frequency: param(), Q: param() }),
    createBufferSource: () => routed({ buffer: null, loop: false }),
    createBuffer: (_channels: number, frames: number) => ({
      getChannelData: () => new Float32Array(frames),
    }),
  };
}

/** Installs the fake as the page's AudioContext for the rest of the test. */
function stubAudio(frequencies: number[]): void {
  vi.stubGlobal('AudioContext', function FakeAudioContext() {
    return fakeAudioContext(frequencies);
  });
}

describe('SoundService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts unmuted and toggles', () => {
    const service = TestBed.inject(SoundService);

    expect(service.muted()).toBe(false);
    service.toggleMute();
    expect(service.muted()).toBe(true);
    service.toggleMute();
    expect(service.muted()).toBe(false);
  });

  it('persists the muted state', () => {
    const service = TestBed.inject(SoundService);
    service.toggleMute();

    expect(localStorage.getItem('vending-machine.muted')).toBe('true');
  });

  it('does not construct an AudioContext while muted', () => {
    const ctor = vi.fn();
    vi.stubGlobal('AudioContext', ctor);

    const service = TestBed.inject(SoundService);
    service.toggleMute();
    service.keyPress();
    service.vend();
    service.reject();
    service.coinInsert('Quarter');
    service.coinReturn(3);

    expect(ctor).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('stays silent instead of throwing when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    const service = TestBed.inject(SoundService);

    expect(() => {
      service.keyPress();
      service.coinInsert('Dollar');
      service.coinReturn(4);
      service.vend();
      service.reject();
    }).not.toThrow();

    vi.unstubAllGlobals();
  });

  it('plays one clink per returned coin, descending in pitch', () => {
    const frequencies: number[] = [];
    stubAudio(frequencies);

    TestBed.inject(SoundService).coinReturn(4);

    expect(frequencies).toHaveLength(4);
    for (let i = 1; i < frequencies.length; i++) {
      expect(frequencies[i]).toBeLessThan(frequencies[i - 1]);
    }
    vi.unstubAllGlobals();
  });

  it('sounds different for one coin than for four', () => {
    const one: number[] = [];
    stubAudio(one);
    TestBed.inject(SoundService).coinReturn(1);
    vi.unstubAllGlobals();

    // A fresh service, because each one caches its AudioContext after the first sound.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const four: number[] = [];
    stubAudio(four);
    TestBed.inject(SoundService).coinReturn(4);
    vi.unstubAllGlobals();

    // A lone coin is a single clink held at the top of the range; four sweep down to the bottom.
    expect(one).toHaveLength(1);
    expect(one[0]).toBe(four[0]);
    expect(four[four.length - 1]).toBeLessThan(one[0]);
  });

  it('caps the cascade so a fistful of nickels stays a sound and not a burst', () => {
    const frequencies: number[] = [];
    stubAudio(frequencies);

    TestBed.inject(SoundService).coinReturn(40);

    expect(frequencies).toHaveLength(8);
    vi.unstubAllGlobals();
  });

  it('still plays a single clink for a nonsense count', () => {
    const frequencies: number[] = [];
    stubAudio(frequencies);

    TestBed.inject(SoundService).coinReturn(0);

    expect(frequencies).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
