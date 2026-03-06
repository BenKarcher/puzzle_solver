import type { CellCoord, EdgeCoord } from '$lib/model/types';

function coordKey(coord: CellCoord): string {
	return `${coord.row},${coord.col}`;
}

function edgeKey(coord: EdgeCoord): string {
	return `${coord.row},${coord.col},${coord.direction}`;
}

class SelectionStore {
	selectedCells = $state<Map<string, CellCoord>>(new Map());
	selectedEdges = $state<Map<string, EdgeCoord>>(new Map());
	isDragging = $state(false);

	get cells(): CellCoord[] {
		return Array.from(this.selectedCells.values());
	}

	get edges(): EdgeCoord[] {
		return Array.from(this.selectedEdges.values());
	}

	get hasCells(): boolean {
		return this.selectedCells.size > 0;
	}

	get hasEdges(): boolean {
		return this.selectedEdges.size > 0;
	}

	selectCell(coord: CellCoord, addToSelection: boolean = false): void {
		if (!addToSelection) {
			this.selectedCells = new Map();
			this.selectedEdges = new Map();
		}
		const key = coordKey(coord);
		if (this.selectedCells.has(key)) {
			this.selectedCells.delete(key);
			this.selectedCells = new Map(this.selectedCells);
		} else {
			this.selectedCells = new Map(this.selectedCells).set(key, coord);
		}
	}

	addCellToSelection(coord: CellCoord): void {
		const key = coordKey(coord);
		if (!this.selectedCells.has(key)) {
			this.selectedCells = new Map(this.selectedCells).set(key, coord);
		}
	}

	selectEdge(coord: EdgeCoord, addToSelection: boolean = false): void {
		if (!addToSelection) {
			this.selectedCells = new Map();
			this.selectedEdges = new Map();
		}
		const key = edgeKey(coord);
		if (this.selectedEdges.has(key)) {
			this.selectedEdges.delete(key);
			this.selectedEdges = new Map(this.selectedEdges);
		} else {
			this.selectedEdges = new Map(this.selectedEdges).set(key, coord);
		}
	}

	clearSelection(): void {
		this.selectedCells = new Map();
		this.selectedEdges = new Map();
	}

	isCellSelected(coord: CellCoord): boolean {
		return this.selectedCells.has(coordKey(coord));
	}

	isEdgeSelected(coord: EdgeCoord): boolean {
		return this.selectedEdges.has(edgeKey(coord));
	}

	startDrag(): void {
		this.isDragging = true;
	}

	endDrag(): void {
		this.isDragging = false;
	}
}

export const selection = new SelectionStore();
