interface CoordinateAndDirection {
  row: number;
  column: number;
  direction: string;
}

// A search-frontier entry: the coordinate being visited, and the path of
// coordinates taken to reach it from the start.
type SearchNode = [CoordinateAndDirection, CoordinateAndDirection[]];

// Data structure with last-in-first-out (LIFO) policy
// Top of Stack is at the end
class Stack<T> {
  list: T[] = [];

  // Based on last-in-first-out (LIFO), items are pushed in front of the stack
  push(item: T): void {
    this.list.unshift(item);
  }

  // Pop the top of the stack
  pop(): T | undefined {
    return this.list.shift();
  }

  // Peek at the top of the stack
  peek(): T | undefined {
    return this.list[0];
  }

  // Check if stack is empty
  isEmpty(): boolean {
    return this.list.length === 0;
  }
}

// Data structure with first-in-first-out (FIFO) policy
// Top of Queue is at the end
class Queue<T> {
  list: T[] = [];

  // Based on first-in-first-out (FIFO), items are pushed to the back of the queue
  push(item: T): void {
    this.list.push(item);
  }

  // Pop the front of the queue
  pop(): T | undefined {
    return this.list.shift();
  }

  // Peek at the front of the queue
  peek(): T | undefined {
    return this.list[0];
  }

  // Check if queue is empty
  isEmpty(): boolean {
    return this.list.length === 0;
  }
}

// Class to create an item and have a priority associated with it
class PriorityItem<T> {
  item: T;
  priority: number;

  constructor(item: T, priority: number) {
    this.item = item;
    this.priority = priority;
  }
}

// Binary-heap implementation backing the priority queue below, so push/pop
// are O(log n) instead of a full array sort on every insertion. Abstract
// rather than folded into PriorityQueueAscend directly so a descending-order
// variant can be added later without re-implementing the heap.
abstract class PriorityQueueHeap<T> {
  private heap: PriorityItem<T>[] = [];

  protected abstract comesBefore(a: PriorityItem<T>, b: PriorityItem<T>): boolean;

  // Push item into the priority queue
  push(item: T, priority: number): void {
    const node = new PriorityItem(item, priority);
    this.heap.push(node);
    this.siftUp(this.heap.length - 1);
  }

  // Pop the top of the priority queue
  pop(): PriorityItem<T> | undefined {
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop() as PriorityItem<T>;

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }

    return top;
  }

  // Peek at the top of the priority queue
  peek(): PriorityItem<T> | undefined {
    return this.heap[0];
  }

  // Check if priority queue is empty
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.comesBefore(this.heap[i], this.heap[parent])) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let i = index;
    const n = this.heap.length;

    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let best = i;

      if (left < n && this.comesBefore(this.heap[left], this.heap[best])) best = left;
      if (right < n && this.comesBefore(this.heap[right], this.heap[best])) best = right;
      if (best === i) break;

      [this.heap[i], this.heap[best]] = [this.heap[best], this.heap[i]];
      i = best;
    }
  }
}

/* Data structure where the policy corresponds to the priority associated with
   each item in the queue. Utilizes the lower priority item first (ascending
   order) (i.e shortest path algorithm, etc). */
class PriorityQueueAscend<T> extends PriorityQueueHeap<T> {
  protected comesBefore(a: PriorityItem<T>, b: PriorityItem<T>): boolean {
    return a.priority < b.priority;
  }
}

export type { CoordinateAndDirection, SearchNode };

export { Stack, Queue, PriorityItem, PriorityQueueAscend };
