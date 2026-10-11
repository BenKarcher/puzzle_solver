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

// ---- Variable instances ----

export type VarKind = 'number' | 'boolean' | 'border' | 'line';

/**
 * How a variable instance is drawn on the canvas.
 * - 'digits'    (number kind): plain numerals in the cell-content slot pool
 * - 'objects'   (number/boolean kinds): emoji per value in the slot pool
 * - 'shading'   (boolean kind): full-cell fill (radial slices when several shading vars overlap)
 * - 'lines'     (border/line kinds): colored strokes on edges
 * - 'invisible' : exists for the solver only; no rendering, no tool
 */
export type VarRender = 'digits' | 'objects' | 'shading' | 'lines' | 'invisible';

export interface VariableInstance {
	/** Stable unique id (nanoid); referenced by varData and rule bindings */
	id: string;
	kind: VarKind;
	/** Display name (UI only — never used in MiniZinc) */
	name: string;
	/** number kind: value range */
	min?: number;
	max?: number;
	/** line kind: maximum lines between one cell pair */
	maxLinesPerPair?: number;
	render: VarRender;
	/** shading slice / line / border stroke color */
	color?: string;
	/** objects render: number kind → one emoji per domain value (min-first); boolean kind → [emoji] */
	emojis?: string[];
	/** Constant variable: all non-given positions are fixed to defaultValue at compile time */
	constant?: boolean;
	defaultValue?: number | boolean;
}

/** One position's state inside a variable grid */
export interface CellVarState {
	value: number | boolean | null;
	isGiven: boolean;
	/** pencil marks (numeric kinds only) */
	marks: number[];
}

/**
 * Per-instance value storage.
 * - number/boolean kinds: `cells` (rows × cols)
 * - border/line kinds: `h` ((rows+1) × cols, node-indexed going right) and
 *   `v` (rows × (cols+1), node-indexed going down). Line kinds only use interior slots.
 */
export interface VarGrid {
	cells?: CellVarState[][];
	h?: CellVarState[][];
	v?: CellVarState[][];
}

// ---- Cell data (per-variable values live in PuzzleState.varData) ----

export interface CellValue {
	regionId: number;
}

// ---- Rules ----

/**
 * Spaces a rule needs. Bindable spaces map to variable kinds:
 * digits→number, shading→boolean, borders→border, lines→line.
 * A kind may appear multiple times (the rule receives one binding per occurrence).
 * 'regions'/'positions' gate emission of the region/position data arrays.
 * 'coordinates' (local rules): each cell-bearing group also receives 1-indexed row/col arrays.
 */
export type RequiredSpace =
	| 'digits'
	| 'shading'
	| 'borders'
	| 'lines'
	| 'regions'
	| 'positions'
	| 'coordinates';

/** Spaces that can be passed as whole-grid predicate args (local rules) */
export type WholeGridSpace = 'digits' | 'shading' | 'borders' | 'lines';

export interface RuleGroupConfig {
	minSize: number;
	/** null = unbounded; 0 = cell-less (value-only group, skipped in predicate cell args) */
	maxSize: number | null;
	hasValue: boolean;
	valueLabel?: string;
	/** Pre-filled value when a new instance is created; cleared on first user keypress. */
	defaultValue?: number;
	/**
	 * When true, clicking any cell on the canvas replaces the whole group with every cell
	 * that shares the clicked cell's region ID. The solver receives the group cells normally —
	 * this only changes the editing UX.
	 */
	isRegion?: boolean;
	/**
	 * When true, the same cell may appear multiple times in the group (e.g. palindromes,
	 * region-sum lines). Left-click always appends; right-click removes the last occurrence.
	 */
	allowRepeats?: boolean;
}

export interface RuleConfig {
	id: string;
	name: string;
	description: string;
	categories: string[];
	requiredSpaces: RequiredSpace[];
	scope: 'global' | 'local';
	/**
	 * Local rules: whole variable grids passed as predicate args BEFORE any group args,
	 * in listed order. Each entry is a bindable occurrence (number/boolean → one array2d
	 * arg; border/line → two args h, v).
	 */
	wholeGrids?: WholeGridSpace[];
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
	/**
	 * Variable-instance ids, one per bindable occurrence of the rule:
	 * wholeGrids occurrences first, then requiredSpaces bindable occurrences in declared order.
	 * Empty/short arrays fall back to the first instance of each kind.
	 */
	bindings: string[];
}

