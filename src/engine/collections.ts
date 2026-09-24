// Frontier data structures for the search algorithms. Every operation is
// O(1) (Stack/Queue) or O(log n) (MinHeap) - the previous array-based
// Stack/Queue used unshift/shift, which is O(n) per operation.

/** Last-in, first-out. */
export class Stack<T> {
  private readonly items: T[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }
}

/**
 * First-in, first-out. Dequeuing advances a head index instead of calling
 * Array#shift (which re-indexes the whole array); consumed slots are
 * compacted away once they make up over half the backing array, so memory
 * stays proportional to the live queue.
 */
export class Queue<T> {
  private items: (T | undefined)[] = [];
  private head = 0;

  get size(): number {
    return this.items.length - this.head;
  }

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    if (this.head === this.items.length) return undefined;
    const item = this.items[this.head];
    this.items[this.head] = undefined;
    this.head++;
    if (this.head > 32 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return item;
  }
}

/**
 * Binary min-heap ordered by `priority`, then by `tiebreak` (both
 * ascending). The tiebreak is what lets A* prefer, among equally promising
 * cells, the one closest to the goal - which on open grids cuts the number
 * of expanded cells dramatically without affecting optimality.
 */
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly priorities: number[] = [];
  private readonly tiebreaks: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: T, priority: number, tiebreak = 0): void {
    this.items.push(item);
    this.priorities.push(priority);
    this.tiebreaks.push(tiebreak);
    this.siftUp(this.items.length - 1);
  }

  pop(): T | undefined {
    const count = this.items.length;
    if (count === 0) return undefined;
    const top = this.items[0];
    const lastItem = this.items.pop() as T;
    const lastPriority = this.priorities.pop() as number;
    const lastTiebreak = this.tiebreaks.pop() as number;
    if (count > 1) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      this.tiebreaks[0] = lastTiebreak;
      this.siftDown(0);
    }
    return top;
  }

  private before(a: number, b: number): boolean {
    const pa = this.priorities[a];
    const pb = this.priorities[b];
    return pa < pb || (pa === pb && this.tiebreaks[a] < this.tiebreaks[b]);
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.priorities[a], this.priorities[b]] = [
      this.priorities[b],
      this.priorities[a],
    ];
    [this.tiebreaks[a], this.tiebreaks[b]] = [
      this.tiebreaks[b],
      this.tiebreaks[a],
    ];
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(index: number): void {
    const count = this.items.length;
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let best = i;
      if (left < count && this.before(left, best)) best = left;
      if (right < count && this.before(right, best)) best = right;
      if (best === i) return;
      this.swap(i, best);
      i = best;
    }
  }
}
