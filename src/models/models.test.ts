import { describe, it, expect } from 'vitest';
import { PriorityQueueAscend, PriorityQueueDescend } from './models';

describe('PriorityQueueAscend', () => {
  it('pops the lowest-priority item first across a mixed sequence of pushes', () => {
    const queue = new PriorityQueueAscend<string>();
    queue.push('c', 3);
    queue.push('a', 1);
    queue.push('e', 5);
    queue.push('b', 2);
    queue.push('d', 4);

    const order = [];
    while (!queue.isEmpty()) {
      order.push(queue.pop()?.item);
    }

    expect(order).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('maintains heap order under interleaved pushes and pops', () => {
    const queue = new PriorityQueueAscend<number>();
    queue.push(10, 10);
    queue.push(5, 5);
    expect(queue.pop()?.priority).toBe(5);

    queue.push(1, 1);
    queue.push(20, 20);
    // Lowest remaining priority (1) must come out before the older, higher one (10)
    expect(queue.pop()?.priority).toBe(1);
    expect(queue.pop()?.priority).toBe(10);
    expect(queue.pop()?.priority).toBe(20);
  });

  it('reports empty correctly and returns undefined when popped empty', () => {
    const queue = new PriorityQueueAscend<number>();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.pop()).toBeUndefined();
  });
});

describe('PriorityQueueDescend', () => {
  it('pops the highest-priority item first', () => {
    const queue = new PriorityQueueDescend<string>();
    queue.push('low', 1);
    queue.push('high', 100);
    queue.push('mid', 50);

    expect(queue.pop()?.item).toBe('high');
    expect(queue.pop()?.item).toBe('mid');
    expect(queue.pop()?.item).toBe('low');
  });
});
