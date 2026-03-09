import type { PuzzleState, LoadedRule, RuleConfig, RuleInstance } from '$lib/model/types';

/**
 * Compile a PuzzleState + loaded rules into a complete MiniZinc model string.
 */
export interface CompileOptions {
	randomSearch?: boolean;
}

export function compilePuzzle(puzzle: PuzzleState, rules: LoadedRule[], options?: CompileOptions): string {
	const lines: string[] = [];

	// 1. Dimensions
	lines.push(`int: rows = ${puzzle.dimensions.rows};`);
	lines.push(`int: cols = ${puzzle.dimensions.cols};`);
	lines.push('');

	// 2. Variable declarations
	if (puzzle.solutionSpaces.numbers.enabled) {
		const { min, max } = puzzle.solutionSpaces.numbers;
		lines.push(`array[1..rows, 1..cols] of var ${min}..${max}: grid;`);
	}

	if (puzzle.solutionSpaces.shading.enabled) {
		lines.push('array[1..rows, 1..cols] of var bool: shaded;');
	}

	if (puzzle.solutionSpaces.borders.enabled) {
		// Borders include outer boundary edges
		lines.push('array[1..rows+1, 1..cols] of var bool: border_h;');
		lines.push('array[1..rows, 1..cols+1] of var bool: border_v;');
	}

	if (puzzle.solutionSpaces.lines.enabled) {
		// line_h = horizontal lines (left-right between adjacent cells)
		// line_v = vertical lines (up-down between adjacent cells)
		const maxLines = puzzle.solutionSpaces.lines.maxLinesPerPair;
		lines.push(`array[1..rows, 1..cols-1] of var 0..${maxLines}: line_h;`);
		lines.push(`array[1..rows-1, 1..cols] of var 0..${maxLines}: line_v;`);
	}

	if (puzzle.solutionSpaces.borders.enabled || puzzle.solutionSpaces.lines.enabled) {
		lines.push('int: TOP = 1; int: RIGHT = 2; int: BOTTOM = 3; int: LEFT = 4;');
	}

	lines.push('');

	// 3. Region data
	if (hasRegions(puzzle)) {
		const regionData = puzzle.cells
			.map((row) => row.map((c) => c.regionId).join(', '))
			.join(',\n  ');
		lines.push(`array[1..rows, 1..cols] of int: region = array2d(1..rows, 1..cols, [\n  ${regionData}\n]);`);
		lines.push('');
	}

	// 4. Given constraints
	const givenLines = compileGivens(puzzle);
	if (givenLines.length > 0) {
		lines.push('% Givens');
		lines.push(...givenLines);
		lines.push('');
	}

	// 5. Collect which rules are actually used
	const usedRuleIds = new Set<string>([
		...puzzle.globalRules,
		...puzzle.localRules.map((inst) => inst.ruleId)
	]);

	// 6. Include rule predicate definitions / constraints from .mzn files
	const includedMzn = new Set<string>();
	for (const ruleId of usedRuleIds) {
		const rule = rules.find((r) => r.config.id === ruleId);
		if (!rule?.mzn) continue;

		// Avoid including the same .mzn content twice
		if (includedMzn.has(ruleId)) continue;
		includedMzn.add(ruleId);

		lines.push(`% Rule: ${rule.config.name}`);

		if (rule.config.scope === 'global') {
			// Global rules: .mzn contains bare constraints, include directly
			lines.push(rule.mzn);
		} else {
			// Local rules: .mzn contains a predicate definition
			lines.push(rule.mzn);
		}
		lines.push('');
	}

	// 7. Generate constraints from JS generators (global rules)
	for (const ruleId of puzzle.globalRules) {
		const rule = rules.find((r) => r.config.id === ruleId);
		if (!rule?.generate) continue;

		lines.push(`% Generated: ${rule.config.name}`);
		const constraints = rule.generate(puzzle);
		lines.push(...constraints);
		lines.push('');
	}

	// 8. Generate constraint calls for local rule instances
	for (const instance of puzzle.localRules) {
		const rule = rules.find((r) => r.config.id === instance.ruleId);
		if (!rule) continue;

		if (rule.generate) {
			lines.push(`% Generated: ${rule.config.name} (instance)`);
			const constraints = rule.generate(puzzle, instance);
			lines.push(...constraints);
		} else if (rule.mzn && rule.config.scope === 'local') {
			const call = generatePredicateCall(rule.config, instance, puzzle);
			if (call) {
				lines.push(call);
			}
		}
	}

	lines.push('');

	if (options?.randomSearch) {
		const searchAnnotations: string[] = [];
		if (puzzle.solutionSpaces.numbers.enabled) {
			searchAnnotations.push(
				'int_search([grid[i,j] | i in 1..rows, j in 1..cols], first_fail, indomain_random)'
			);
		}
		if (puzzle.solutionSpaces.shading.enabled) {
			searchAnnotations.push(
				'bool_search([shaded[i,j] | i in 1..rows, j in 1..cols], input_order, indomain_random)'
			);
		}
		if (puzzle.solutionSpaces.borders.enabled) {
			searchAnnotations.push(
				'bool_search([border_h[i,j] | i in 1..rows+1, j in 1..cols] ++ [border_v[i,j] | i in 1..rows, j in 1..cols+1], input_order, indomain_random)'
			);
		}
		if (puzzle.solutionSpaces.lines.enabled) {
			searchAnnotations.push(
				'int_search([line_h[i,j] | i in 1..rows, j in 1..cols-1] ++ [line_v[i,j] | i in 1..rows-1, j in 1..cols], first_fail, indomain_random)'
			);
		}
		if (searchAnnotations.length > 0) {
			lines.push(`solve :: seq_search([${searchAnnotations.join(', ')}]) satisfy;`);
		} else {
			lines.push('solve satisfy;');
		}
	} else {
		lines.push('solve satisfy;');
	}

	return lines.join('\n');
}

