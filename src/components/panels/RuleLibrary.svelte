<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { selection } from '$lib/state/selection.svelte';
	import { isCustomRule } from '$lib/rules/registry';
	import type { RuleConfig } from '$lib/model/types';

	interface Props {
		ruleConfigs: RuleConfig[];
	}

	let { ruleConfigs }: Props = $props();
	let searchQuery = $state('');
	let libraryOpen = $state(false);

	function getAvailableRules(): RuleConfig[] {
		const enabledSpaces = new Set<string>();
		const spaces = puzzleStore.puzzle.solutionSpaces;
		if (spaces.numbers.enabled) enabledSpaces.add('numbers');
		if (spaces.shading.enabled) enabledSpaces.add('shading');
		if (spaces.borders.enabled) enabledSpaces.add('borders');
		if (spaces.lines.enabled) enabledSpaces.add('lines');

		const filtered = ruleConfigs.filter((rule) => {
			if (!rule.requiredSpaces.every((s) => enabledSpaces.has(s))) return false;
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

		// Sort: favorites first, then alphabetically
		const favs = ui.favoriteRules;
		filtered.sort((a, b) => {
			const aFav = favs.has(a.id) ? 0 : 1;
			const bFav = favs.has(b.id) ? 0 : 1;
			if (aFav !== bFav) return aFav - bFav;
			return a.name.localeCompare(b.name);
		});

		return filtered;
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

	function duplicateLocalRule(instanceRuleId: string) {
		const config = ruleConfigs.find((r) => r.id === instanceRuleId);
		if (config) addLocalRule(config);
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

	function editCustomRule(ruleId: string, e: MouseEvent) {
		e.stopPropagation();
		const def = puzzleStore.puzzle.customRules.find((r) => r.id === ruleId);
		if (def) ui.openCustomRuleEditor(def);
	}

	function removeCustomRule(ruleId: string, e: MouseEvent) {
		e.stopPropagation();
		puzzleStore.removeCustomRule(ruleId);
	}

	function toggleFavorite(ruleId: string, e: MouseEvent) {
		e.stopPropagation();
		ui.toggleFavoriteRule(ruleId);
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
				{#if isCustomRule(ruleId)}
					<button class="edit-btn" title="Edit" onclick={(e) => editCustomRule(ruleId, e)}>&#9998;</button>
				{/if}
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
				<button class="dup-btn" title="Add another" onclick={(e) => { e.stopPropagation(); duplicateLocalRule(instance.ruleId); }}>+</button>
				{#if isCustomRule(instance.ruleId)}
					<button class="edit-btn" title="Edit" onclick={(e) => editCustomRule(instance.ruleId, e)}>&#9998;</button>
				{/if}
				<button class="remove-btn" onclick={(e) => { e.stopPropagation(); removeLocalInstance(instance.id); }}>×</button>
			</div>
		{/if}
	{/each}

	{#if puzzleStore.puzzle.globalRules.length === 0 && puzzleStore.puzzle.localRules.length === 0}
		<p class="empty">No rules added yet</p>
	{/if}
	</div>

	<details class="library-section" bind:open={libraryOpen}>
		<summary class="library-header"><h3>Rule Library</h3></summary>

	<input
		class="search"
		type="text"
		placeholder="Search rules..."
		bind:value={searchQuery}
	/>

	<div class="rule-list">
		{#each getAvailableRules() as rule}
			<div class="rule-item">
				<button
					class="fav-btn"
					class:favorited={ui.favoriteRules.has(rule.id)}
					title={ui.favoriteRules.has(rule.id) ? 'Unfavorite' : 'Favorite'}
					onclick={(e) => toggleFavorite(rule.id, e)}
				>
					{ui.favoriteRules.has(rule.id) ? '\u2605' : '\u2606'}
				</button>
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
				{#if isCustomRule(rule.id)}
					<button class="edit-btn" title="Edit definition" onclick={(e) => editCustomRule(rule.id, e)}>&#9998;</button>
					<button class="remove-btn" title="Delete" onclick={(e) => removeCustomRule(rule.id, e)}>×</button>
				{/if}
			</div>
		{/each}
	</div>

	<button class="custom-btn" onclick={() => ui.openCustomRuleEditor()}>
		+ Custom Constraint
	</button>
	</details>
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

	.dup-btn {
		margin-left: auto;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		color: #999;
		padding: 0 4px;
	}

	.dup-btn:hover {
		color: #4caf50;
	}

	.remove-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #999;
		padding: 0 4px;
	}

	.active-rule.global .remove-btn {
		margin-left: auto;
	}

	.remove-btn:hover {
		color: #e53935;
	}

	.edit-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 13px;
		color: #999;
		padding: 0 4px;
	}

	.edit-btn:hover {
		color: #4287f5;
	}

	/* Library section - collapsible */
	.library-section {
		border: none;
		margin-top: 4px;
	}

	.library-header {
		cursor: pointer;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.library-header::-webkit-details-marker {
		display: none;
	}

	.library-header::before {
		content: '\25B6';
		font-size: 9px;
		color: #888;
		transition: transform 0.15s;
	}

	.library-section[open] > .library-header::before {
		transform: rotate(90deg);
	}

	.library-header h3 {
		margin: 0;
	}

	.rule-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 300px;
		overflow-y: auto;
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
		flex-shrink: 0;
	}

	.add-btn.active {
		background: #4caf50;
		color: white;
		border-color: #4caf50;
	}

	.add-btn:hover:not(.active) {
		background: #eee;
	}

	.fav-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #ccc;
		padding: 0;
		flex-shrink: 0;
		line-height: 1;
	}

	.fav-btn.favorited {
		color: #ffc107;
	}

	.fav-btn:hover {
		color: #ffc107;
	}

	.custom-btn {
		margin-top: 12px;
		width: 100%;
		padding: 8px;
		border: 1px dashed #999;
		background: #fafafa;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		color: #555;
	}

	.custom-btn:hover {
		background: #f0f0f0;
		border-color: #666;
	}

	.empty {
		font-size: 12px;
		color: #999;
		font-style: italic;
		margin: 4px 0;
	}
</style>
