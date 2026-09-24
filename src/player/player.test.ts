import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { Player, type FrameClock } from './player';

// Deterministic stand-in for requestAnimationFrame: callbacks queue up and
// run only when a test calls frame(timeMs).
class FakeClock implements FrameClock {
  private nextHandle = 1;
  readonly pending = new Map<number, (timeMs: number) => void>();

  request(callback: (timeMs: number) => void): number {
    const handle = this.nextHandle++;
    this.pending.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.pending.delete(handle);
  }

  frame(timeMs: number): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback(timeMs);
  }
}

function setup(rate = 100) {
  const clock = new FakeClock();
  const player = new Player({ clock, rate });
  return { clock, player };
}

describe('Player', () => {
  it('starts empty and stopped', () => {
    const { player, clock } = setup();
    expect(player.getState()).toEqual({
      tick: 0,
      length: 0,
      playing: false,
      rate: 100,
    });
    expect(clock.pending.size).toBe(0);
  });

  it('autoplays on load by default, and not with autoplay: false', () => {
    const { player, clock } = setup();
    player.load(50);
    expect(player.getState()).toMatchObject({
      tick: 0,
      length: 50,
      playing: true,
    });
    expect(clock.pending.size).toBe(1);

    player.load(50, { autoplay: false });
    expect(player.getState()).toMatchObject({ tick: 0, playing: false });
    expect(clock.pending.size).toBe(0);
  });

  it('does not autoplay an empty timeline', () => {
    const { player, clock } = setup();
    player.load(0);
    expect(player.getState().playing).toBe(false);
    expect(clock.pending.size).toBe(0);
  });

  it('advances by elapsed time x rate, with the first frame only setting the baseline', () => {
    const { player, clock } = setup(100);
    player.load(1000);
    clock.frame(5000);
    expect(player.getState().tick).toBe(0);
    clock.frame(5100); // 100ms at 100 ticks/s
    expect(player.getState().tick).toBeCloseTo(10);
    clock.frame(5150);
    expect(player.getState().tick).toBeCloseTo(15);
  });

  it('caps a single frame at 250ms of elapsed time', () => {
    const { player, clock } = setup(100);
    player.load(1000);
    clock.frame(0);
    clock.frame(10_000);
    expect(player.getState().tick).toBeCloseTo(25);
  });

  it('ignores a clock that goes backwards', () => {
    const { player, clock } = setup(100);
    player.load(1000);
    clock.frame(1000);
    clock.frame(900);
    expect(player.getState().tick).toBe(0);
  });

  it('stops exactly at the end and requests no further frames', () => {
    const { player, clock } = setup(100);
    player.load(10);
    clock.frame(0);
    clock.frame(200); // would reach tick 20
    expect(player.getState()).toMatchObject({ tick: 10, playing: false });
    expect(clock.pending.size).toBe(0);
  });

  it('play() at the end restarts from 0', () => {
    const { player } = setup();
    player.load(10);
    player.finish();
    player.play();
    expect(player.getState()).toMatchObject({ tick: 0, playing: true });
  });

  it('play() with nothing loaded is a no-op', () => {
    const { player, clock } = setup();
    const listener = vi.fn();
    player.subscribe(listener);
    player.play();
    expect(player.getState().playing).toBe(false);
    expect(clock.pending.size).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('pause stops advancing and cancels the pending frame', () => {
    const { player, clock } = setup(100);
    player.load(100);
    clock.frame(0);
    clock.frame(100);
    player.pause();
    expect(player.getState()).toMatchObject({ playing: false });
    expect(clock.pending.size).toBe(0);
    const tick = player.getState().tick;
    clock.frame(500);
    expect(player.getState().tick).toBe(tick);
  });

  it('resuming after a pause does not jump by the paused time', () => {
    const { player, clock } = setup(100);
    player.load(1000);
    clock.frame(0);
    clock.frame(100);
    player.pause();
    player.play();
    clock.frame(100_000); // baseline only
    clock.frame(100_050);
    expect(player.getState().tick).toBeCloseTo(15);
  });

  it('toggle switches between playing and paused', () => {
    const { player } = setup();
    player.load(10, { autoplay: false });
    player.toggle();
    expect(player.getState().playing).toBe(true);
    player.toggle();
    expect(player.getState().playing).toBe(false);
  });

  it('seek clamps to the timeline', () => {
    const { player } = setup();
    player.load(10, { autoplay: false });
    player.seek(-5);
    expect(player.getState().tick).toBe(0);
    player.seek(4.5);
    expect(player.getState().tick).toBe(4.5);
    player.seek(99);
    expect(player.getState().tick).toBe(10);
    expect(() => player.seek(Number.NaN)).toThrow(RangeError);
  });

  it('seek while playing keeps playing without jumping on the next frame', () => {
    const { player, clock } = setup(100);
    player.load(1000);
    clock.frame(0);
    clock.frame(100);
    player.seek(500);
    clock.frame(200); // re-baselines only
    expect(player.getState()).toMatchObject({ tick: 500, playing: true });
    clock.frame(300);
    expect(player.getState().tick).toBeCloseTo(510);
  });

  it('seeking to the end while playing stops', () => {
    const { player, clock } = setup();
    player.load(10);
    player.seek(10);
    expect(player.getState()).toMatchObject({ tick: 10, playing: false });
    expect(clock.pending.size).toBe(0);
  });

  it('step pauses and moves by whole ticks from the floored position, clamped', () => {
    const { player, clock } = setup(100);
    player.load(10);
    clock.frame(0);
    clock.frame(35); // tick 3.5
    player.step(1);
    expect(player.getState()).toMatchObject({ tick: 4, playing: false });
    expect(clock.pending.size).toBe(0);
    player.step(-10);
    expect(player.getState().tick).toBe(0);
    player.step(100);
    expect(player.getState().tick).toBe(10);
    expect(() => player.step(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('finish jumps to the end and stops', () => {
    const { player, clock } = setup();
    player.load(42);
    player.finish();
    expect(player.getState()).toMatchObject({ tick: 42, playing: false });
    expect(clock.pending.size).toBe(0);
  });

  it('clear unloads the timeline', () => {
    const { player, clock } = setup();
    player.load(42);
    player.seek(10);
    player.clear();
    expect(player.getState()).toMatchObject({
      tick: 0,
      length: 0,
      playing: false,
    });
    expect(clock.pending.size).toBe(0);
  });

  it('setLength shrinking clamps the playhead (and stops if playing past the end)', () => {
    const { player, clock } = setup();
    player.load(100, { autoplay: false });
    player.seek(80);
    player.setLength(50);
    expect(player.getState()).toMatchObject({
      tick: 50,
      length: 50,
      playing: false,
    });

    player.load(100);
    player.seek(80);
    player.setLength(60);
    expect(player.getState()).toMatchObject({ tick: 60, playing: false });
    expect(clock.pending.size).toBe(0);
  });

  it('setLength growing keeps playing if playing, and does not resume a finished timeline', () => {
    const { player, clock } = setup();
    player.load(10);
    player.setLength(20);
    expect(player.getState()).toMatchObject({ length: 20, playing: true });
    expect(clock.pending.size).toBe(1);

    player.finish();
    player.setLength(30);
    expect(player.getState()).toMatchObject({
      tick: 20,
      length: 30,
      playing: false,
    });
    expect(clock.pending.size).toBe(0);
  });

  it('rejects invalid lengths', () => {
    const { player } = setup();
    expect(() => player.load(-1)).toThrow(RangeError);
    expect(() => player.load(Number.NaN)).toThrow(RangeError);
    expect(() => player.load(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => player.setLength(-1)).toThrow(RangeError);
  });

  it('setRate validates and takes effect mid-play', () => {
    const { player, clock } = setup(100);
    expect(() => player.setRate(0)).toThrow(RangeError);
    expect(() => player.setRate(-5)).toThrow(RangeError);
    expect(() => player.setRate(Number.NaN)).toThrow(RangeError);
    expect(() => new Player({ clock, rate: 0 })).toThrow(RangeError);

    player.load(1000);
    clock.frame(0);
    clock.frame(100); // 10 ticks
    player.setRate(1000);
    clock.frame(200); // +100 ticks
    expect(player.getState().tick).toBeCloseTo(110);
    expect(player.getState().rate).toBe(1000);
  });

  it('returns the same state object until something changes', () => {
    const { player } = setup();
    const initial = player.getState();
    expect(player.getState()).toBe(initial);
    player.pause(); // no-op
    expect(player.getState()).toBe(initial);
    player.load(10, { autoplay: false });
    const loaded = player.getState();
    expect(loaded).not.toBe(initial);
    expect(player.getState()).toBe(loaded);
  });

  it('notifies subscribers on changes only, and stops after unsubscribe', () => {
    const { player, clock } = setup(100);
    const listener = vi.fn();
    const unsubscribe = player.subscribe(listener);

    player.pause(); // already paused
    player.seek(0); // nothing loaded, tick already 0
    player.setRate(100); // unchanged
    expect(listener).not.toHaveBeenCalled();

    player.load(100);
    expect(listener).toHaveBeenCalledTimes(1);
    clock.frame(0); // baseline, no change
    expect(listener).toHaveBeenCalledTimes(1);
    clock.frame(50);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    clock.frame(100);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('dispose cancels the pending frame and prevents any further frames', () => {
    const { player, clock } = setup();
    player.load(100);
    player.dispose();
    expect(clock.pending.size).toBe(0);
    expect(player.getState().playing).toBe(false);
    player.play();
    player.load(50);
    expect(clock.pending.size).toBe(0);
    expect(player.getState().playing).toBe(false);
  });
});

describe('Player invariants (random operation sequences)', () => {
  type Op =
    | { kind: 'load'; length: number; autoplay: boolean }
    | { kind: 'play' | 'pause' | 'toggle' | 'finish' | 'clear' }
    | { kind: 'seek'; tick: number }
    | { kind: 'step'; delta: number }
    | { kind: 'setLength'; length: number }
    | { kind: 'setRate'; rate: number }
    | { kind: 'frame'; elapsed: number };

  const op: fc.Arbitrary<Op> = fc.oneof(
    fc.record({
      kind: fc.constant('load' as const),
      length: fc.integer({ min: 0, max: 200 }),
      autoplay: fc.boolean(),
    }),
    fc.constantFrom(
      { kind: 'play' as const },
      { kind: 'pause' as const },
      { kind: 'toggle' as const },
      { kind: 'finish' as const },
      { kind: 'clear' as const }
    ),
    fc.record({
      kind: fc.constant('seek' as const),
      tick: fc.double({ min: -50, max: 250, noNaN: true }),
    }),
    fc.record({
      kind: fc.constant('step' as const),
      delta: fc.integer({ min: -30, max: 30 }),
    }),
    fc.record({
      kind: fc.constant('setLength' as const),
      length: fc.integer({ min: 0, max: 200 }),
    }),
    fc.record({
      kind: fc.constant('setRate' as const),
      rate: fc.double({ min: 0.5, max: 2000, noNaN: true }),
    }),
    fc.record({
      kind: fc.constant('frame' as const),
      elapsed: fc.double({ min: 0, max: 1000, noNaN: true }),
    })
  );

  it('keeps 0 <= tick <= length, never plays at the end, and has at most one pending frame', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 80 }), ops => {
        const clock = new FakeClock();
        const player = new Player({ clock });
        let now = 0;
        for (const o of ops) {
          switch (o.kind) {
            case 'load':
              player.load(o.length, { autoplay: o.autoplay });
              break;
            case 'seek':
              player.seek(o.tick);
              break;
            case 'step':
              player.step(o.delta);
              break;
            case 'setLength':
              player.setLength(o.length);
              break;
            case 'setRate':
              player.setRate(o.rate);
              break;
            case 'frame':
              now += o.elapsed;
              clock.frame(now);
              break;
            default:
              player[o.kind]();
          }
          const { tick, length, playing } = player.getState();
          expect(tick).toBeGreaterThanOrEqual(0);
          expect(tick).toBeLessThanOrEqual(length);
          if (playing) {
            expect(tick).toBeLessThan(length);
            expect(clock.pending.size).toBe(1);
          } else {
            expect(clock.pending.size).toBe(0);
          }
          expect(clock.pending.size).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 500 }
    );
  });
});
