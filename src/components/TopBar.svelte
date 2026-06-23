<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { history } from '$lib/state/history.svelte';
	import { solverStore } from '$lib/solver/solver.svelte';
	import type { AppMode, ActiveTool } from '$lib/model/types';

	const modes: { value: AppMode; label: string; tip: string }[] = [
		{ value: 'grid-setup', label: 'Setup',   tip: 'Configure grid size and what types of values cells can hold' },
		{ value: 'region-edit', label: 'Regions', tip: 'Draw regions by painting cells — used by Sudoku Boxes and similar rules' },
		{ value: 'setting',    label: 'Design',  tip: 'Enter given clues and add rules from the library' },
		{ value: 'solving',    label: 'Solve',   tip: 'Manually solve the puzzle or use the computer solver to verify it' }
	];

	function hasAnySolutionSpace(): boolean {
		const s = puzzleStore.puzzle.solutionSpaces;
		return s.numbers.enabled || s.shading.enabled || s.borders.enabled || s.lines.enabled;
	}

	function syncActiveTool(): void {
		const s = puzzleStore.puzzle.solutionSpaces;
		const toolToEnabled: Record<ActiveTool, boolean> = {
			number: s.numbers.enabled,
			shading: s.shading.enabled,
			border: s.borders.enabled,
			line: s.lines.enabled
		};
		if (toolToEnabled[ui.activeTool]) return;
		const first = (Object.keys(toolToEnabled) as ActiveTool[]).find(t => toolToEnabled[t]);
		if (first) ui.setActiveTool(first);
	}

	function switchMode(mode: AppMode) {
		// Leaving grid-setup requires at least one solution space
		if (ui.mode === 'grid-setup' && mode !== 'grid-setup' && mode !== 'region-edit') {
			if (!hasAnySolutionSpace()) return;
			syncActiveTool();
		}
		// Leaving region-edit: cleanup partial edges and reset sub-mode
		if (ui.mode === 'region-edit' && mode !== 'region-edit') {
			puzzleStore.cleanupDrawEdgesMode();
			ui.regionDrawEdges = false;
		}
		ui.setMode(mode);
	}

	function savePuzzle() {
		const json = puzzleStore.exportJSON();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${puzzleStore.puzzle.name || 'puzzle'}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function loadPuzzle() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			const text = await file.text();
			puzzleStore.importJSON(text);
		};
		input.click();
	}

	function newPuzzle() {
		if (confirm('Create a new puzzle? Unsaved changes will be lost.')) {
			solverStore.clear();
			puzzleStore.newPuzzle(9, 9);
			ui.setMode('grid-setup');
		}
	}
</script>

<header class="top-bar">
	<div class="left">
		<span class="app-name">Puzzle Solver</span>
		<span class="separator"></span>
		<button class="btn" onclick={newPuzzle} title="Start a new blank puzzle">New</button>
		<button class="btn" onclick={savePuzzle} title="Save puzzle to a .json file">Save</button>
		<button class="btn" onclick={loadPuzzle} title="Load a previously saved .json file">Load</button>
		<span class="separator"></span>
		<button class="btn" onclick={() => puzzleStore.undo()} disabled={!history.canUndo} title="Undo (Ctrl+Z)">Undo</button>
		<button class="btn" onclick={() => puzzleStore.redo()} disabled={!history.canRedo} title="Redo (Ctrl+Y)">Redo</button>
	</div>

	<div class="center">
		<input
			class="puzzle-name"
			type="text"
			value={puzzleStore.puzzle.name}
			placeholder="Untitled Puzzle"
			oninput={(e) => (puzzleStore.puzzle.name = (e.target as HTMLInputElement).value)}
		/>
	</div>

	<div class="right">
		{#each modes as mode}
			<button
				class="mode-btn"
				class:active={ui.mode === mode.value}
				disabled={!hasAnySolutionSpace() && (mode.value === 'setting' || mode.value === 'solving')}
				title={!hasAnySolutionSpace() && (mode.value === 'setting' || mode.value === 'solving')
					? 'Enable at least one variable type in Setup first'
					: mode.tip}
				onclick={() => switchMode(mode.value)}
			>
				{mode.label}
			</button>
		{/each}
	</div>
</header>

<style>
	.top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		background: #f5f5f5;
		border-bottom: 1px solid #ddd;
		gap: 8px;
	}

	.app-name {
		font-size: 14px;
		font-weight: 700;
		color: #444;
		letter-spacing: -0.3px;
		white-space: nowrap;
	}

	.left, .right {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.center {
		flex: 1;
		display: flex;
		justify-content: center;
	}

	.puzzle-name {
		border: 1px solid transparent;
		background: transparent;
		font-size: 16px;
		font-weight: 600;
		text-align: center;
		padding: 4px 8px;
		border-radius: 4px;
		width: 200px;
	}

	.puzzle-name:hover, .puzzle-name:focus {
		border-color: #ccc;
		background: white;
		outline: none;
	}

	.btn {
		padding: 4px 10px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn:hover:not(:disabled) {
		background: #eee;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.separator {
		width: 1px;
		height: 20px;
		background: #ddd;
		margin: 0 4px;
	}

	.mode-btn {
		padding: 4px 12px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.mode-btn.active {
		background: #4287f5;
		color: white;
		border-color: #4287f5;
	}

	.mode-btn:hover:not(.active) {
		background: #eee;
	}
</style>
