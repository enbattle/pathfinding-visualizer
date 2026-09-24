import type { FrameClock } from '../player/player';

/**
 * A FrameClock that only advances when a test says so: `advance(ms)` runs
 * frames every `frameMs` until `ms` have passed, like a 60 fps display.
 */
export class FakeClock implements FrameClock {
  private now = 0;
  private nextHandle = 1;
  private readonly pending = new Map<number, (timeMs: number) => void>();

  request(callback: (timeMs: number) => void): number {
    const handle = this.nextHandle++;
    this.pending.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.pending.delete(handle);
  }

  get pendingFrames(): number {
    return this.pending.size;
  }

  /** Runs one frame at the current time plus `ms`. */
  frame(ms = 16): void {
    this.now += ms;
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback(this.now);
  }

  advance(ms: number, frameMs = 16): void {
    for (let elapsed = 0; elapsed < ms; elapsed += frameMs) this.frame(frameMs);
  }

  /** Runs frames until nothing is waiting for one (i.e. playback ended). */
  runUntilIdle(maxFrames = 100_000): void {
    for (let i = 0; i < maxFrames && this.pending.size > 0; i++) this.frame();
    if (this.pending.size > 0)
      throw new Error('FakeClock: still animating after maxFrames');
  }
}
