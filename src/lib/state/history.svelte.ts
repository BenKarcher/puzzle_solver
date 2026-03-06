import type { PuzzleState } from '$lib/model/types';

const MAX_HISTORY = 200;

class HistoryManager {
	stack = $state<string[]>([]);
	pointer = $state(-1);

	get canUndo(): boolean {
		return this.pointer > 0;
	}

	get canRedo(): boolean {
		return this.pointer < this.stack.length - 1;
	}

	push(snapshot: PuzzleState): void {
		const serialized = JSON.stringify(snapshot);
		// If we're not at the end, discard the redo history
		if (this.pointer < this.stack.length - 1) {
			this.stack = this.stack.slice(0, this.pointer + 1);
		}
		this.stack.push(serialized);
		if (this.stack.length > MAX_HISTORY) {
			this.stack = this.stack.slice(this.stack.length - MAX_HISTORY);
		}
		this.pointer = this.stack.length - 1;
	}

	undo(): PuzzleState | null {
		if (!this.canUndo) return null;
		this.pointer--;
		return JSON.parse(this.stack[this.pointer]);
	}

	redo(): PuzzleState | null {
		if (!this.canRedo) return null;
		this.pointer++;
		return JSON.parse(this.stack[this.pointer]);
	}

	clear(): void {
		this.stack = [];
		this.pointer = -1;
	}
}

export const history = new HistoryManager();
