# Agent Definitions

## constraint-creator

Use this agent when the user asks to create a new puzzle constraint/rule.

### Instructions

You are creating a constraint rule for a puzzle solver app. Rules live in `src/lib/rules/library/<rule-id>/` and are auto-discovered by the registry via `import.meta.glob`.

### Category Tags

Use these standardized tags in `config.json` categories. Rules can have multiple tags.

**By puzzle genre:**
- `sudoku` — standard sudoku and all variant constraints (killer, thermo, arrow, sandwich, etc.)
- `latin-square` — latin square constraints (row/col uniqueness without regions)
- `kropki` — kropki dot constraints (consecutive, ratio)
- `aqre` — aqre-specific rules
- `nurimaze` — nurimaze rules
- `slitherlink` — slitherlink rules

**By mechanic:**
- `uniqueness` — all-different constraints
- `arithmetic` — sum, difference, ratio, product constraints
- `comparison` — greater-than, less-than, inequality
- `connectivity` — connected regions, paths
- `parity` — odd/even constraints
- `edge-clue` — clues placed between cells (dots, inequality signs, Xs/Vs)
- `cage` — outlined groups of cells with a constraint
- `line` — constraints along a drawn line (thermometer, palindrome, renban)
- `negative` — "if not marked, then NOT X" constraints (require generate.ts)
- `shading` — shaded/unshaded cell constraints
- `region` — region-based constraints

### Strategy Decision

There are two strategies. Pick based on the rule's needs:

#### Strategy 1: Pure MiniZinc (`rule.mzn` only)

Use when the constraint can be expressed purely in MiniZinc without inspecting the puzzle state.

- **Global rules**: Write bare constraints in `rule.mzn`. These are inlined directly into the model.
- **Local rules**: Write a **predicate** in `rule.mzn`. The compiler auto-generates one `constraint predicate_name(...)` call per instance, mapping group cells to `grid[r,c]` arrays and group values to int params.

```
# Example: global rule (latin-rows/rule.mzn)
include "alldifferent.mzn";
constraint forall(r in 1..rows)(alldifferent([grid[r, c] | c in 1..cols]));

# Example: local predicate (killer-cage/rule.mzn)
include "alldifferent.mzn";
predicate killer_cage(array[int] of var int: cells, int: target) =
    sum(cells) = target /\ alldifferent(cells);
```

#### Strategy 2: JS Generator (`generate.ts`)

Use when the constraint needs to inspect the puzzle state — e.g., negative constraints that scan all local rule instances, constraints that read region data, or constraints with complex conditional logic.

```typescript
// Signature for global rules (no instance param):
export default function generate(puzzle: PuzzleState): string[]

// Signature for local rules (with instance param):
export default function generate(puzzle: PuzzleState, instance?: RuleInstance): string[]
```

Returns an array of MiniZinc constraint strings. Each string should be a complete `constraint ...;` statement.

**When to use generate.ts:**
- Negative constraints ("if no dot, then cells do NOT differ by 1")
- Rules that need to read `puzzle.localRules` to find related instances
- Rules that need region data from `puzzle.cells[r][c].regionId`
- Complex conditional constraint generation

### Available MiniZinc Variables

The compiler declares these based on enabled solution spaces:

```minizinc
int: rows = N;  int: cols = M;  % always present
array[1..rows, 1..cols] of var MIN..MAX: grid;   % if numbers enabled
array[1..rows, 1..cols] of var bool: shaded;      % if shading enabled
array[1..rows-1, 1..cols] of var bool: border_h;  % if borders enabled
array[1..rows, 1..cols-1] of var bool: border_v;
array[1..rows-1, 1..cols] of var 0..N: line_h;    % if lines enabled
array[1..rows, 1..cols-1] of var 0..N: line_v;
array[1..rows, 1..cols] of int: region;            % if any cell has regionId != 0
```

**Important:** MiniZinc arrays are 1-indexed. When generating from JS, convert 0-indexed coords: `grid[row+1, col+1]`.

### File Structure

Each rule needs 1-3 files in `src/lib/rules/library/<rule-id>/`:

#### `config.json` (required)

