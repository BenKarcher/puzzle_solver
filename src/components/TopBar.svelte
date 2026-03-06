<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { history } from '$lib/state/history.svelte';
	import { solverStore } from '$lib/solver/solver.svelte';
	import type { AppMode } from '$lib/model/types';

	const modes: { value: AppMode; label: string }[] = [
		{ value: 'grid-setup', label: 'Grid Setup' },
		{ value: 'region-edit', label: 'Regions' },
		{ value: 'setting', label: 'Setting' },
		{ value: 'solving', label: 'Solving' }
	];

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
		<button class="btn" onclick={newPuzzle}>New</button>
		<button class="btn" onclick={savePuzzle}>Save</button>
		<button class="btn" onclick={loadPuzzle}>Load</button>
		<span class="separator"></span>
		<button class="btn" onclick={() => puzzleStore.undo()} disabled={!history.canUndo}>Undo</button>
		<button class="btn" onclick={() => puzzleStore.redo()} disabled={!history.canRedo}>Redo</button>
	</div>

	<div class="center">
		<input
			class="puzzle-name"
			type="text"
			value={puzzleStore.puzzle.name}
			oninput={(e) => (puzzleStore.puzzle.name = (e.target as HTMLInputElement).value)}
		/>
	</div>

	<div class="right">
		{#each modes as mode}
			<button
				class="mode-btn"
				class:active={ui.mode === mode.value}
				onclick={() => ui.setMode(mode.value)}
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
