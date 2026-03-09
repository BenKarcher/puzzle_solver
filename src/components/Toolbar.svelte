<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import type { ActiveTool } from '$lib/model/types';

	const tools: { value: ActiveTool; label: string; space: 'numbers' | 'shading' | 'borders' | 'lines' }[] = [
		{ value: 'number', label: 'Numbers', space: 'numbers' },
		{ value: 'shading', label: 'Shading', space: 'shading' },
		{ value: 'border', label: 'Borders', space: 'borders' },
		{ value: 'line', label: 'Lines', space: 'lines' }
	];

	function isToolAvailable(space: 'numbers' | 'shading' | 'borders' | 'lines'): boolean {
		return puzzleStore.puzzle.solutionSpaces[space].enabled;
	}

	// Auto-bump to first available tool when current tool's space is disabled
	$effect(() => {
		const currentTool = tools.find((t) => t.value === ui.activeTool);
		if (currentTool && !isToolAvailable(currentTool.space)) {
			const firstAvailable = tools.find((t) => isToolAvailable(t.space));
			if (firstAvailable) ui.setActiveTool(firstAvailable.value);
		}
	});
</script>

{#if ui.mode === 'setting' || ui.mode === 'solving'}
	<div class="toolbar">
		{#each tools as tool}
			{#if isToolAvailable(tool.space)}
				<button
					class="tool-btn"
					class:active={ui.activeTool === tool.value}
					onclick={() => ui.setActiveTool(tool.value)}
				>
					{tool.label}
				</button>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.toolbar {
		display: flex;
		gap: 4px;
		padding: 6px 8px;
		background: #fafafa;
		border-bottom: 1px solid #eee;
	}

	.tool-btn {
		padding: 3px 10px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 3px;
		cursor: pointer;
		font-size: 12px;
	}

	.tool-btn.active {
		background: #e8f0fe;
		border-color: #4287f5;
		color: #4287f5;
		font-weight: 600;
	}

	.tool-btn:hover:not(.active) {
		background: #f0f0f0;
	}
</style>
