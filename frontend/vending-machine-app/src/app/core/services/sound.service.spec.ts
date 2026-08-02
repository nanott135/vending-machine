import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundService } from './sound.service';

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
    service.coinReturn();

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
      service.coinReturn();
      service.vend();
      service.reject();
    }).not.toThrow();

    vi.unstubAllGlobals();
  });
});