```jsonc
{
  "id": "rule-id",           // must match folder name, used as MiniZinc predicate name (- → _)
  "name": "Display Name",
  "description": "Short description shown in UI",
  "categories": ["sudoku", "arithmetic"],  // see tags above
  "requiredSpaces": ["numbers"],           // which solution spaces must be enabled
  "scope": "global" | "local",
  // For local rules, define groups (omit for global):
  "groups": {
    "min": 1,              // minimum number of groups per instance
    "max": 1,              // maximum number of groups per instance
    "constraints": {
      "minSize": 2,        // min cells per group
      "maxSize": 2,        // max cells per group (null = unlimited)
      "hasValue": false,   // whether groups have a numeric value
      "valueLabel": "Sum"  // label shown in UI (only if hasValue: true)
    }
  }
}
```

#### `rule.mzn` (optional — Strategy 1)

Raw MiniZinc. Global rules contain bare constraints. Local rules contain a predicate definition.

#### `generate.ts` (optional — Strategy 2)

TypeScript module with `export default function generate(puzzle: PuzzleState, instance?: RuleInstance): string[]`.

#### `render.ts` (optional — visual rendering)

TypeScript module for drawing the rule on the canvas:

```typescript
import type { RuleInstance, RenderHelpers, PuzzleState } from '$lib/model/types';

export default function render(
  instance: RuleInstance,
  helpers: RenderHelpers,
  _puzzle: PuzzleState
): void {
  // Access groups: instance.groups[0].cells, instance.groups[0].value
  // Use helpers to draw (see API below)
}
```

### Render Helpers API

All coordinates use `CellCoord { row: number; col: number }` (0-indexed).
Sizes should be relative to `helpers.cellSize` for proper scaling.

| Method | Description |
|--------|-------------|
| `cellCenter(coord)` | Returns `{x, y}` pixel center of a cell |
| `cellTopLeft(coord)` | Returns `{x, y}` pixel top-left corner of a cell |
| `edgeMidpoint(from, to)` | Returns `{x, y}` midpoint between two cell centers |
| `cellSize` | Pixel size of one cell (use for relative sizing) |
| `line(from, to, color, width)` | Draw a line between two cell centers |
| `arrow(from, to, color)` | Draw an arrow from one cell center to another |
| `cage(cells, color, inset)` | Draw a dashed cage outline around a cell group. `inset` = distance from cell edge (use `cellSize * 0.07`) |
| `text(coord, text, position, fontSize, color)` | Draw text in a cell. `position`: `'center'`, `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'` |
| `dot(between, color, radius)` | Draw a filled circle at the midpoint between two adjacent cells |
| `circle(coord, color, radius, fill?)` | Draw a circle at a cell center. `fill` defaults to `true`; pass `false` for stroke only |
| `diamond(coord, color, size, fill?)` | Draw a diamond at a cell center |
| `edgeText(from, to, label, fontSize, color)` | Draw text at the midpoint between two cells |
| `cellFill(coord, color)` | Fill an entire cell with a color |
| `thermometer(cells, bulbColor, lineColor)` | Draw a thermometer: bulb at `cells[0]`, line through the rest |
| `ctx` | Raw `CanvasRenderingContext2D` for anything not covered above |

**Rendering tips:**
- **Graceful fallback**: If the group data is invalid for rendering (e.g., a dot rule where the two cells aren't orthogonally adjacent, or a group with too few cells), **skip rendering entirely** rather than drawing something in a confusing position. Always validate before drawing — `if (!group || group.cells.length !== 2) return;` at the top of render functions.
- Use `ctx.save()` / `ctx.restore()` when changing global canvas state
- Size everything relative to `cellSize` (e.g., `cellSize * 0.1` for dot radius)
- For outlined dots (like kropki), draw a filled dot then stroke the outline using `ctx` directly
- The rendering layer calls `ctx.save()`/`ctx.restore()` around each rule's render call

### Complete Examples

**Local rule with MiniZinc predicate + render (killer cage):**

`config.json`: scope "local", groups with hasValue: true, valueLabel: "Sum"
`rule.mzn`:
```minizinc
include "alldifferent.mzn";
predicate killer_cage(array[int] of var int: cells, int: target) =
    sum(cells) = target /\ alldifferent(cells);
```
`render.ts`: Uses `helpers.cage()` for dashed outline, `helpers.text()` for the sum label.

**Global negative constraint with JS generator:**

`config.json`: scope "global", no groups
`generate.ts`: Scans `puzzle.localRules` for related positive instances, emits `constraint ... != ...;` for all unmarked pairs.
No `rule.mzn` needed. No `render.ts` needed (nothing to draw for a negative constraint).
