<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';

	const presetModules = import.meta.glob('$lib/presets/*.json', {
		eager: true,
		import: 'default',
	}) as Record<string, unknown>;

	const presets = Object.entries(presetModules)
		.map(([path, data]) => {
			const filename = path.split('/').pop() ?? path;
			const label = filename.replace(/\.json$/, '').replace(/_/g, ' ');
			return { label, data };
		})
		.sort((a, b) => a.label.localeCompare(b.label));

	function loadPreset(data: unknown) {
		puzzleStore.importJSON(JSON.stringify(data));
	}

	let rowsInput = $state(puzzleStore.rows);
	let colsInput = $state(puzzleStore.cols);

	function applyDimensions() {
		if (rowsInput >= 1 && rowsInput <= 30 && colsInput >= 1 && colsInput <= 30) {
			puzzleStore.setDimensions(rowsInput, colsInput);
		}
	}

	function toggleNumbers() {
		const current = puzzleStore.puzzle.solutionSpaces.numbers;
		puzzleStore.updateSolutionSpaces({
			numbers: { ...current, enabled: !current.enabled }
		});
	}

	function setNumberRange(min: number, max: number) {
		const current = puzzleStore.puzzle.solutionSpaces.numbers;
		puzzleStore.updateSolutionSpaces({
			numbers: { ...current, min, max }
		});
	}

	function toggleModifiers() {
		const current = puzzleStore.puzzle.solutionSpaces.modifiers;
		puzzleStore.updateSolutionSpaces({
			modifiers: { ...current, enabled: !current.enabled }
		});
	}

	function setModifierRange(min: number, max: number) {
		const current = puzzleStore.puzzle.solutionSpaces.modifiers;
		puzzleStore.updateSolutionSpaces({
			modifiers: { ...current, min, max }
		});
	}

	function toggleShading() {
		const current = puzzleStore.puzzle.solutionSpaces.shading;
		puzzleStore.updateSolutionSpaces({
			shading: { enabled: !current.enabled }
		});
	}

	function toggleBorders() {
		const current = puzzleStore.puzzle.solutionSpaces.borders;
		puzzleStore.updateSolutionSpaces({
			borders: { enabled: !current.enabled }
		});
	}

	function toggleLines() {
		const current = puzzleStore.puzzle.solutionSpaces.lines;
		puzzleStore.updateSolutionSpaces({
			lines: { ...current, enabled: !current.enabled }
		});
	}

	function setMaxLines(max: number) {
		const current = puzzleStore.puzzle.solutionSpaces.lines;
		puzzleStore.updateSolutionSpaces({
			lines: { ...current, maxLinesPerPair: Math.max(1, max) }
		});
	}
</script>

