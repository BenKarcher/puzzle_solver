// ---- Grid geometry ----

export interface GridDimensions {
	rows: number;
	cols: number;
}

export interface CellCoord {
	row: number;
	col: number;
}

export interface EdgeCoord {
	row: number;
	col: number;
	direction: 'h' | 'v';
}

// ---- Solution spaces ----

export interface NumberPlacementConfig {
	enabled: boolean;
	min: number;
	max: number;
}

export interface ShadingConfig {
	enabled: boolean;
}

export interface BorderConfig {
	enabled: boolean;
}

export interface LineConfig {
	enabled: boolean;
	maxLinesPerPair: number;
}

export interface ModifierConfig {
	enabled: boolean;
	min: number;
	max: number;
}

export interface SolutionSpaces {
	numbers: NumberPlacementConfig;
	modifiers: ModifierConfig;
	shading: ShadingConfig;
	borders: BorderConfig;
	lines: LineConfig;
}

export type RequiredSpace = 'digits' | 'values' | 'modifier' | 'regions' | 'positions' | 'shading' | 'borders' | 'lines';

// ---- Cell data ----

export interface CellValue {
	number: number | null;
	numberIsGiven: boolean;
	shaded: boolean | null;
	shadedIsGiven: boolean;
	pencilMarks: number[];
	regionId: number;
}

// ---- Edge data ----

export interface EdgeValue {
	border: boolean | null;
	borderIsGiven: boolean;
	lines: number | null;
	lineIsGiven: boolean;
	linePencilMarks: number[];
}

// ---- Rules ----

export interface RuleGroupConfig {
	minSize: number;
	/** null = unbounded; 0 = cell-less (value-only group, skipped in predicate cell args) */
	maxSize: number | null;
	hasValue: boolean;
	valueLabel?: string;
}

export interface RuleConfig {
	id: string;
	name: string;
	description: string;
	categories: string[];
	requiredSpaces: RequiredSpace[];
	scope: 'global' | 'local';
	/** Per-group config; length = number of groups. Each group has independent constraints. */
	groups?: RuleGroupConfig[];
	/** Override predicate name (used by custom rules) */
	predicateName?: string;
	/** Shared MiniZinc snippets (from src/lib/rules/imports/) to prepend once before constraints */
	imports?: string[];
}

export interface RuleGroup {
	cells: CellCoord[];
	value: number | null;
}

export interface RuleInstance {
	ruleId: string;
	id: string;
	groups: RuleGroup[];
}

export type GeneratorFn = (puzzle: PuzzleState, instance?: RuleInstance) => string[];

export type RenderFn = (
	instance: RuleInstance,
	helpers: RenderHelpers,
	puzzle: PuzzleState
) => void;

export interface LoadedRule {
	config: RuleConfig;
	mzn?: string;
	generate?: GeneratorFn;
	render?: RenderFn;
}

// ---- Render helpers (passed to rule render functions) ----

export interface RenderHelpers {
	// Coordinate helpers
	cellCenter(coord: CellCoord): { x: number; y: number };
	cellTopLeft(coord: CellCoord): { x: number; y: number };
	edgeMidpoint(from: CellCoord, to: CellCoord): { x: number; y: number };
	cellSize: number;

	// Drawing primitives
	line(from: CellCoord, to: CellCoord, color: string, width: number): void;
	arrow(from: CellCoord, to: CellCoord, color: string): void;
	cage(cells: CellCoord[], color: string, inset: number): void;
	text(
		coord: CellCoord,
		text: string,
		position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
		fontSize: number,
		color: string
	): void;
	dot(between: [CellCoord, CellCoord], color: string, radius: number): void;
	circle(coord: CellCoord, color: string, radius: number, fill?: boolean): void;
	diamond(coord: CellCoord, color: string, size: number, fill?: boolean): void;
	edgeText(from: CellCoord, to: CellCoord, label: string, fontSize: number, color: string): void;
	cellFill(coord: CellCoord, color: string): void;
	thermometer(cells: CellCoord[], bulbColor: string, lineColor: string): void;

	// Raw canvas context for advanced rendering
	ctx: CanvasRenderingContext2D;
}

// ---- Custom rules ----

export interface CustomRuleDefinition {
	id: string;
	name: string;
	description: string;
	categories?: string[];
	scope: 'global' | 'local';
	mzn: string;
	requiredSpaces: RequiredSpace[];
	groups?: RuleGroupConfig[];
	/** For local rules: the predicate name used in the MiniZinc code */
	predicateName?: string;
	/** Shared import snippets (from src/lib/rules/imports/) to prepend once before constraints */
	imports?: string[];
}

// ---- Top-level puzzle state ----

export interface RulesetConfig {
	id: string;
	name: string;
	description: string;
	categories: string[];
	/** Rule IDs from the library that belong to this set */
	rules: string[];
}

export interface PuzzleState {
	name: string;
	dimensions: GridDimensions;
	solutionSpaces: SolutionSpaces;
	cells: CellValue[][];
	hEdges: EdgeValue[][];
	vEdges: EdgeValue[][];
	/** Global rules toggled on individually by the user (not via a ruleset) */
	manualGlobalRules: string[];
	/** Active ruleset IDs; their global rules are merged into globalRules by the store */
	activeRulesets: string[];
	/** Effective global rules = manualGlobalRules ∪ (rules from all activeRulesets). Kept in sync by the store. */
	globalRules: string[];
	localRules: RuleInstance[];
	customRules: CustomRuleDefinition[];
}

// ---- UI types ----

export type AppMode = 'grid-setup' | 'setting' | 'solving' | 'region-edit';
export type ActiveTool = 'number' | 'shading' | 'border' | 'line';
export type SidebarTab = 'setup' | 'rules' | 'solver';