function compileGivens(puzzle: PuzzleState): string[] {
	const lines: string[] = [];
	const { rows, cols } = puzzle.dimensions;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cell = puzzle.cells[r][c];
			const mznR = r + 1;
			const mznC = c + 1;

			if (puzzle.solutionSpaces.numbers.enabled && cell.numberIsGiven && cell.number !== null) {
				lines.push(`constraint grid[${mznR},${mznC}] = ${cell.number};`);
			}

			if (puzzle.solutionSpaces.shading.enabled && cell.shadedIsGiven && cell.shaded !== null) {
				lines.push(`constraint shaded[${mznR},${mznC}] = ${cell.shaded};`);
			}
		}
	}

	// Border edge givens (includes outer boundary)
	if (puzzle.solutionSpaces.borders.enabled) {
		for (let r = 0; r <= rows; r++) {
			for (let c = 0; c < cols; c++) {
				const edge = puzzle.hEdges[r]?.[c];
				if (edge?.borderIsGiven && edge.border !== null) {
					lines.push(`constraint border_h[${r + 1},${c + 1}] = ${edge.border};`);
				}
			}
		}
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c <= cols; c++) {
				const edge = puzzle.vEdges[r]?.[c];
				if (edge?.borderIsGiven && edge.border !== null) {
					lines.push(`constraint border_v[${r + 1},${c + 1}] = ${edge.border};`);
				}
			}
		}
	}

	// Line edge givens (interior only)
	if (puzzle.solutionSpaces.lines.enabled) {
		// line_h = horizontal lines on vEdges[r][c] with c=1..cols-1
		for (let r = 0; r < rows; r++) {
			for (let c = 1; c < cols; c++) {
				const edge = puzzle.vEdges[r]?.[c];
				if (edge?.lineIsGiven && edge.lines !== null) {
					lines.push(`constraint line_h[${r + 1},${c}] = ${edge.lines};`);
				}
			}
		}
		// line_v = vertical lines on hEdges[r][c] with r=1..rows-1
		for (let r = 1; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const edge = puzzle.hEdges[r]?.[c];
				if (edge?.lineIsGiven && edge.lines !== null) {
					lines.push(`constraint line_v[${r},${c + 1}] = ${edge.lines};`);
				}
			}
		}
	}

	return lines;
}

function generatePredicateCall(
	config: RuleConfig,
	instance: RuleInstance,
	puzzle: PuzzleState
): string | null {
	if (instance.groups.length === 0) return null;

	// Convert config.id to valid MiniZinc identifier (or use explicit override)
	const predicateName = config.predicateName ?? config.id.replace(/-/g, '_');

	const reqSpaces = config.requiredSpaces;
	const args: string[] = [];
	for (const group of instance.groups) {
		if (group.cells.length === 0) continue;

		// If this group requires a value but doesn't have one, skip the whole constraint
		if (config.groups?.constraints.hasValue && group.value === null) return null;

		// Pass cell arrays for each solution space the rule requires
		if (reqSpaces.includes('numbers')) {
			const cellRefs = group.cells
				.map((c) => `grid[${c.row + 1},${c.col + 1}]`)
				.join(', ');
			args.push(`[${cellRefs}]`);
		}

		if (reqSpaces.includes('shading')) {
			const shadingRefs = group.cells
				.map((c) => `shaded[${c.row + 1},${c.col + 1}]`)
				.join(', ');
			args.push(`[${shadingRefs}]`);
		}

		if (reqSpaces.includes('borders')) {
			const { rows, cols } = puzzle.dimensions;
			const edgeRefs: string[] = [];
			for (const cell of group.cells) {
				const r = cell.row;
				const c = cell.col;
				const mznR = r + 1;
				const mznC = c + 1;
				// All border edges always exist (including outer boundary)
				const top = `border_h[${mznR},${mznC}]`;
				const bottom = `border_h[${mznR + 1},${mznC}]`;
				const left = `border_v[${mznR},${mznC}]`;
				const right = `border_v[${mznR},${mznC + 1}]`;
				edgeRefs.push(top, right, bottom, left);
			}
			const n = group.cells.length;
			args.push(`array2d(1..${n}, 1..4, [${edgeRefs.join(', ')}])`);
		}

		if (reqSpaces.includes('lines')) {
			const { rows, cols } = puzzle.dimensions;
			const edgeRefs: string[] = [];
			for (const cell of group.cells) {
				const r = cell.row;
				const c = cell.col;
				// Lines are interior only — boundary cells get constant 0
				const top = r > 0 ? `line_v[${r},${c + 1}]` : '0';
				const bottom = r < rows - 1 ? `line_v[${r + 1},${c + 1}]` : '0';
				const left = c > 0 ? `line_h[${r + 1},${c}]` : '0';
				const right = c < cols - 1 ? `line_h[${r + 1},${c + 1}]` : '0';
				edgeRefs.push(top, right, bottom, left);
			}
			const n = group.cells.length;
			args.push(`array2d(1..${n}, 1..4, [${edgeRefs.join(', ')}])`);
		}

		if (config.groups?.constraints.hasValue) {
			args.push(`${group.value}`);
		}
	}

	if (args.length === 0) return null;
	return `constraint ${predicateName}(${args.join(', ')});`;
}

function hasRegions(puzzle: PuzzleState): boolean {
	for (const row of puzzle.cells) {
		for (const cell of row) {
			if (cell.regionId !== 0) return true;
		}
	}
	return false;
}
