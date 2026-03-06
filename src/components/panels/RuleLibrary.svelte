<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { selection } from '$lib/state/selection.svelte';
	import type { RuleConfig } from '$lib/model/types';

	interface Props {
		ruleConfigs: RuleConfig[];
	}

	let { ruleConfigs }: Props = $props();
	let searchQuery = $state('');

	function getAvailableRules(): RuleConfig[] {
		const enabledSpaces = new Set<string>();
		const spaces = puzzleStore.puzzle.solutionSpaces;
		if (spaces.numbers.enabled) enabledSpaces.add('numbers');
		if (spaces.shading.enabled) enabledSpaces.add('shading');
		if (spaces.borders.enabled) enabledSpaces.add('borders');
		if (spaces.lines.enabled) enabledSpaces.add('lines');

		return ruleConfigs.filter((rule) => {
			// Filter by required spaces
			if (!rule.requiredSpaces.every((s) => enabledSpaces.has(s))) return false;
			// Filter by search
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				return (
					rule.name.toLowerCase().includes(q) ||
					rule.description.toLowerCase().includes(q) ||
					rule.categories.some((c) => c.toLowerCase().includes(q))
				);
			}
			return true;
		});
	}

	function toggleGlobalRule(ruleId: string) {
		puzzleStore.toggleGlobalRule(ruleId);
	}

	function addLocalRule(rule: RuleConfig) {
		const groupCount = rule.groups?.min ?? 1;
		const instanceId = puzzleStore.addRuleInstance(rule.id, groupCount);

		// Pre-populate group 0 with current selection if size is valid
		const sel = selection.cells;
		if (sel.length > 0 && rule.groups) {
			const { minSize, maxSize } = rule.groups.constraints;
			const validSize = sel.length >= minSize && (maxSize === null || sel.length <= maxSize);
			if (validSize) {
				for (const cell of sel) {
					puzzleStore.addCellToGroup(instanceId, 0, cell);
				}
				selection.clearSelection();
			}
		}

		ui.selectRuleInstance(instanceId);
	}

	function isGlobalEnabled(ruleId: string): boolean {
		return puzzleStore.puzzle.globalRules.includes(ruleId);
	}

	function removeLocalInstance(instanceId: string) {
		puzzleStore.removeRuleInstance(instanceId);
		if (ui.selectedRuleInstanceId === instanceId) {
			ui.selectRuleInstance(null);
		}
	}

	function selectInstance(instanceId: string) {
		ui.selectRuleInstance(
			ui.selectedRuleInstanceId === instanceId ? null : instanceId
		);
	}
</script>

<div class="panel">
	<h3>Active Rules</h3>

	<div class="active-rules-list">
	<!-- Global rules -->
	{#each puzzleStore.puzzle.globalRules as ruleId}
		{@const config = ruleConfigs.find((r) => r.id === ruleId)}
		{#if config}
			<div class="active-rule global">
				<span class="rule-name">{config.name}</span>
				<button class="remove-btn" onclick={() => toggleGlobalRule(ruleId)}>×</button>
			</div>
		{/if}
	{/each}

	<!-- Local rule instances -->
	{#each puzzleStore.puzzle.localRules as instance}
		{@const config = ruleConfigs.find((r) => r.id === instance.ruleId)}
		{#if config}
			<div
				class="active-rule local"
				class:selected={ui.selectedRuleInstanceId === instance.id}
				role="button"
				tabindex="0"
				onclick={() => selectInstance(instance.id)}
				onkeydown={(e) => e.key === 'Enter' && selectInstance(instance.id)}
			>
				<span class="rule-name">{config.name}</span>
				{#each instance.groups as group, gi}
					{#if config.groups?.constraints.hasValue && group.value !== null}
						<span class="group-value">({group.value})</span>
					{/if}
				{/each}
				<button class="remove-btn" onclick={(e) => { e.stopPropagation(); removeLocalInstance(instance.id); }}>×</button>
			</div>
		{/if}
	{/each}

	{#if puzzleStore.puzzle.globalRules.length === 0 && puzzleStore.puzzle.localRules.length === 0}
		<p class="empty">No rules added yet</p>
	{/if}
	</div>

	<h3>Rule Library</h3>
	<input
		class="search"
		type="text"
		placeholder="Search rules..."
		bind:value={searchQuery}
	/>

	<div class="rule-list">
		{#each getAvailableRules() as rule}
			<div class="rule-item">
				<div class="rule-info">
					<span class="rule-name">{rule.name}</span>
					<span class="rule-desc">{rule.description}</span>
				</div>
				{#if rule.scope === 'global'}
					<button
						class="add-btn"
						class:active={isGlobalEnabled(rule.id)}
						onclick={() => toggleGlobalRule(rule.id)}
					>
						{isGlobalEnabled(rule.id) ? 'On' : 'Off'}
					</button>
				{:else}
					<button class="add-btn" onclick={() => addLocalRule(rule)}>Add</button>
				{/if}
			</div>
		{/each}
	</div>
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

	.search {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
		margin-bottom: 8px;
		box-sizing: border-box;
	}

	.active-rules-list {
		max-height: 200px;
		overflow-y: auto;
	}

	.active-rule {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: 4px;
		margin-bottom: 2px;
		font-size: 13px;
		cursor: pointer;
	}

	.active-rule.global {
		background: #e8f5e9;
	}

	.active-rule.local {
		background: #e3f2fd;
	}

	.active-rule.selected {
		background: #bbdefb;
		outline: 2px solid #4287f5;
	}

	.group-value {
		font-size: 11px;
		color: #666;
	}

	.remove-btn {
		margin-left: auto;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #999;
		padding: 0 4px;
	}

	.remove-btn:hover {
		color: #e53935;
	}

	.rule-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.rule-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border: 1px solid #eee;
		border-radius: 4px;
	}

	.rule-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.rule-name {
		font-size: 13px;
		font-weight: 500;
	}

	.rule-desc {
		font-size: 11px;
		color: #888;
	}

	.add-btn {
		padding: 2px 10px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 3px;
		cursor: pointer;
		font-size: 12px;
	}

	.add-btn.active {
		background: #4caf50;
		color: white;
		border-color: #4caf50;
	}

	.add-btn:hover:not(.active) {
		background: #eee;
	}

	.empty {
		font-size: 12px;
		color: #999;
		font-style: italic;
		margin: 4px 0;
	}
</style>
