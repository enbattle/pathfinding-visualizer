// Data structure with last-in-first-out (LIFO) policy
// Top of Stack is at the end
export class Stack {
	list: any[] = [];

	// Based on last-in-first-out (LIFO), items are pushed in front of the stack
	push(item: any) {
		this.list.unshift(item);
	}
	
	// Pop the top of the stack
	pop() {
		return this.list.shift();
	}

	// Peek at the top of the stack
	peek() {
		return this.list[0];
	}

	// Check if stack is empty
	isEmpty() {
		return this.list.length === 0;
	}

	// Print the stack (debugging purposes)
	print() {
		for (let i=0; i<this.list.length; i++) {
			console.log(this.list[i]);
		}
	}
}

// Data structure with first-in-first-out (FIFO) policy
// Top of Queue is at the end
export class Queue {
	list: any[] = [];

	// Based on first-in-first-out (FIFO), items are pushed to the back of the queue
	push(item: any) {
		this.list.push(item);
	}

	// Pop the front of the queue
	pop() {
		return this.list.shift();
	}

	// Peek at the front of the queue
	peek() {
		return this.list[0];
	}

	// Check if queue is empty
	isEmpty() {
		return this.list.length === 0;
	}

	// Print the queue (debugging purposes)
	print() {
		for (let i=0; i<this.list.length; i++) {
			console.log(this.list[i]);
		}
	}
}

// Class to create an item and have a priority associated with it
export class PriorityItem {
	item: any;
	priority: any;

	constructor(item: any, priority: any) {
		this.item = item
		this.priority = priority
	}
}

/* Data structure where the policy corresponds to the priority associated with 
   each item in the queue. Utilizes the lower priority item first (ascending order)
   (i.e shortest path algorithm, etc).
*/
export class PriorityQueueAscend {
	list: PriorityItem[] = [];

	comparator(itemA: any, itemB:any) {
		return parseFloat(itemA.priority) - parseFloat(itemB.priority);
	}

	// Push item into the priority queue, and sort it based on the comparator
	push(item: any, priority: any) {
		var newItem = new PriorityItem(item, priority);
		this.list.push(newItem);

		// Sort using a comparator
		this.list.sort(this.comparator);
	}

	// Pop the top of the priority queue
	pop() {
		return this.list.shift();
	}

	// Peek at the top of the priority queue (lowest priority item)
	peek() {
		return this.list[0];
	}

	// Check if priority queue is empty
	isEmpty() {
		return this.list.length === 0;
	}

	// Print the priority queue (debugging purposes)
	print() {
		for (let i=0; i<this.list.length; i++) {
			console.log(this.list[i].priority);
		}
	}

	printQueue() {
		let queue: PriorityItem[] = [];
		for (let i=0; i<this.list.length; i++) {
				queue.push(this.list[i].priority);
		}

		console.log(queue);
	}
}

/* Data structure where the policy corresponds to the priority associated with 
   each item in the queue. Utilizes the higher priority item first (descending order) 
   (market-highs, etc).
*/
export class PriorityQueueDescend {
	list: PriorityItem[] = [];

	comparator(itemA: any, itemB: any) {
		return parseFloat(itemB.priority) - parseFloat(itemA.priority);
	}

	// Push item into the priority, and then sort using the comparator
	push(item: any, priority: any) {
		var newItem = new PriorityItem(item, priority);
		this.list.push(newItem);

		// Sort using a comparator
		this.list.sort(this.comparator);
	}

	// Pop the top of the priority queue (highest priority item)
	pop() {
		return this.list.shift();
	}

	// Peek at the top of the priority queue
	peek() {
		return this.list[0];
	}

	// Check if priority queue is empty
	isEmpty() {
		return this.list.length === 0;
	}

	// Print the priority queue (debugging purposes)
	print() {
		for (let i=0; i<this.list.length; i++) {
			console.log(this.list[i].priority);
		}
	}

	printQueue() {
		let queue: PriorityItem[] = [];
		for (let i=0; i<this.list.length; i++) {
			queue.push(this.list[i].priority);
		}

		console.log(queue);
	}
}