<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import type { RuleConfig, RuleInstance } from '$lib/model/types';

	interface Props {
		instance: RuleInstance;
		config: RuleConfig;
	}

	let { instance, config }: Props = $props();

	let firstValueInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (
			ui.pendingValueFocus === instance.id &&
			firstValueInput &&
			config.groups?.[0]?.hasValue
		) {
			firstValueInput.focus();
			firstValueInput.select();
			ui.pendingValueFocus = null;
		}
	});

	const GROUP_COLORS = ['rgba(66, 135, 245, 0.3)', 'rgba(245, 166, 66, 0.3)', 'rgba(76, 175, 80, 0.3)', 'rgba(156, 39, 176, 0.3)'];

	function isGroupInvalid(
		group: { cells: { row: number; col: number }[]; value: number | null },
		gi: number
	): boolean {
		const cfg = config.groups?.[gi];
		if (!cfg) return false;
		const isCellless = cfg.maxSize === 0;
		if (!isCellless && group.cells.length < cfg.minSize) return true;
		if (cfg.hasValue && group.value === null) return true;
		return false;
	}

	function groupSizeLabel(group: { cells: { row: number; col: number }[] }, gi: number): string {
		const cfg = config.groups?.[gi];
		if (!cfg) return `${group.cells.length} cells`;
		if (cfg.maxSize === 0) return 'no cells';

		if (cfg.isRegion) {
			if (group.cells.length === 0) return 'no region selected';
			// Look up the regionId from the first cell
			const first = group.cells[0];
			const regionId = puzzleStore.puzzle.cells[first.row]?.[first.col]?.regionId ?? '?';
			return `Region ${regionId} (${group.cells.length} cells)`;
		}

		const { minSize, maxSize } = cfg;
		if (maxSize !== null) return `${group.cells.length} / ${maxSize} cells`;
		return `${group.cells.length} cells (min ${minSize})`;
	}

	function selectGroup(index: number) {
		ui.selectRuleInstance(instance.id, index);
	}

	function updateGroupValue(groupIndex: number, value: string) {
		const num = value === '' ? null : parseInt(value);
		puzzleStore.setGroupValue(instance.id, groupIndex, isNaN(num as number) ? null : num);
	}

	/** Hint text for the currently-active group */
	const activeGroupHint = $derived.by(() => {
		const cfg = config.groups?.[ui.selectedGroupIndex];
		if (!cfg) return 'Click cells on the grid to add/remove from the selected group';
		if (cfg.isRegion) return 'Click any cell on the grid to select that cell\'s entire region';
		if (cfg.maxSize === 0) return 'This group has no cells';
		return 'Click cells on the grid to add/remove from the selected group';
	});
</script>

<div class="instance-editor">
	<h4>{config.name}</h4>
	<p class="description">{config.description}</p>

	<div class="groups">
		{#each instance.groups as group, gi}
			{@const cfg = config.groups?.[gi]}
			{@const isCellless = cfg?.maxSize === 0}
			{@const isRegion = cfg?.isRegion === true}
			<div
				class="group"
				class:selected={ui.selectedGroupIndex === gi}
				class:invalid={isGroupInvalid(group, gi)}
				class:cellless={isCellless}
				class:region-group={isRegion}
				style="border-left: 3px solid {isGroupInvalid(group, gi) ? 'rgba(211, 47, 47, 0.7)' : GROUP_COLORS[gi % GROUP_COLORS.length]}"
				role="button"
				tabindex="0"
				onclick={() => selectGroup(gi)}
				onkeydown={(e) => e.key === 'Enter' && selectGroup(gi)}
			>
				<div class="group-header">
					<span>
						{cfg?.hasValue && instance.groups.length === 1 ? (cfg.valueLabel ?? 'Group') : `Group ${gi + 1}`}
						{#if isRegion}
							<span
								class="region-badge"
								title="Region group: clicking any cell on the grid selects that cell's entire region"
							>region</span>
						{/if}
					</span>
					{#if !isCellless}
						<span class="cell-count">{groupSizeLabel(group, gi)}</span>
					{/if}
				</div>

				{#if cfg?.hasValue}
					<label class="value-input">
						{cfg.valueLabel ?? 'Value'}:
						{#if gi === 0}
							<input
								type="number"
								value={group.value ?? ''}
								bind:this={firstValueInput}
								oninput={(e) => updateGroupValue(gi, (e.target as HTMLInputElement).value)}
								onclick={(e) => e.stopPropagation()}
							/>
						{:else}
							<input
								type="number"
								value={group.value ?? ''}
								oninput={(e) => updateGroupValue(gi, (e.target as HTMLInputElement).value)}
								onclick={(e) => e.stopPropagation()}
							/>
						{/if}
					</label>
				{/if}
			</div>
		{/each}
	</div>

	<p class="hint">{activeGroupHint}</p>
</div>

<style>
	.instance-editor {
		padding: 8px;
	}

	h4 {
		margin: 0 0 4px;
		font-size: 14px;
	}

	.description {
		font-size: 11px;
		color: #888;
		margin: 0 0 8px;
	}

	.groups {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.group {
		padding: 6px 8px;
		border-radius: 4px;
		background: #f9f9f9;
		cursor: pointer;
	}

	.group.selected {
		background: #e8f0fe;
	}

	.group.invalid {
		background: #ffebee;
	}

	.group.invalid.selected {
		background: #ffcdd2;
	}

	.group.cellless {
		opacity: 0.95;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
	}

	.cell-count {
		font-size: 11px;
		color: #888;
		margin-left: auto;
	}

	.region-badge {
		display: inline-block;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		background: #e8f5e9;
		color: #2e7d32;
		border: 1px solid #a5d6a7;
		border-radius: 3px;
		padding: 1px 4px;
		vertical-align: middle;
		cursor: help;
	}

	.value-input {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		margin-top: 4px;
		color: #666;
	}

	.value-input input {
		width: 60px;
		padding: 2px 4px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 12px;
	}

	.hint {
		font-size: 11px;
		color: #aaa;
		font-style: italic;
		margin-top: 8px;
	}
</style>
