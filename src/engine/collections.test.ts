import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MinHeap, Queue, Stack } from './collections';

// A random interleaving of pushes (a number) and pops (null).
const operations = fc.array(fc.option(fc.integer(), { nil: null, freq: 3 }), {
  maxLength: 300,
});

describe('Stack', () => {
  it('behaves like an array used as a LIFO stack', () => {
    fc.assert(
      fc.property(operations, ops => {
        const stack = new Stack<number>();
        const model: number[] = [];
        for (const op of ops) {
          if (op === null) expect(stack.pop()).toBe(model.pop());
          else {
            stack.push(op);
            model.push(op);
          }
          expect(stack.size).toBe(model.length);
        }
      })
    );
  });
});

describe('Queue', () => {
  it('behaves like an array used as a FIFO queue', () => {
    fc.assert(
      fc.property(operations, ops => {
        const queue = new Queue<number>();
        const model: number[] = [];
        for (const op of ops) {
          if (op === null) expect(queue.pop()).toBe(model.shift());
          else {
            queue.push(op);
            model.push(op);
          }
          expect(queue.size).toBe(model.length);
        }
      })
    );
  });

  it('keeps FIFO order across internal compaction', () => {
    const queue = new Queue<number>();
    for (let i = 0; i < 1000; i++) queue.push(i);
    for (let i = 0; i < 700; i++) expect(queue.pop()).toBe(i);
    for (let i = 1000; i < 1100; i++) queue.push(i);
    for (let i = 700; i < 1100; i++) expect(queue.pop()).toBe(i);
    expect(queue.pop()).toBeUndefined();
    expect(queue.size).toBe(0);
  });
});

describe('MinHeap', () => {
  it('pops in (priority, tiebreak) order under any interleaving of pushes and pops', () => {
    const entry = fc.record({
      priority: fc.integer({ min: 0, max: 20 }),
      tiebreak: fc.integer({ min: 0, max: 5 }),
    });
    fc.assert(
      fc.property(
        fc.array(fc.option(entry, { nil: null, freq: 3 }), { maxLength: 300 }),
        ops => {
          const heap = new MinHeap<{ priority: number; tiebreak: number }>();
          const model: { priority: number; tiebreak: number }[] = [];
          const key = (e: { priority: number; tiebreak: number }) =>
            e.priority * 100 + e.tiebreak;
          for (const op of ops) {
            if (op === null) {
              const popped = heap.pop();
              if (model.length === 0) {
                expect(popped).toBeUndefined();
              } else {
                const smallest = Math.min(...model.map(key));
                expect(popped && key(popped)).toBe(smallest);
                model.splice(
                  model.findIndex(e => key(e) === smallest),
                  1
                );
              }
            } else {
              heap.push(op, op.priority, op.tiebreak);
              model.push(op);
            }
            expect(heap.size).toBe(model.length);
          }
        }
      )
    );
  });
});
