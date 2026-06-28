<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { selection } from '$lib/state/selection.svelte';
	import { isCustomRule, getAllRulesets } from '$lib/rules/registry';
	import type { RuleConfig, RulesetConfig } from '$lib/model/types';

	interface Props {
		ruleConfigs: RuleConfig[];
		onclose: () => void;
	}

	let { ruleConfigs, onclose }: Props = $props();

	let searchQuery = $state('');
	let scopeFilter = $state<'all' | 'global' | 'local' | 'set'>('all');
	let tagFilter = $state('');

	const allRulesets = getAllRulesets();

	// ── Tags ──────────────────────────────────────────────────────────────────

	const allTags = $derived.by(() => {
		const tags = new Set<string>();
		for (const rule of ruleConfigs) {
			for (const cat of rule.categories) tags.add(cat);
		}
		for (const rs of allRulesets) {
			for (const cat of rs.categories) tags.add(cat);
		}
		return [...tags].sort();
	});

	// ── Space-based availability ───────────────────────────────────────────────

	function getEnabledSpaces(): Set<string> {
		const s = new Set<string>();
		const spaces = puzzleStore.puzzle.solutionSpaces;
		if (spaces.numbers.enabled) { s.add('digits'); s.add('values'); }
		if (spaces.modifiers.enabled) s.add('modifier');
		if (spaces.shading.enabled) s.add('shading');
		if (spaces.borders.enabled) s.add('borders');
		if (spaces.lines.enabled) s.add('lines');
		s.add('regions');
		s.add('positions');
		return s;
	}

	function rulesetRequiredSpaces(rs: RulesetConfig): string[] {
		const spaces = new Set<string>();
		for (const id of rs.rules) {
			const cfg = ruleConfigs.find((r) => r.id === id);
			cfg?.requiredSpaces.forEach((s) => spaces.add(s));
		}
		return [...spaces];
	}

	// ── Filtering ─────────────────────────────────────────────────────────────

	const filteredRules = $derived.by(() => {
		if (scopeFilter === 'set') return [];
		const enabledSpaces = getEnabledSpaces();
		return ruleConfigs.filter((rule) => {
			if (!rule.requiredSpaces.every((sp) => enabledSpaces.has(sp))) return false;
			if (scopeFilter === 'global' && rule.scope !== 'global') return false;
			if (scopeFilter === 'local' && rule.scope !== 'local') return false;
			if (tagFilter && !rule.categories.includes(tagFilter)) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!rule.name.toLowerCase().includes(q) &&
					!rule.description.toLowerCase().includes(q) &&
					!rule.categories.some((c) => c.toLowerCase().includes(q))
				) return false;
			}
			return true;
		}).sort((a, b) => a.name.localeCompare(b.name));
	});

	const filteredRulesets = $derived.by(() => {
		if (scopeFilter === 'global' || scopeFilter === 'local') return [];
		const enabledSpaces = getEnabledSpaces();
		return allRulesets.filter((rs) => {
			if (!rulesetRequiredSpaces(rs).every((s) => enabledSpaces.has(s))) return false;
			if (tagFilter && !rs.categories.includes(tagFilter)) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				return (
					rs.name.toLowerCase().includes(q) ||
					rs.description.toLowerCase().includes(q) ||
					rs.categories.some((c) => c.toLowerCase().includes(q)) ||
					rs.rules.some((id) => {
						const cfg = ruleConfigs.find((r) => r.id === id);
						return cfg?.name.toLowerCase().includes(q);
					})
				);
			}
			return true;
		});
	});

	const totalResults = $derived(filteredRulesets.length + filteredRules.length);

	// ── State helpers ─────────────────────────────────────────────────────────

	function isGlobalEnabled(ruleId: string): boolean {
		return puzzleStore.puzzle.globalRules.includes(ruleId);
	}

	function isRulesetActive(rulesetId: string): boolean {
		return puzzleStore.puzzle.activeRulesets.includes(rulesetId);
	}

	// ── Actions ───────────────────────────────────────────────────────────────

	function toggleGlobalRule(ruleId: string) {
		puzzleStore.toggleGlobalRule(ruleId);
	}

	function toggleRuleset(rulesetId: string) {
		puzzleStore.toggleRuleset(rulesetId);
	}

	function addLocalRule(rule: RuleConfig) {
		// Only inherit a free selection — if we're leaving a group-edit context, start fresh
		const sourceCells = ui.selectedRuleInstanceId ? [] : selection.cells;

		const instanceId = puzzleStore.addRuleInstance(rule.id);
		const firstGroup = rule.groups?.[0];
		if (sourceCells.length > 0 && firstGroup && firstGroup.maxSize !== 0) {
			const { minSize, maxSize } = firstGroup;
			const validSize =
				sourceCells.length >= minSize && (maxSize === null || sourceCells.length <= maxSize);
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
		onclose();
	}

	function toggleFavorite(ruleId: string, e: MouseEvent) {
		e.stopPropagation();
		ui.toggleFavoriteRule(ruleId);
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={handleBackdrop}>
	<div class="dialog" role="dialog" aria-modal="true" aria-label="Rule Browser">
		<!-- Header -->
		<div class="header">
			<h2>Browse Rules</h2>
			<button class="close-btn" title="Close" onclick={onclose}>✕</button>
		</div>

		<!-- Filter bar -->
		<div class="filter-bar">
			<input
				class="search"
				type="text"
				placeholder="Search by name, description, or tag…"
				bind:value={searchQuery}
				autofocus
			/>

			<div class="scope-pills">
				{#each [
					{ value: 'all',    label: 'All'    },
					{ value: 'set',    label: 'Sets'   },
					{ value: 'global', label: 'Global' },
					{ value: 'local',  label: 'Local'  },
				] as pill}
					<button
						class="pill"
						class:active={scopeFilter === pill.value}
						onclick={() => { scopeFilter = pill.value as typeof scopeFilter; }}
					>{pill.label}</button>
				{/each}
			</div>

			<select class="tag-select" bind:value={tagFilter}>
				<option value="">Any tag</option>
				{#each allTags as tag}
					<option value={tag}>{tag}</option>
				{/each}
			</select>
		</div>

		<!-- Result count -->
		<div class="result-count">
			{totalResults} result{totalResults !== 1 ? 's' : ''}
		</div>

		<!-- Cards -->
		<div class="cards-area">
			<!-- Rulesets -->
			{#each filteredRulesets as rs}
				<div class="card ruleset-card">
					<div class="card-header">
						<span class="badge set-badge" title="Rule set: activates multiple rules at once">S</span>
						<span class="card-name">{rs.name}</span>
						<button
							class="action-btn"
							class:action-on={isRulesetActive(rs.id)}
							title={isRulesetActive(rs.id) ? 'Active — click to deactivate' : 'Activate this rule set'}
							onclick={() => toggleRuleset(rs.id)}
						>
							{isRulesetActive(rs.id) ? 'Active' : 'Activate'}
						</button>
					</div>
					<p class="card-desc">{rs.description}</p>
					<div class="card-members">
						{#each rs.rules as ruleId}
							{@const cfg = ruleConfigs.find((r) => r.id === ruleId)}
							{#if cfg}
								<span class="member-chip">{cfg.name}</span>
							{/if}
						{/each}
					</div>
					<div class="card-tags">
						{#each rs.categories as cat}
							<button
								class="tag-chip"
								class:tag-active={tagFilter === cat}
								onclick={() => { tagFilter = tagFilter === cat ? '' : cat; }}
							>{cat}</button>
						{/each}
					</div>
				</div>
			{/each}

			<!-- Individual rules -->
			{#each filteredRules as rule}
				{@const isFav = ui.favoriteRules.has(rule.id)}
				{@const isEnabled = rule.scope === 'global' && isGlobalEnabled(rule.id)}
				<div class="card" class:card-enabled={isEnabled}>
					<div class="card-header">
						<span
							class="badge {rule.scope === 'global' ? 'global-badge' : 'local-badge'}"
							title={rule.scope === 'global'
								? 'Global: applies to the whole grid'
								: 'Local: click Add then select cells on the grid'}
						>{rule.scope === 'global' ? 'G' : 'L'}</span>
						<span class="card-name">{rule.name}</span>
						<button
							class="fav-btn"
							class:favorited={isFav}
							title={isFav ? 'Unfavorite' : 'Favorite — pins to top of library'}
							onclick={(e) => toggleFavorite(rule.id, e)}
						>{isFav ? '★' : '☆'}</button>
						{#if rule.scope === 'global'}
							<button
								class="action-btn"
								class:action-on={isEnabled}
								title={isEnabled ? 'Enabled — click to disable' : 'Enable for the whole grid'}
								onclick={() => toggleGlobalRule(rule.id)}
							>{isEnabled ? 'On' : 'Off'}</button>
						{:else}
							<button
								class="action-btn"
								title="Add instance — then click cells on the grid to apply"
								onclick={() => addLocalRule(rule)}
							>Add</button>
						{/if}
					</div>
					<p class="card-desc">{rule.description}</p>
					<div class="card-tags">
						{#each rule.categories as cat}
							<button
								class="tag-chip"
								class:tag-active={tagFilter === cat}
								onclick={() => { tagFilter = tagFilter === cat ? '' : cat; }}
							>{cat}</button>
						{/each}
					</div>
				</div>
			{/each}

			{#if totalResults === 0}
				<p class="empty">No rules match these filters.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 24px;
		box-sizing: border-box;
	}

	.dialog {
		background: white;
		border-radius: 8px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.28);
		width: 100%;
		max-width: 1000px;
		height: 85vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* ── Header ── */
	.header {
		display: flex;
		align-items: center;
		padding: 16px 20px 12px;
		border-bottom: 1px solid #e0e0e0;
		flex-shrink: 0;
	}

	h2 {
		margin: 0;
		flex: 1;
		font-size: 18px;
		font-weight: 600;
		color: #333;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 18px;
		cursor: pointer;
		color: #888;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.close-btn:hover { background: #f0f0f0; color: #333; }

	/* ── Filter bar ── */
	.filter-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px;
		border-bottom: 1px solid #eee;
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.search {
		flex: 1;
		min-width: 180px;
		padding: 7px 10px;
		border: 1px solid #ccc;
		border-radius: 5px;
		font-size: 14px;
	}

	.search:focus { outline: none; border-color: #4287f5; box-shadow: 0 0 0 2px rgba(66,135,245,0.15); }

	.scope-pills {
		display: flex;
		gap: 4px;
	}

	.pill {
		padding: 5px 12px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 20px;
		font-size: 13px;
		cursor: pointer;
		color: #555;
		transition: background 0.1s, color 0.1s;
	}

	.pill:hover:not(.active) { background: #f5f5f5; }

	.pill.active {
		background: #4287f5;
		border-color: #4287f5;
		color: white;
		font-weight: 600;
	}

	.tag-select {
		padding: 6px 8px;
		border: 1px solid #ccc;
		border-radius: 5px;
		font-size: 13px;
		cursor: pointer;
		max-width: 180px;
	}

	/* ── Result count ── */
	.result-count {
		padding: 6px 20px 4px;
		font-size: 12px;
		color: #999;
		flex-shrink: 0;
	}

	/* ── Cards area ── */
	.cards-area {
		flex: 1;
		overflow-y: auto;
		padding: 12px 20px 20px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
		gap: 12px;
		align-content: start;
	}

	.empty {
		grid-column: 1 / -1;
		text-align: center;
		color: #999;
		font-style: italic;
		margin-top: 40px;
	}

	/* ── Cards ── */
	.card {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: white;
		transition: box-shadow 0.15s;
	}

	.card:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.1); }

	.card-enabled {
		background: #f1f8f1;
		border-color: #a5d6a7;
	}

	.ruleset-card {
		background: #faf0ff;
		border-color: #ce93d8;
	}

	.ruleset-card:hover { box-shadow: 0 2px 10px rgba(150,0,200,0.12); }

	.card-header {
		display: flex;
		align-items: center;
		gap: 7px;
	}

	/* ── Badges ── */
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 700;
		flex-shrink: 0;
		cursor: help;
	}

	.global-badge { background: #c8e6c9; color: #2e7d32; }
	.local-badge  { background: #bbdefb; color: #1565c0; }
	.set-badge    { background: #e1bee7; color: #6a1b9a; }

	.card-name {
		flex: 1;
		font-size: 14px;
		font-weight: 600;
		color: #222;
	}

	.fav-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 18px;
		color: #ccc;
		padding: 0;
		line-height: 1;
		flex-shrink: 0;
	}

	.fav-btn.favorited { color: #ffc107; }
	.fav-btn:hover { color: #ffc107; }

	.action-btn {
		padding: 4px 12px;
		border: 1px solid #bbb;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		flex-shrink: 0;
		font-weight: 500;
	}

	.action-btn:hover:not(.action-on) { background: #f0f0f0; }

	.action-btn.action-on {
		background: #4caf50;
		border-color: #4caf50;
		color: white;
	}

	.card-desc {
		margin: 0;
		font-size: 12px;
		color: #555;
		line-height: 1.5;
	}

	/* ── Ruleset member chips ── */
	.card-members {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.member-chip {
		font-size: 11px;
		padding: 2px 7px;
		background: #f3e5f5;
		color: #7b1fa2;
		border-radius: 10px;
		border: 1px solid #ce93d8;
	}

	/* ── Tag chips ── */
	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.tag-chip {
		font-size: 11px;
		padding: 2px 7px;
		background: #f5f5f5;
		color: #666;
		border-radius: 10px;
		border: 1px solid #ddd;
		cursor: pointer;
	}

	.tag-chip:hover { background: #e8f0fe; color: #1a73e8; border-color: #aecbfa; }

	.tag-chip.tag-active {
		background: #e8f0fe;
		color: #1a73e8;
		border-color: #4287f5;
		font-weight: 600;
	}
</style>
