<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import type { RuleConfig, RuleInstance } from '$lib/model/types';

	interface Props {
		instance: RuleInstance;
		config: RuleConfig;
	}

	let { instance, config }: Props = $props();

	const GROUP_COLORS = ['rgba(66, 135, 245, 0.3)', 'rgba(245, 166, 66, 0.3)', 'rgba(76, 175, 80, 0.3)', 'rgba(156, 39, 176, 0.3)'];

	function isGroupInvalid(group: { cells: { row: number; col: number }[]; value: number | null }): boolean {
		const minSize = config.groups?.constraints.minSize ?? 0;
		if (group.cells.length < minSize) return true;
		if (config.groups?.constraints.hasValue && group.value === null) return true;
		return false;
	}

	function groupSizeLabel(cellCount: number): string {
		const constraints = config.groups?.constraints;
		if (!constraints) return `${cellCount} cells`;
		const { minSize, maxSize } = constraints;
		if (maxSize !== null && minSize === maxSize) return `${cellCount} / ${maxSize} cells`;
		if (maxSize !== null) return `${cellCount} / ${maxSize} cells`;
		return `${cellCount} cells (min ${minSize})`;
	}

	function selectGroup(index: number) {
		ui.selectRuleInstance(instance.id, index);
	}

	function updateGroupValue(groupIndex: number, value: string) {
		const num = value === '' ? null : parseInt(value);
		puzzleStore.setGroupValue(instance.id, groupIndex, isNaN(num as number) ? null : num);
	}

	function addGroup() {
		if (!config.groups) return;
		if (instance.groups.length >= config.groups.max) return;
		// Directly push a new group - the store handles reactivity
		puzzleStore.puzzle.localRules = puzzleStore.puzzle.localRules.map((r) => {
			if (r.id !== instance.id) return r;
			return { ...r, groups: [...r.groups, { cells: [], value: null }] };
		});
	}

	function removeGroup(index: number) {
		if (!config.groups) return;
		if (instance.groups.length <= config.groups.min) return;
		puzzleStore.puzzle.localRules = puzzleStore.puzzle.localRules.map((r) => {
			if (r.id !== instance.id) return r;
			return { ...r, groups: r.groups.filter((_, i) => i !== index) };
		});
	}
</script>

<div class="instance-editor">
	<h4>{config.name}</h4>
	<p class="description">{config.description}</p>

	<div class="groups">
		{#each instance.groups as group, gi}
			<div
				class="group"
				class:selected={ui.selectedGroupIndex === gi}
				class:invalid={isGroupInvalid(group)}
				style="border-left: 3px solid {isGroupInvalid(group) ? 'rgba(211, 47, 47, 0.7)' : GROUP_COLORS[gi % GROUP_COLORS.length]}"
				role="button"
				tabindex="0"
				onclick={() => selectGroup(gi)}
				onkeydown={(e) => e.key === 'Enter' && selectGroup(gi)}
			>
				<div class="group-header">
					<span>Group {gi + 1}</span>
					<span class="cell-count">{groupSizeLabel(group.cells.length)}</span>
					{#if config.groups && instance.groups.length > config.groups.min}
						<button class="remove-btn" onclick={(e) => { e.stopPropagation(); removeGroup(gi); }}>×</button>
					{/if}
				</div>

				{#if config.groups?.constraints.hasValue}
					<label class="value-input">
						{config.groups?.constraints.valueLabel ?? 'Value'}:
						<input
							type="number"
							value={group.value ?? ''}
							oninput={(e) => updateGroupValue(gi, (e.target as HTMLInputElement).value)}
							onclick={(e) => e.stopPropagation()}
						/>
					</label>
				{/if}
			</div>
		{/each}
	</div>

	{#if config.groups && instance.groups.length < config.groups.max}
		<button class="add-group-btn" onclick={addGroup}>+ Add Group</button>
	{/if}

	<p class="hint">Click cells on the grid to add/remove from the selected group</p>
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

	.group-header {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
	}

	.cell-count {
		font-size: 11px;
		color: #888;
	}

	.remove-btn {
		margin-left: auto;
		background: none;
		border: none;
		cursor: pointer;
		color: #999;
		font-size: 14px;
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

	.add-group-btn {
		margin-top: 6px;
		padding: 3px 8px;
		border: 1px dashed #ccc;
		background: white;
		border-radius: 3px;
		cursor: pointer;
		font-size: 12px;
		color: #666;
	}

	.add-group-btn:hover {
		background: #f5f5f5;
	}

	.hint {
		font-size: 11px;
		color: #aaa;
		font-style: italic;
		margin-top: 8px;
	}
</style>
