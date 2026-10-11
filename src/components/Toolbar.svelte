<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';

	// One tool per visible (non-invisible) variable instance
	const toolVars = $derived(
		puzzleStore.puzzle.variables.filter((v) => v.render !== 'invisible')
	);

	// Auto-bump to the first available variable when the active one disappears
	$effect(() => {
		const current = toolVars.find((v) => v.id === ui.activeVarId);
		if (!current) {
			ui.setActiveVar(toolVars[0]?.id ?? null);
		}
	});

	function kindIcon(kind: string): string {
		switch (kind) {
			case 'number': return '#';
			case 'boolean': return '◼';
			case 'border': return '⊞';
			case 'line': return '─';
			default: return '?';
		}
	}
</script>

{#if ui.mode === 'setting' || ui.mode === 'solving'}
	<div class="toolbar">
		{#each toolVars as v (v.id)}
			<button
				class="tool-btn"
				class:active={ui.activeVarId === v.id}
				title="{v.name} ({v.kind})"
				onclick={() => ui.setActiveVar(v.id)}
			>
				<span class="kind-icon">{kindIcon(v.kind)}</span>
				{v.name}
			</button>
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
		flex-wrap: wrap;
	}

	.tool-btn {
		padding: 3px 10px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 3px;
		cursor: pointer;
		font-size: 12px;
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.kind-icon {
		font-size: 10px;
		color: #999;
	}

	.tool-btn.active {
		background: #e8f0fe;
		border-color: #4287f5;
		color: #4287f5;
		font-weight: 600;
	}

	.tool-btn.active .kind-icon {
		color: #4287f5;
	}

	.tool-btn:hover:not(.active) {
		background: #f0f0f0;
	}
</style>