/** One activation of a global rule (the same rule may be applied multiple times with different bindings) */
export interface GlobalRuleApplication {
	/** Unique application key (nanoid) */
	key: string;
	ruleId: string;
	/** Variable-instance ids aligned with the rule's bindable occurrences (see RuleInstance.bindings) */
	bindings: string[];
}

/** One resolved bindable occurrence, handed to TS generators */
export interface ResolvedBinding {
	kind: VarKind;
	varId: string;
	/** MZN array names: [name] for number/boolean, [h, v] for border/line */
	arrays: string[];
}

export interface GeneratorContext {
	/** Resolved bindings, wholeGrids occurrences first then requiredSpaces occurrences */
	bindings: ResolvedBinding[];
	/**
	 * Uniqueness suffix for this application ('' for the first application of a rule,
	 * '_2', '_3'... after). Append to any helper identifiers the generator declares.
	 */
	uniq: string;
}

export type GeneratorFn = (
	puzzle: PuzzleState,
	ctx: GeneratorContext,
	instance?: RuleInstance
) => string[];

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
	wholeGrids?: WholeGridSpace[];
	groups?: RuleGroupConfig[];
	/** For local rules: the predicate name used in the MiniZinc code */
	predicateName?: string;
	/** Shared import snippets (from src/lib/rules/imports/) to prepend once before constraints */
	imports?: string[];
}

// ---- Top-level puzzle state ----

/**
 * A named variable slot a ruleset exposes (kinds use the requiredSpaces
 * vocabulary). The optional fields are quickstart defaults for the variable
 * instance created from this slot.
 */
export interface RulesetVariable {
	name: string;
	kind: WholeGridSpace;
	render?: VarRender;
	color?: string;
	emojis?: string[];
	constant?: boolean;
	defaultValue?: number | boolean;
	min?: number;
	max?: number;
	maxLinesPerPair?: number;
}

export type RegionLayout = 'none' | 'all' | 'rectangular';

/** Quickstart defaults a ruleset can declare */
export interface RulesetDefaults {
	rows?: number;
	cols?: number;
	/** none = one big region; all = each cell its own region; rectangular = boxes */
	regions?: RegionLayout;
	boxRows?: number;
	boxCols?: number;
}

/**
 * A ruleset member: either a plain rule id (occurrences auto-map to the first
 * slot of their kind) or an explicit mapping of the rule's bindable occurrences
 * to ruleset slot indices.
 */
export type RulesetRuleEntry = string | { id: string; bindings: number[] };

export interface RulesetConfig {
	id: string;
	name: string;
	description: string;
	categories: string[];
	/**
	 * Variable slots this set exposes. Optional — when omitted, one slot per
	 * kind used by the member rules is inferred.
	 */
	variables?: RulesetVariable[];
	/** Quickstart defaults (grid size, region layout) */
	defaults?: RulesetDefaults;
	/** Rules from the library that belong to this set */
	rules: RulesetRuleEntry[];
}

/** An active ruleset: which variable instance fills each of the set's slots */
export interface RulesetActivation {
	rulesetId: string;
	/** Variable-instance ids, one per ruleset slot */
	bindings: string[];
}

export interface PuzzleState {
	name: string;
	dimensions: GridDimensions;
	/** The puzzle's variable instances, in display/slot order */
	variables: VariableInstance[];
	/** Per-instance value grids, keyed by VariableInstance.id */
	varData: Record<string, VarGrid>;
	/** Per-cell region membership */
	cells: CellValue[][];
	/** Region-editor scratch edges ((rows+1) × cols / rows × (cols+1)); true = region boundary */
	regionEdgesH: boolean[][];
	regionEdgesV: boolean[][];
	/** Global rule applications added individually by the user (not via a ruleset) */
	manualGlobalRules: GlobalRuleApplication[];
	/** Active rulesets with their slot bindings; their global rules are merged into globalRules by the store */
	activeRulesets: RulesetActivation[];
	/** Effective applications = manualGlobalRules ∪ (default-bound rules from activeRulesets). Kept in sync by the store. */
	globalRules: GlobalRuleApplication[];
	localRules: RuleInstance[];
	customRules: CustomRuleDefinition[];
	/**
	 * Remembered per-rule default bindings for new local instances. Updated when
	 * the user rebinds an instance and seeded by ruleset activation for member rules.
	 */
	ruleBindingDefaults: Record<string, string[]>;
}

// ---- UI types ----

export type AppMode = 'quickstart' | 'grid-setup' | 'setting' | 'solving' | 'region-edit';
export type SidebarTab = 'setup' | 'rules' | 'solver';