<div class="panel">
	<!-- App intro card -->
	<div class="intro-card">
		<p class="intro-title">Build &amp; verify logic puzzles</p>
		<ol class="intro-steps">
			<li><strong>Setup</strong> — choose grid size and variable types</li>
			<li><strong>Regions</strong> — group cells for box/region rules</li>
			<li><strong>Design</strong> — enter clue numbers and add rules</li>
			<li><strong>Solve</strong> — let the solver verify your puzzle</li>
		</ol>
		<p class="intro-note">💡 Start with a preset below, or configure from scratch.</p>
	</div>

	{#if presets.length > 0}
		<h3>Presets</h3>
		<div class="presets">
			{#each presets as preset}
				<button class="btn preset-btn" onclick={() => loadPreset(preset.data)}>
					{preset.label}
				</button>
			{/each}
		</div>
	{/if}

	<h3>Grid Size</h3>
	<div class="row">
		<label>
			Rows
			<input type="number" bind:value={rowsInput} min="1" max="30" />
		</label>
		<label>
			Columns
			<input type="number" bind:value={colsInput} min="1" max="30" />
		</label>
		<button class="btn" onclick={applyDimensions}>Apply</button>
	</div>

	<h3>Variable Types
		<span class="section-tip" title="Choose what kinds of values the solver will assign to cells. You must enable at least one to proceed.">ⓘ</span>
	</h3>
	<p class="section-hint">What can each cell hold? Enable the types you need for your puzzle.</p>

	<label class="checkbox-row">
		<input
			type="checkbox"
			checked={puzzleStore.puzzle.solutionSpaces.numbers.enabled}
			onchange={toggleNumbers}
		/>
		<span>
			Numbers
			<span class="space-hint">— a digit placed in the cell (e.g. 1–9 for sudoku)</span>
		</span>
	</label>
	{#if puzzleStore.puzzle.solutionSpaces.numbers.enabled}
		<div class="indent">
			<div class="row">
				<label>
					Min
					<input
						type="number"
						value={puzzleStore.puzzle.solutionSpaces.numbers.min}
						min="0"
						max="9"
						onchange={(e) => setNumberRange(
							parseInt((e.target as HTMLInputElement).value),
							puzzleStore.puzzle.solutionSpaces.numbers.max
						)}
					/>
				</label>
				<label>
					Max
					<input
						type="number"
						value={puzzleStore.puzzle.solutionSpaces.numbers.max}
						min="1"
						max="9"
						onchange={(e) => setNumberRange(
							puzzleStore.puzzle.solutionSpaces.numbers.min,
							parseInt((e.target as HTMLInputElement).value)
						)}
					/>
				</label>
			</div>
		</div>
	{/if}

	{#if puzzleStore.puzzle.solutionSpaces.numbers.enabled}
		<label class="checkbox-row">
			<input
				type="checkbox"
				checked={puzzleStore.puzzle.solutionSpaces.modifiers.enabled}
				onchange={toggleModifiers}
			/>
			<span>
				Secondary Values
				<span class="space-hint advanced" title="Advanced: a second independent number per cell. When enabled, rules can constrain both the displayed digit and this hidden value separately — used in modifier puzzles where cells carry two distinct numeric attributes.">ⓘ advanced</span>
			</span>
		</label>
		{#if puzzleStore.puzzle.solutionSpaces.modifiers.enabled}
			<div class="indent">
				<div class="row">
					<label>
						Min
						<input
							type="number"
							value={puzzleStore.puzzle.solutionSpaces.modifiers.min}
							onchange={(e) => setModifierRange(
								parseInt((e.target as HTMLInputElement).value),
								puzzleStore.puzzle.solutionSpaces.modifiers.max
							)}
						/>
					</label>
					<label>
						Max
						<input
							type="number"
							value={puzzleStore.puzzle.solutionSpaces.modifiers.max}
							onchange={(e) => setModifierRange(
								puzzleStore.puzzle.solutionSpaces.modifiers.min,
								parseInt((e.target as HTMLInputElement).value)
							)}
						/>
					</label>
				</div>
				<p class="hint">Rules can reference both the cell's digit and this value independently.</p>
			</div>
		{/if}
	{/if}

	<label class="checkbox-row">
		<input
			type="checkbox"
			checked={puzzleStore.puzzle.solutionSpaces.shading.enabled}
			onchange={toggleShading}
		/>
		<span>
			Shading
			<span class="space-hint">— each cell is either shaded or unshaded (e.g. Nurikabe, Hitori)</span>
		</span>
	</label>

	<label class="checkbox-row">
		<input
			type="checkbox"
			checked={puzzleStore.puzzle.solutionSpaces.borders.enabled}
			onchange={toggleBorders}
		/>
		<span>
			Borders
			<span class="space-hint">— edges between cells can be on or off (e.g. Slitherlink)</span>
		</span>
	</label>

	<label class="checkbox-row">
		<input
			type="checkbox"
			checked={puzzleStore.puzzle.solutionSpaces.lines.enabled}
			onchange={toggleLines}
		/>
		<span>
			Lines
			<span class="space-hint">— edges between cells carry a numeric count (e.g. Hashiwokakero)</span>
		</span>
	</label>
	{#if puzzleStore.puzzle.solutionSpaces.lines.enabled}
		<div class="indent">
			<div class="row">
				<label>
					Max bridges per pair
					<input
						type="number"
						value={puzzleStore.puzzle.solutionSpaces.lines.maxLinesPerPair}
						min="1"
						max="9"
						onchange={(e) => setMaxLines(parseInt((e.target as HTMLInputElement).value))}
					/>
				</label>
			</div>
		</div>
	{/if}
</div>

<style>
	.panel {
		padding: 12px;
	}

	/* ── Intro card ── */
	.intro-card {
		background: #f0f4ff;
		border: 1px solid #c7d7f7;
		border-radius: 6px;
		padding: 10px 12px;
		margin-bottom: 14px;
	}

	.intro-title {
		margin: 0 0 6px;
		font-size: 13px;
		font-weight: 600;
		color: #2c4a8c;
	}

	.intro-steps {
		margin: 0 0 6px;
		padding-left: 18px;
		font-size: 12px;
		color: #444;
		line-height: 1.7;
	}

	.intro-note {
		margin: 0;
		font-size: 11px;
		color: #666;
	}

	/* ── Section headers ── */
	h3 {
		margin: 14px 0 4px;
		font-size: 12px;
		font-weight: 700;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	h3:first-of-type {
		margin-top: 0;
	}

	.section-tip {
		font-size: 12px;
		color: #999;
		cursor: help;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
	}

	.section-hint {
		font-size: 11px;
		color: #888;
		margin: 0 0 6px;
	}

	/* ── Rows / labels ── */
	.row {
		display: flex;
		gap: 8px;
		align-items: end;
	}

	label {
		display: flex;
		flex-direction: column;
		font-size: 12px;
		color: #666;
		gap: 2px;
	}

	input[type='number'] {
		width: 60px;
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 13px;
	}

	/* ── Checkboxes ── */
	.checkbox-row {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: 6px;
		padding: 5px 0;
		font-size: 13px;
		color: #333;
		cursor: pointer;
	}

	.checkbox-row input[type='checkbox'] {
		margin-top: 2px;
		flex-shrink: 0;
	}

	.space-hint {
		display: block;
		font-size: 11px;
		color: #888;
		font-weight: 400;
		margin-top: 1px;
	}

	.space-hint.advanced {
		color: #b07d00;
		cursor: help;
		font-style: italic;
	}

	.indent {
		margin-left: 22px;
		margin-bottom: 4px;
	}

	.hint {
		font-size: 11px;
		color: #888;
		margin: 4px 0 0;
	}

	/* ── Buttons ── */
	.btn {
		padding: 4px 12px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn:hover {
		background: #eee;
	}

	.presets {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 4px;
	}

	.preset-btn {
		text-align: left;
		padding: 6px 10px;
	}
</style>
