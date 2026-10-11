<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { bindableOccurrences, defaultBindings } from '$lib/model/variables';
	import type { GlobalRuleApplication, RuleConfig, VarKind } from '$lib/model/types';

	interface Props {
		app: GlobalRuleApplication;
		config: RuleConfig;
	}

	let { app, config }: Props = $props();

	const occurrences = $derived(bindableOccurrences(config));

	function varsOfKind(kind: VarKind) {
		return puzzleStore.puzzle.variables.filter((v) => v.kind === kind);
	}

	/** Show pickers only when at least one required kind has several instances */
	const showBindings = $derived(occurrences.some((kind) => varsOfKind(kind).length > 1));

	function boundVarId(oi: number): string {
		return app.bindings?.[oi] ?? defaultBindings(puzzleStore.puzzle, config)[oi] ?? '';
	}

	function remove() {
		puzzleStore.removeGlobalRule(app.key);
		ui.selectGlobalRule(null);
	}
</script>

<div class="panel">
	<button class="back-btn" onclick={() => ui.selectGlobalRule(null)}>← Back to rules</button>

	<div class="header-row">
		<span class="rule-badge global-badge" title="Global rule — applies to the entire grid">G</span>
		<h4>{config.name}</h4>
	</div>
	<p class="description">{config.description}</p>

	{#if showBindings}
		<div class="bindings">
			<span class="bindings-label" title="Which variable each of this rule's requirements applies to">Applies to:</span>
			{#each occurrences as kind, oi}
				<select
					class="binding-select"
					value={boundVarId(oi)}
					onchange={(e) => puzzleStore.setGlobalRuleBinding(app.key, oi, (e.target as HTMLSelectElement).value)}
				>
					{#each varsOfKind(kind) as v (v.id)}
						<option value={v.id}>{v.name}</option>
					{/each}
				</select>
			{/each}
		</div>
	{:else}
		<p class="hint">This rule applies to the whole grid — no variable choices needed.</p>
	{/if}

	<button class="btn remove-rule-btn" onclick={remove}>Remove rule</button>
</div>

<style>
	.panel {
		padding: 12px;
	}

	.back-btn {
		background: none;
		border: none;
		color: #4287f5;
		cursor: pointer;
		font-size: 12px;
		padding: 0;
		margin-bottom: 10px;
	}

	.back-btn:hover { text-decoration: underline; }

	.header-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	h4 {
		margin: 0;
		font-size: 14px;
	}

	.rule-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		font-size: 10px;
		font-weight: 700;
		flex-shrink: 0;
	}

	.global-badge { background: #c8e6c9; color: #2e7d32; }

	.description {
		font-size: 12px;
		color: #666;
		margin: 6px 0 10px;
		line-height: 1.5;
	}

	.hint {
		font-size: 11px;
		color: #999;
		font-style: italic;
	}

	.bindings {
		display: flex;
		align-items: center;
		gap: 5px;
		flex-wrap: wrap;
		margin-bottom: 10px;
		padding: 6px 8px;
		background: #f3e8fd;
		border: 1px solid #d6bbf5;
		border-radius: 4px;
	}

	.bindings-label {
		font-size: 11px;
		font-weight: 600;
		color: #6a1b9a;
		cursor: help;
	}

	.binding-select {
		font-size: 12px;
		padding: 2px 4px;
		border: 1px solid #ccc;
		border-radius: 3px;
	}

	.btn {
		padding: 6px 12px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}

	.remove-rule-btn {
		margin-top: 6px;
		color: #c62828;
		border-color: #ef9a9a;
	}

	.remove-rule-btn:hover { background: #ffebee; }
</style>
