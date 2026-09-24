// Playback over a timeline of integer "ticks" (one tick = one animation
// step: a discovered cell, a wall placement, ...). The Player only owns
// *where the playhead is* and how it moves over time; what a tick means is
// up to whoever renders it. Pure TypeScript: time comes from an injected
// FrameClock, so tests can drive frames deterministically.

/** Abstracts requestAnimationFrame so tests can drive frames deterministically. */
export interface FrameClock {
  request(callback: (timeMs: number) => void): number;
  cancel(handle: number): void;
}

/** Uses window.requestAnimationFrame / cancelAnimationFrame. */
const animationFrameClock: FrameClock = {
  request: callback => window.requestAnimationFrame(callback),
  cancel: handle => window.cancelAnimationFrame(handle),
};

export interface PlayerState {
  /** Playhead position in ticks, fractional, 0 <= tick <= length. */
  readonly tick: number;
  /** Total ticks in the loaded timeline (0 when nothing is loaded). */
  readonly length: number;
  readonly playing: boolean;
  /** Playback speed in ticks per second (> 0). */
  readonly rate: number;
}

// Longest wall-clock gap a single frame may advance by. A tab that was
// backgrounded (no frames) resumes from where it was instead of leaping
// ahead by however long it was hidden.
const MAX_FRAME_ELAPSED_MS = 250;

const DEFAULT_RATE = 100;

function assertLength(length: number): void {
  if (!Number.isFinite(length) || length < 0) {
    throw new RangeError(`Invalid timeline length ${length}`);
  }
}

/**
 * Moves a playhead across a timeline of `length` ticks at `rate` ticks per
 * second while playing. Observable via {@link Player.subscribe} /
 * {@link Player.getState}, which follow React's useSyncExternalStore
 * contract (getState returns the same object until something changes).
 */
export class Player {
  private readonly clock: FrameClock;
  private state: PlayerState;
  private readonly listeners = new Set<() => void>();
  private frameHandle: number | null = null;
  // Timestamp of the previous frame while playing; null means the next
  // frame only establishes the baseline and doesn't advance.
  private lastFrameTime: number | null = null;
  private disposed = false;

  constructor(options: { clock?: FrameClock; rate?: number } = {}) {
    const rate = options.rate ?? DEFAULT_RATE;
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new RangeError(`Invalid playback rate ${rate}`);
    }
    this.clock = options.clock ?? animationFrameClock;
    this.state = { tick: 0, length: 0, playing: false, rate };
  }

  /**
   * Immutable snapshot; the same object is returned until something changes.
   * (Bound, like subscribe, so both can be passed straight to
   * useSyncExternalStore.)
   */
  getState = (): PlayerState => this.state;

  /** Called after every state change (including every animation frame while playing). Returns unsubscribe. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Loads a timeline of `length` ticks at tick 0; plays immediately unless autoplay === false. */
  load(length: number, options: { autoplay?: boolean } = {}): void {
    assertLength(length);
    this.cancelFrame();
    const playing = !this.disposed && options.autoplay !== false && length > 0;
    this.commit({ tick: 0, length, playing });
    if (playing) this.startFrames();
  }

  /**
   * Changes the length without moving the playhead (clamped). Shrinking to
   * or below the playhead while playing stops playback at the new end;
   * growing a finished timeline doesn't resume it.
   */
  setLength(length: number): void {
    assertLength(length);
    const tick = Math.min(this.state.tick, length);
    const playing = this.state.playing && tick < length;
    if (!playing) this.cancelFrame();
    this.commit({ length, tick, playing });
  }

  /** Starts playback. No-op with nothing loaded; restarts from 0 if at the end. */
  play(): void {
    if (this.disposed || this.state.playing || this.state.length === 0) return;
    const tick = this.state.tick >= this.state.length ? 0 : this.state.tick;
    this.commit({ tick, playing: true });
    this.startFrames();
  }

  pause(): void {
    if (!this.state.playing) return;
    this.cancelFrame();
    this.commit({ playing: false });
  }

  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  /**
   * Moves the playhead (clamped to [0, length]) and keeps playing if it
   * was. Seeking to the very end while playing stops, like reaching it.
   */
  seek(tick: number): void {
    if (Number.isNaN(tick)) throw new RangeError('Cannot seek to NaN');
    const clamped = Math.min(Math.max(tick, 0), this.state.length);
    const playing = this.state.playing && clamped < this.state.length;
    if (this.state.playing) {
      if (playing)
        this.lastFrameTime = null; // no jump on the next frame
      else this.cancelFrame();
    }
    this.commit({ tick: clamped, playing });
  }

  /** Pauses, then moves by `delta` whole ticks from the current (floored) position, clamped. */
  step(delta: number): void {
    if (!Number.isFinite(delta)) throw new RangeError(`Invalid step ${delta}`);
    this.cancelFrame();
    const target = Math.floor(this.state.tick) + Math.trunc(delta);
    const tick = Math.min(Math.max(target, 0), this.state.length);
    this.commit({ tick, playing: false });
  }

  /** Jumps to the end and stops. */
  finish(): void {
    this.cancelFrame();
    this.commit({ tick: this.state.length, playing: false });
  }

  /** Unloads: length 0, tick 0, stopped. */
  clear(): void {
    this.cancelFrame();
    this.commit({ tick: 0, length: 0, playing: false });
  }

  /** Sets the playback speed in ticks per second; takes effect from the next frame. */
  setRate(ticksPerSecond: number): void {
    if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) {
      throw new RangeError(`Invalid playback rate ${ticksPerSecond}`);
    }
    this.commit({ rate: ticksPerSecond });
  }

  /** Cancels any pending frame; the player schedules no frames afterwards. */
  dispose(): void {
    this.disposed = true;
    this.cancelFrame();
    this.commit({ playing: false });
  }

  private startFrames(): void {
    this.lastFrameTime = null;
    this.requestFrame();
  }

  private requestFrame(): void {
    if (this.disposed || this.frameHandle !== null) return;
    this.frameHandle = this.clock.request(time => this.onFrame(time));
  }

  private cancelFrame(): void {
    if (this.frameHandle !== null) {
      this.clock.cancel(this.frameHandle);
      this.frameHandle = null;
    }
    this.lastFrameTime = null;
  }

  private onFrame(time: number): void {
    this.frameHandle = null;
    if (!this.state.playing || this.disposed) return;

    if (this.lastFrameTime === null) {
      this.lastFrameTime = time;
      this.requestFrame();
      return;
    }

    const elapsed = Math.min(
      Math.max(time - this.lastFrameTime, 0),
      MAX_FRAME_ELAPSED_MS
    );
    this.lastFrameTime = time;
    const next = this.state.tick + (elapsed / 1000) * this.state.rate;

    if (next >= this.state.length) {
      this.lastFrameTime = null;
      this.commit({ tick: this.state.length, playing: false });
      return;
    }
    this.commit({ tick: next });
    this.requestFrame();
  }

  // Applies `changes` and notifies listeners, but only if something
  // actually changed - each notification gets a fresh state object.
  private commit(changes: Partial<PlayerState>): void {
    const next = { ...this.state, ...changes };
    const current = this.state;
    if (
      next.tick === current.tick &&
      next.length === current.length &&
      next.playing === current.playing &&
      next.rate === current.rate
    ) {
      return;
    }
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }
}
