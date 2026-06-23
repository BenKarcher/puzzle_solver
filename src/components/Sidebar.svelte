<script lang="ts">
	import { ui } from '$lib/state/ui.svelte';
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { solverStore } from '$lib/solver/solver.svelte';
	import { getAllLoadedRules } from '$lib/rules/registry';
	import GridSetup from './panels/GridSetup.svelte';
	import RegionEditor from './panels/RegionEditor.svelte';
	import RuleLibrary from './panels/RuleLibrary.svelte';
	import RuleInstance from './panels/RuleInstance.svelte';
	import SolverPanel from './panels/SolverPanel.svelte';
	import type { RuleConfig } from '$lib/model/types';

	function handleCheckSolution() {
		const rules = getAllLoadedRules();
		const snapshot = $state.snapshot(puzzleStore.puzzle);
		solverStore.checkSolution(snapshot, rules);
	}

	// Clear check result when puzzle state changes
	let puzzleVersion = $derived(JSON.stringify([
		puzzleStore.puzzle.cells,
		puzzleStore.puzzle.hEdges,
		puzzleStore.puzzle.vEdges
	]));

	$effect(() => {
		puzzleVersion; // track
		solverStore.checkResult = null;
	});

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
	{#if ui.mode === 'grid-setup'}
		<GridSetup />
	{:else if ui.mode === 'region-edit'}
		<RegionEditor />
	{:else if ui.mode === 'setting'}
		{@const selectedInstance = getSelectedInstance()}
		{@const selectedConfig = getSelectedConfig()}
		{@const noRules = puzzleStore.puzzle.globalRules.length === 0 && puzzleStore.puzzle.localRules.length === 0}

		{#if selectedInstance && selectedConfig}
			<RuleInstance instance={selectedInstance} config={selectedConfig} />
			<hr />
		{/if}

		{#if noRules}
			<div class="no-rules-banner">
				<strong>No rules active.</strong> The solver will accept <em>any</em> numbers in the configured range.
				Add constraints below to make this a real puzzle.
			</div>
		{/if}

		<RuleLibrary {ruleConfigs} />
		<hr />
		<SolverPanel />
	{:else if ui.mode === 'solving'}
		<div class="panel">
			<h3>Solve Mode</h3>
			<p class="hint">Click cells and type numbers to fill in your solution. Use <kbd>Ctrl+number</kbd> for pencil marks.</p>
			<button class="btn check-btn" onclick={handleCheckSolution}>Check My Solution</button>
			{#if solverStore.checkResult}
				<div class="check-result check-{solverStore.checkResult.status}">
					{solverStore.checkResult.message}
				</div>
			{/if}
			<button class="btn" onclick={() => puzzleStore.clearSolveEntries()}>Clear Entries</button>
			<p class="hint" style="margin-top: 10px;">To have the computer solve it instead, switch to <strong>Design</strong> mode and use the Solver panel.</p>
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

	kbd {
		background: #f0f0f0;
		border: 1px solid #ccc;
		border-radius: 3px;
		padding: 0 3px;
		font-size: 11px;
	}

	.no-rules-banner {
		margin: 8px 12px;
		padding: 8px 10px;
		background: #fff8e1;
		border: 1px solid #ffe082;
		border-radius: 4px;
		font-size: 12px;
		color: #5d4037;
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

	.check-btn {
		background: #e3f2fd;
		border-color: #1976d2;
		color: #1565c0;
		margin-bottom: 8px;
	}

	.check-btn:hover {
		background: #bbdefb;
	}

	.check-result {
		margin-bottom: 8px;
		padding: 8px;
		border-radius: 4px;
		font-size: 12px;
	}

	.check-correct {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.check-incomplete {
		background: #fff3e0;
		color: #e65100;
	}

	.check-incorrect {
		background: #ffebee;
		color: #c62828;
	}
</style>
