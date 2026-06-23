<script lang="ts">
	import { ui } from '$lib/state/ui.svelte';
	import { puzzleStore } from '$lib/state/puzzle.svelte';

	function enableDrawEdges() {
		puzzleStore.initDrawEdgesMode();
		ui.regionDrawEdges = true;
	}

	function enablePaint() {
		if (ui.regionDrawEdges) {
			puzzleStore.cleanupDrawEdgesMode();
			ui.regionDrawEdges = false;
		}
	}

	function populateAllEdges() {
		puzzleStore.populateAllEdges();
	}

	const regionCount = $derived.by(() => {
		const seen = new Set<number>();
		for (const row of puzzleStore.puzzle.cells)
			for (const cell of row)
				seen.add(cell.regionId);
		return seen.size;
	});
</script>

<div class="panel">
	<h3>Region Editor</h3>

	<div class="mode-toggle">
		<button
			class="mode-btn"
			class:active={!ui.regionDrawEdges}
			onclick={enablePaint}
		>Paint</button>
		<button
			class="mode-btn"
			class:active={ui.regionDrawEdges}
			onclick={enableDrawEdges}
		>Draw Edges</button>
	</div>

	<p class="region-count">{regionCount} region{regionCount !== 1 ? 's' : ''}</p>

	{#if !ui.regionDrawEdges}
		<p class="hint">
			Click cells and type a number to assign a region ID.
			Cells sharing the same ID form one region.
		</p>
	{:else}
		<p class="hint">
			Drag across cell boundaries to draw dividing edges.
			Regions are numbered automatically from top-left to bottom-right.
			Right-click an edge to toggle it.
		</p>
		<button class="action-btn" onclick={populateAllEdges}>
			Make each cell its own region
		</button>
	{/if}
</div>

<style>
	.panel {
		padding: 12px;
	}

	h3 {
		margin: 0 0 10px;
		font-size: 13px;
		font-weight: 700;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.mode-toggle {
		display: flex;
		gap: 4px;
		margin-bottom: 10px;
	}

	.mode-btn {
		flex: 1;
		padding: 6px 10px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		color: #444;
	}

	.mode-btn.active {
		background: #4287f5;
		color: white;
		border-color: #4287f5;
		font-weight: 600;
	}

	.mode-btn:hover:not(.active) {
		background: #eee;
	}

	.region-count {
		font-size: 12px;
		color: #777;
		margin: 0 0 10px;
	}

	.hint {
		font-size: 12px;
		color: #888;
		line-height: 1.5;
		margin: 0 0 10px;
	}

	.action-btn {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		text-align: left;
	}

	.action-btn:hover {
		background: #eee;
	}
</style>
