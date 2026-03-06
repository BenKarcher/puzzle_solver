<script lang="ts">
	import { ui } from '$lib/state/ui.svelte';
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import GridSetup from './panels/GridSetup.svelte';
	import RuleLibrary from './panels/RuleLibrary.svelte';
	import RuleInstance from './panels/RuleInstance.svelte';
	import SolverPanel from './panels/SolverPanel.svelte';
	import type { RuleConfig } from '$lib/model/types';

	interface Props {
		ruleConfigs: RuleConfig[];
	}

	let { ruleConfigs }: Props = $props();

	function getSelectedInstance() {
		if (!ui.selectedRuleInstanceId) return null;
		return puzzleStore.puzzle.localRules.find((r) => r.id === ui.selectedRuleInstanceId) ?? null;
	}

	function getSelectedConfig() {
		const inst = getSelectedInstance();
		if (!inst) return null;
		return ruleConfigs.find((r) => r.id === inst.ruleId) ?? null;
	}
</script>

<aside class="sidebar">
	{#if ui.mode === 'grid-setup' || ui.mode === 'region-edit'}
		<GridSetup />
		{#if ui.mode === 'region-edit'}
			<div class="panel">
				<p class="hint">Click cells and type numbers to assign region IDs. Cells with the same ID form a region.</p>
			</div>
		{/if}
	{:else if ui.mode === 'setting'}
		{@const selectedInstance = getSelectedInstance()}
		{@const selectedConfig = getSelectedConfig()}

		{#if selectedInstance && selectedConfig}
			<RuleInstance instance={selectedInstance} config={selectedConfig} />
			<hr />
		{/if}
		<RuleLibrary {ruleConfigs} />
		<hr />
		<SolverPanel />
	{:else if ui.mode === 'solving'}
		<div class="panel">
			<h3>Solving Mode</h3>
			<p class="hint">Enter values into non-given cells. Use Ctrl+number for pencil marks.</p>
			<button class="btn" onclick={() => puzzleStore.clearSolveEntries()}>Clear All Entries</button>
		</div>
	{/if}
</aside>

<style>
	.sidebar {
		width: 300px;
		min-width: 250px;
		border-left: 1px solid #ddd;
		background: #fff;
		overflow-y: auto;
		flex-shrink: 0;
	}

	.panel {
		padding: 12px;
	}

	.hint {
		font-size: 12px;
		color: #888;
		line-height: 1.4;
	}

	hr {
		border: none;
		border-top: 1px solid #eee;
		margin: 0;
	}

	h3 {
		margin: 0 0 8px;
		font-size: 13px;
		font-weight: 600;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.btn {
		padding: 8px 12px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		width: 100%;
	}

	.btn:hover {
		background: #eee;
	}
</style>
