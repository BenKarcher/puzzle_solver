<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { selection } from '$lib/state/selection.svelte';
	import { isCustomRule, getAllRulesets } from '$lib/rules/registry';
	import { rulesetRuleIds } from '$lib/rules/rulesets';
	import { bindableOccurrences } from '$lib/model/variables';
	import type { RuleConfig, RulesetConfig, VarKind } from '$lib/model/types';

	interface Props {
		ruleConfigs: RuleConfig[];
	}

	let { ruleConfigs }: Props = $props();
	let searchQuery = $state('');
	let libraryOpen = $state(false);

	const favoritedRules = $derived(getAvailableRules().filter((r) => ui.favoriteRules.has(r.id)));
	const nonFavoritedRules = $derived(getAvailableRules().filter((r) => !ui.favoriteRules.has(r.id)));

	const allRulesets = getAllRulesets();

	// ── Availability ──────────────────────────────────────────────────────────

	function kindCount(kind: VarKind): number {
		return puzzleStore.puzzle.variables.filter((v) => v.kind === kind).length;
	}

	/** A rule is available iff every bindable occurrence has at least one instance of its kind */
	function ruleAvailable(rule: RuleConfig): boolean {
		return bindableOccurrences(rule).every((kind) => kindCount(kind) > 0);
	}

	/** True when at least one of the rule's required kinds has several instances (binding pick needed) */
	function needsBindingPick(rule: RuleConfig): boolean {
		return bindableOccurrences(rule).some((kind) => kindCount(kind) > 1);
	}

	function varName(varId: string): string {
		return puzzleStore.getVariable(varId)?.name ?? '?';
	}

	/** Binding summary for an application, shown only when picking matters */
	function bindingSummary(ruleId: string, bindings: string[]): string {
		const cfg = ruleConfigs.find((r) => r.id === ruleId);
		if (!cfg || !bindings.length) return '';
		if (!needsBindingPick(cfg)) return '';
		return bindings.map(varName).join(', ');
	}

	function getAvailableRules(): RuleConfig[] {
		const filtered = ruleConfigs.filter((rule) => {
			if (!ruleAvailable(rule)) return false;
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

		filtered.sort((a, b) => a.name.localeCompare(b.name));
		return filtered;
	}

	function getAvailableRulesets(): RulesetConfig[] {
		return allRulesets.filter((rs) => {
			// Only show if every member rule can be satisfied by the puzzle's variables
			const members = rulesetRuleIds(rs)
				.map((id) => ruleConfigs.find((r) => r.id === id))
				.filter((r): r is RuleConfig => !!r);
			if (!members.every(ruleAvailable)) return false;
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return (
				rs.name.toLowerCase().includes(q) ||
				rs.description.toLowerCase().includes(q) ||
				rs.categories.some((c) => c.toLowerCase().includes(q)) ||
				members.some((cfg) => cfg.name.toLowerCase().includes(q))
			);
		});
	}

	// ── Actions ───────────────────────────────────────────────────────────────

	function toggleOrAddGlobalRule(rule: RuleConfig) {
		if (needsBindingPick(rule)) {
			// Add with default bindings; click the entry in the active list to rebind
			const key = puzzleStore.addGlobalRule(rule.id);
			ui.selectGlobalRule(key);
		} else {
			puzzleStore.toggleGlobalRule(rule.id);
		}
	}

	function toggleRuleset(rulesetId: string) {
		puzzleStore.toggleRuleset(rulesetId);
	}

	function isGlobalEnabled(ruleId: string): boolean {
		return puzzleStore.puzzle.globalRules.some((a) => a.ruleId === ruleId);
	}

	function isRulesetActive(rulesetId: string): boolean {
		return puzzleStore.isRulesetActive(rulesetId);
	}

	function addLocalRule(rule: RuleConfig) {
		// Only inherit a free selection — if we're leaving a group-edit context, start fresh
		const sourceCells = ui.selectedRuleInstanceId ? [] : selection.cells;

		const instanceId = puzzleStore.addRuleInstance(rule.id);

		const firstGroup = rule.groups?.[0];
		if (sourceCells.length > 0 && firstGroup && firstGroup.maxSize !== 0) {
			const { minSize, maxSize } = firstGroup;
			const validSize = sourceCells.length >= minSize && (maxSize === null || sourceCells.length <= maxSize);
			if (validSize) {
				for (const cell of sourceCells) {
					puzzleStore.addCellToGroup(instanceId, 0, cell);
				}
				selection.clearSelection();
			}
		}

		ui.selectRuleInstance(instanceId);
		if (firstGroup?.hasValue) {
			ui.pendingValueFocus = instanceId;
		}
	}

	function duplicateLocalRule(instanceRuleId: string) {
		const config = ruleConfigs.find((r) => r.id === instanceRuleId);
		if (config) addLocalRule(config);
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
		<!-- ── Active rulesets (with indented global rules) ── -->
		{#each puzzleStore.puzzle.activeRulesets as activation (activation.rulesetId)}
			{@const rs = allRulesets.find((r) => r.id === activation.rulesetId)}
			{#if rs}
				<div class="ruleset-group" class:selected={ui.selectedRulesetId === rs.id}>
					<div
						class="ruleset-header"
						title="Rule set — click to view details and variable bindings"
						role="button"
						tabindex="0"
						onclick={() => ui.selectRuleset(ui.selectedRulesetId === rs.id ? null : rs.id)}
						onkeydown={(e) => e.key === 'Enter' && ui.selectRuleset(rs.id)}
					>
						<span class="rule-badge set-badge" title="Rule set">S</span>
						<span class="ruleset-name">{rs.name}</span>
						<button class="remove-btn" title="Remove this rule set (and its exclusive rules)" onclick={(e) => { e.stopPropagation(); toggleRuleset(rs.id); }}>×</button>
					</div>
					{#each rulesetRuleIds(rs) as ruleId}
						{@const cfg = ruleConfigs.find((r) => r.id === ruleId)}
						{#if cfg && cfg.scope === 'global' && isGlobalEnabled(ruleId)}
							<div
								class="active-rule global indented"
								role="button"
								tabindex="0"
								onclick={() => ui.selectRuleset(rs.id)}
								onkeydown={(e) => e.key === 'Enter' && ui.selectRuleset(rs.id)}
							>
								<span class="rule-badge global-badge" title="Global rule">G</span>
								<span class="rule-name">{cfg.name}</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		{/each}

		<!-- ── Individually added global rule applications ── -->
		{#each puzzleStore.puzzle.manualGlobalRules as app (app.key)}
			{@const config = ruleConfigs.find((r) => r.id === app.ruleId)}
			{#if config}
				{@const summary = bindingSummary(app.ruleId, app.bindings)}
				<div
					class="active-rule global"
					class:selected={ui.selectedGlobalRuleKey === app.key}
					title="Global rule — click to view details and variable bindings"
					role="button"
					tabindex="0"
					onclick={() => ui.selectGlobalRule(ui.selectedGlobalRuleKey === app.key ? null : app.key)}
					onkeydown={(e) => e.key === 'Enter' && ui.selectGlobalRule(app.key)}
				>
					<span class="rule-badge global-badge" title="Global rule">G</span>
					<span class="rule-name">{config.name}</span>
					{#if summary}
						<span class="binding-info" title="Bound variables">→ {summary}</span>
					{/if}
					{#if isCustomRule(app.ruleId)}
						<button class="edit-btn" title="Edit" onclick={(e) => { e.stopPropagation(); editCustomRule(app.ruleId, e); }}>&#9998;</button>
					{/if}
					<button class="remove-btn" title="Remove this rule" onclick={(e) => { e.stopPropagation(); puzzleStore.removeGlobalRule(app.key); }}>×</button>
				</div>
			{/if}
		{/each}

		<!-- ── Local rule instances ── -->
		{#each puzzleStore.puzzle.localRules as instance}
			{@const config = ruleConfigs.find((r) => r.id === instance.ruleId)}
			{#if config}
				<div
					class="active-rule local"
					class:selected={ui.selectedRuleInstanceId === instance.id}
					title="Local rule — click to configure which cells it applies to"
					role="button"
					tabindex="0"
					onclick={() => selectInstance(instance.id)}
					onkeydown={(e) => e.key === 'Enter' && selectInstance(instance.id)}
				>
					<span class="rule-badge local-badge" title="Local rule (applies to selected cells)">L</span>
					<span class="rule-name">{config.name}</span>
					{#each instance.groups as group, gi}
						{#if config.groups?.[gi]?.hasValue && group.value !== null}
							<span class="group-value">({group.value})</span>
						{/if}
					{/each}
					<button class="dup-btn" title="Add another instance of this rule" onclick={(e) => { e.stopPropagation(); duplicateLocalRule(instance.ruleId); }}>+</button>
					{#if isCustomRule(instance.ruleId)}
						<button class="edit-btn" title="Edit" onclick={(e) => editCustomRule(instance.ruleId, e)}>&#9998;</button>
					{/if}
					<button class="remove-btn" title="Remove" onclick={(e) => { e.stopPropagation(); removeLocalInstance(instance.id); }}>×</button>
				</div>
			{/if}
		{/each}

		{#if puzzleStore.puzzle.globalRules.length === 0 && puzzleStore.puzzle.localRules.length === 0 && puzzleStore.puzzle.activeRulesets.length === 0}
			<p class="empty">No rules yet — open the <strong>Rule Library</strong> below to add constraints.</p>
		{/if}
	</div>

	<!-- ── Library ── -->
	<details class="library-section" bind:open={libraryOpen}>
		<summary class="library-header"><h3>Rule Library</h3></summary>

	<div class="library-top-row">
		<button class="browse-btn" title="Open full rule browser with filters and tag search" onclick={() => ui.openRuleBrowser()}>
			Browse all rules ↗
		</button>
	</div>

	<p class="library-hint">
		<span class="badge-explain"><span class="rule-badge set-badge">S</span> Set — adds a bundle of related rules at once</span>
		<span class="badge-explain"><span class="rule-badge global-badge">G</span> Global — on/off for entire grid</span>
		<span class="badge-explain"><span class="rule-badge local-badge">L</span> Local — click Add, then select cells</span>
	</p>

	<input
		class="search"
		type="text"
		placeholder="Search rules..."
		bind:value={searchQuery}
	/>

	<div class="rule-list">
		<!-- 1. Favorited rules -->
		{#each favoritedRules as rule (rule.id)}
			{@render ruleItem(rule)}
		{/each}

		<!-- 2. Rule sets -->
		{#each getAvailableRulesets() as rs}
			<div class="rule-item ruleset-item">
				<div class="rule-info">
					<div class="rule-name-row">
						<span class="rule-badge set-badge" title="Rule set: adds multiple rules at once">S</span>
						<span class="rule-name">{rs.name}</span>
					</div>
					<span class="rule-desc">{rs.description}</span>
					<span class="ruleset-members">
						{rulesetRuleIds(rs).map((id) => ruleConfigs.find((r) => r.id === id)?.name ?? id).join(' · ')}
					</span>
				</div>
				<button
					class="add-btn"
					class:active={isRulesetActive(rs.id)}
					title={isRulesetActive(rs.id) ? 'Currently active — click to remove' : 'Add all rules in this set'}
					onclick={() => toggleRuleset(rs.id)}
				>
					{isRulesetActive(rs.id) ? 'On' : 'Add'}
				</button>
			</div>
		{/each}

		<!-- 3. Non-favorited rules -->
		{#each nonFavoritedRules as rule (rule.id)}
			{@render ruleItem(rule)}
		{/each}
	</div>

	<button class="custom-btn" title="Write your own constraint using MiniZinc syntax" onclick={() => ui.openCustomRuleEditor()}>
		+ Custom Constraint
	</button>
	</details>
</div>

{#snippet ruleItem(rule: RuleConfig)}
	{@const pickNeeded = needsBindingPick(rule)}
	<div class="rule-item">
		<button
			class="fav-btn"
			class:favorited={ui.favoriteRules.has(rule.id)}
			title={ui.favoriteRules.has(rule.id) ? 'Unfavorite' : 'Favorite'}
			onclick={(e) => toggleFavorite(rule.id, e)}
		>
			{ui.favoriteRules.has(rule.id) ? '★' : '☆'}
		</button>
		<div class="rule-info">
			<div class="rule-name-row">
				<span
					class="rule-badge {rule.scope === 'global' ? 'global-badge' : 'local-badge'}"
					title={rule.scope === 'global' ? 'Global: applies to the whole grid' : 'Local: you pick which cells it applies to'}
				>{rule.scope === 'global' ? 'G' : 'L'}</span>
				<span class="rule-name">{rule.name}</span>
			</div>
			<span class="rule-desc">{rule.description}</span>
		</div>
		{#if rule.scope === 'global'}
			<button
				class="add-btn"
				class:active={!pickNeeded && isGlobalEnabled(rule.id)}
				title={pickNeeded
					? 'Add this rule (choose which variable it applies to by clicking it in the active list)'
					: isGlobalEnabled(rule.id) ? 'Currently enabled — click to disable' : 'Click to enable for the whole grid'}
				onclick={() => toggleOrAddGlobalRule(rule)}
			>
				{pickNeeded ? 'Add' : isGlobalEnabled(rule.id) ? 'On' : 'Off'}
			</button>
		{:else}
			<button class="add-btn" title="Add, then click cells on the grid to apply it" onclick={() => addLocalRule(rule)}>Add</button>
		{/if}
		{#if isCustomRule(rule.id)}
			<button class="edit-btn" title="Edit definition" onclick={(e) => editCustomRule(rule.id, e)}>&#9998;</button>
			<button class="remove-btn" title="Delete" onclick={(e) => removeCustomRule(rule.id, e)}>×</button>
		{/if}
	</div>
{/snippet}

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

	/* ── Active rules list ── */
	.active-rules-list {
		max-height: 260px;
		overflow-y: auto;
	}

	/* ── Rule set group in active list ── */
	.ruleset-group {
		margin-bottom: 4px;
		border: 1px solid #e0e0e0;
		border-radius: 5px;
		overflow: hidden;
	}

	.ruleset-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		background: #f3e5f5;
		font-size: 13px;
		cursor: pointer;
	}

	.ruleset-header:hover {
		background: #ead1f0;
	}

	.ruleset-group.selected {
		outline: 2px solid #9c36b5;
	}

	.active-rule.global.selected {
		outline: 2px solid #4caf50;
	}

	.ruleset-name {
		font-weight: 600;
		flex: 1;
		color: #4a148c;
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

	.active-rule.indented {
		padding-left: 18px;
		border-radius: 0;
		margin-bottom: 0;
		background: #fce4ec !important;
		border-top: 1px solid #f8bbd0;
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

	/* ── Badges ── */
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
		cursor: help;
	}

	.global-badge { background: #c8e6c9; color: #2e7d32; }
	.local-badge  { background: #bbdefb; color: #1565c0; }
	.set-badge    { background: #e1bee7; color: #6a1b9a; }

	.group-value {
		font-size: 11px;
		color: #666;
	}

	.binding-info {
		font-size: 11px;
		color: #7b1fa2;
		font-style: italic;
	}

	/* ── Buttons ── */
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

	.dup-btn:hover { color: #4caf50; }

	.remove-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #999;
		padding: 0 4px;
	}

	.active-rule.global .remove-btn { margin-left: auto; }
	.ruleset-header .remove-btn { margin-left: auto; }

	.remove-btn:hover { color: #e53935; }

	.edit-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 13px;
		color: #999;
		padding: 0 4px;
	}

	.edit-btn:hover { color: #4287f5; }

	.library-top-row {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 6px;
	}

	.browse-btn {
		padding: 5px 12px;
		border: 1px solid #4287f5;
		background: #e8f0fe;
		color: #1a73e8;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
	}

	.browse-btn:hover {
		background: #d2e3fc;
	}

	/* ── Library section — collapsible ── */
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

	.library-header::-webkit-details-marker { display: none; }

	.library-header::before {
		content: '\25B6';
		font-size: 9px;
		color: #888;
		transition: transform 0.15s;
	}

	.library-section[open] > .library-header::before { transform: rotate(90deg); }
	.library-header h3 { margin: 0; }

	.library-hint {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin: 0 0 8px;
		padding: 6px 8px;
		background: #fafafa;
		border: 1px solid #eee;
		border-radius: 4px;
	}

	.badge-explain {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: #666;
	}

	.rule-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 350px;
		overflow-y: auto;
	}

	/* ── Rule / ruleset items ── */
	.rule-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border: 1px solid #eee;
		border-radius: 4px;
	}

	.ruleset-item {
		border-color: #ce93d8;
		background: #faf0ff;
	}

	.rule-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.rule-name-row {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.rule-name {
		font-size: 13px;
		font-weight: 500;
	}

	.rule-desc {
		font-size: 11px;
		color: #888;
	}

	.ruleset-members {
		font-size: 10px;
		color: #9c4dcc;
		font-style: italic;
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

	.add-btn:hover:not(.active) { background: #eee; }

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

	.fav-btn.favorited { color: #ffc107; }
	.fav-btn:hover { color: #ffc107; }

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
