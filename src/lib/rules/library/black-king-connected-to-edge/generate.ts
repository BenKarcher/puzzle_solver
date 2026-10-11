import type { GeneratorContext, PuzzleState } from '$lib/model/types';

export default function generate(puzzle: PuzzleState, ctx: GeneratorContext): string[] {
	const { rows, cols } = puzzle.dimensions;
	const [shaded] = ctx.bindings[0].arrays;
	const u = ctx.uniq; // suffix so multiple applications don't collide
	const CELL_N = rows * cols;
	const VIRTUAL = CELL_N + 1; // 1-indexed MZN node representing the grid boundary

	function cellNode(r: number, c: number): number {
		return (r - 1) * cols + c;
	}

	const fromArr: number[] = [];
	const toArr: number[] = [];

	// Horizontal adjacency
	for (let r = 1; r <= rows; r++)
		for (let c = 1; c < cols; c++) {
			fromArr.push(cellNode(r, c));
			toArr.push(cellNode(r, c + 1));
		}

	// Vertical adjacency
	for (let r = 1; r < rows; r++)
		for (let c = 1; c <= cols; c++) {
			fromArr.push(cellNode(r, c));
			toArr.push(cellNode(r + 1, c));
		}

	// NE diagonal: (r,c) → (r+1, c+1)
	for (let r = 1; r < rows; r++)
		for (let c = 1; c < cols; c++) {
			fromArr.push(cellNode(r, c));
			toArr.push(cellNode(r + 1, c + 1));
		}

	// NW diagonal: (r,c) → (r+1, c-1)
	for (let r = 1; r < rows; r++)
		for (let c = 2; c <= cols; c++) {
			fromArr.push(cellNode(r, c));
			toArr.push(cellNode(r + 1, c - 1));
		}

	// Border cells → virtual node (deduplicated via Set)
	const borderCells = new Set<number>();
	for (let c = 1; c <= cols; c++) {
		borderCells.add(cellNode(1, c));
		borderCells.add(cellNode(rows, c));
	}
	for (let r = 1; r <= rows; r++) {
		borderCells.add(cellNode(r, 1));
		borderCells.add(cellNode(r, cols));
	}
	for (const bc of borderCells) {
		fromArr.push(bc);
		toArr.push(VIRTUAL);
	}

	const N = CELL_N + 1;
	const E = fromArr.length;

	return [
		`array[1..${N}] of var bool: bkce_ns${u} = array1d(1..${N}, [${shaded}[r,c] | r in 1..rows, c in 1..cols] ++ [true]);`,
		`array[1..${E}] of int: bkce_from${u} = [${fromArr.join(', ')}];`,
		`array[1..${E}] of int: bkce_to${u} = [${toArr.join(', ')}];`,
		`array[1..${E}] of var bool: bkce_es${u} = [bkce_ns${u}[bkce_from${u}[e]] /\\ bkce_ns${u}[bkce_to${u}[e]] | e in 1..${E}];`,
		`constraint connected(bkce_from${u}, bkce_to${u}, bkce_ns${u}, bkce_es${u});`,
	];
}
