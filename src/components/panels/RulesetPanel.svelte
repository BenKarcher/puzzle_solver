<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { getRuleById } from '$lib/rules/registry';
	import { defaultRulesetBindings, entryId, rulesetSlots } from '$lib/rules/rulesets';
	import type { RulesetActivation, RulesetConfig, VarKind } from '$lib/model/types';

	interface Props {
		activation: RulesetActivation;
		rs: RulesetConfig;
	}

	let { activation, rs }: Props = $props();

	const slots = $derived(rulesetSlots(rs));

	function varsOfKind(kind: VarKind) {
		return puzzleStore.puzzle.variables.filter((v) => v.kind === kind);
	}

	/** Show slot pickers only when at least one slot's kind has several instances */
	const showBindings = $derived(slots.some((s) => varsOfKind(s.kind).length > 1));

	function boundVarId(si: number): string {
		return activation.bindings?.[si] ?? defaultRulesetBindings(puzzleStore.puzzle, rs)[si] ?? '';
	}

	function memberName(id: string): string {
		return getRuleById(id)?.config.name ?? id;
	}

	function memberScope(id: string): 'global' | 'local' | null {
		return getRuleById(id)?.config.scope ?? null;
	}

	function remove() {
		puzzleStore.toggleRuleset(rs.id);
		ui.selectRuleset(null);
	}
</script>

<div class="panel">
	<button class="back-btn" onclick={() => ui.selectRuleset(null)}>← Back to rules</button>

	<div class="header-row">
		<span class="rule-badge set-badge" title="Rule set — a bundle of related rules">S</span>
		<h4>{rs.name}</h4>
	</div>
	<p class="description">{rs.description}</p>

	{#if showBindings}
		<div class="bindings">
			<span class="bindings-label" title="Which variable fills each of this set's roles">Applies to:</span>
			<div class="slot-list">
				{#each slots as slot, si}
					{#if varsOfKind(slot.kind).length > 1}
						<label class="slot-row">
							<span class="slot-name">{slot.name}</span>
							<select
								class="binding-select"
								value={boundVarId(si)}
								onchange={(e) => puzzleStore.setRulesetBinding(rs.id, si, (e.target as HTMLSelectElement).value)}
							>
								{#each varsOfKind(slot.kind) as v (v.id)}
									<option value={v.id}>{v.name}</option>
								{/each}
							</select>
						</label>
					{/if}
				{/each}
			</div>
		</div>
	{:else}
		<p class="hint">This set applies to the whole grid — no variable choices needed.</p>
	{/if}

	<h5>Included rules</h5>
	<ul class="member-list">
		{#each rs.rules as entry}
			{@const id = entryId(entry)}
			<li>
				<span class="rule-badge {memberScope(id) === 'global' ? 'global-badge' : 'local-badge'}">
					{memberScope(id) === 'global' ? 'G' : 'L'}
				</span>
				{memberName(id)}
			</li>
		{/each}
	</ul>

	<button class="btn remove-rule-btn" onclick={remove}>Remove rule set</button>
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

	h5 {
		margin: 12px 0 4px;
		font-size: 11px;
		font-weight: 700;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
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

	.set-badge    { background: #e1bee7; color: #6a1b9a; }
	.global-badge { background: #c8e6c9; color: #2e7d32; }
	.local-badge  { background: #bbdefb; color: #1565c0; }

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

	.slot-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 5px;
	}

	.slot-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.slot-name {
		font-size: 11px;
		color: #555;
		min-width: 60px;
	}

	.binding-select {
		font-size: 12px;
		padding: 2px 4px;
		border: 1px solid #ccc;
		border-radius: 3px;
	}

	.member-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.member-list li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #444;
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
		margin-top: 12px;
		color: #c62828;
		border-color: #ef9a9a;
	}

	.remove-rule-btn:hover { background: #ffebee; }
</style>
