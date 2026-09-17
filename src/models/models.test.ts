import { describe, it, expect } from 'vitest';
import { Stack, Queue, PriorityQueueAscend } from './models';

describe('Stack', () => {
  it('pops in last-in-first-out order', () => {
    const stack = new Stack<string>();
    stack.push('a');
    stack.push('b');
    stack.push('c');

    expect(stack.pop()).toBe('c');
    expect(stack.pop()).toBe('b');
    expect(stack.pop()).toBe('a');
  });

  it('peek returns the top item without removing it', () => {
    const stack = new Stack<number>();
    stack.push(1);
    stack.push(2);

    expect(stack.peek()).toBe(2);
    expect(stack.pop()).toBe(2);
    expect(stack.peek()).toBe(1);
  });

  it('reports empty correctly and returns undefined when popped empty', () => {
    const stack = new Stack<number>();
    expect(stack.isEmpty()).toBe(true);
    expect(stack.pop()).toBeUndefined();
  });
});

describe('Queue', () => {
  it('pops in first-in-first-out order', () => {
    const queue = new Queue<string>();
    queue.push('a');
    queue.push('b');
    queue.push('c');

    expect(queue.pop()).toBe('a');
    expect(queue.pop()).toBe('b');
    expect(queue.pop()).toBe('c');
  });

  it('peek returns the front item without removing it', () => {
    const queue = new Queue<number>();
    queue.push(1);
    queue.push(2);

    expect(queue.peek()).toBe(1);
    expect(queue.pop()).toBe(1);
    expect(queue.peek()).toBe(2);
  });

  it('reports empty correctly and returns undefined when popped empty', () => {
    const queue = new Queue<number>();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.pop()).toBeUndefined();
  });
});

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
