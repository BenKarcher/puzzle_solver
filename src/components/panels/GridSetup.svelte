<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';

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
</script>

<div class="panel">
	<h3>Grid Dimensions</h3>
	<div class="row">
		<label>
			Rows
			<input type="number" bind:value={rowsInput} min="1" max="30" />
		</label>
		<label>
			Cols
			<input type="number" bind:value={colsInput} min="1" max="30" />
		</label>
		<button class="btn" onclick={applyDimensions}>Apply</button>
	</div>

	<h3>Solution Spaces</h3>

	<label class="checkbox-row">
		<input
			type="checkbox"
			checked={puzzleStore.puzzle.solutionSpaces.numbers.enabled}
			onchange={toggleNumbers}
		/>
		Number Placement
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

	<label class="checkbox-row">
		<input
			type="checkbox"
			checked={puzzleStore.puzzle.solutionSpaces.shading.enabled}
			onchange={toggleShading}
		/>
		Shading
	</label>

	<label class="checkbox-row">
		<input
			type="checkbox"
			checked={puzzleStore.puzzle.solutionSpaces.borders.enabled}
			onchange={toggleBorders}
		/>
		Borders
	</label>

	<label class="checkbox-row">
		<input
			type="checkbox"
			checked={puzzleStore.puzzle.solutionSpaces.lines.enabled}
			onchange={toggleLines}
		/>
		Lines
	</label>
</div>

<style>
	.panel {
		padding: 12px;
	}

	h3 {
		margin: 12px 0 8px;
		font-size: 13px;
		font-weight: 600;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	h3:first-child {
		margin-top: 0;
	}

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

	.checkbox-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		padding: 4px 0;
		font-size: 13px;
		color: #333;
		cursor: pointer;
	}

	.indent {
		margin-left: 22px;
		margin-bottom: 4px;
	}

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
</style>
