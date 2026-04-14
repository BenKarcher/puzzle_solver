<script lang="ts">
	import { nanoid } from 'nanoid';
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import type { CustomRuleDefinition } from '$lib/model/types';

	interface Props {
		editingRule?: CustomRuleDefinition | null;
		onclose: () => void;
	}

	let { editingRule = null, onclose }: Props = $props();

	// Capture initial values from the prop (this modal is created/destroyed, not reused)
	// svelte-ignore state_referenced_locally
	const initial = editingRule;

	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let scope = $state<'global' | 'local'>(initial?.scope ?? 'global');
	let mzn = $state(initial?.mzn ?? '');
	let reqNumbers = $state(initial?.requiredSpaces.includes('numbers') ?? true);
	let reqShading = $state(initial?.requiredSpaces.includes('shading') ?? false);
	let reqBorders = $state(initial?.requiredSpaces.includes('borders') ?? false);
	let reqLines = $state(initial?.requiredSpaces.includes('lines') ?? false);

	// Group config (local rules only)
	let groupCount = $state(initial?.groups?.min ?? 1);
	let groupMinSize = $state(initial?.groups?.constraints.minSize ?? 1);
	let groupMaxSize = $state<number | null>(initial?.groups?.constraints.maxSize ?? null);
	let groupHasValue = $state(initial?.groups?.constraints.hasValue ?? false);
	let groupValueLabel = $state(initial?.groups?.constraints.valueLabel ?? 'Value');

	let error = $state('');

	const predicateName = $derived(
		name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'my_constraint'
	);

	const predicateSignature = $derived.by(() => {
		const args: string[] = [];
		for (let i = 0; i < groupCount; i++) {
			const suffix = groupCount > 1 ? `_${i + 1}` : '';
			if (reqNumbers) {
				args.push(`array[int] of var int: cells${suffix}`);
			}
			if (reqShading) {
				args.push(`array[int] of var bool: shaded${suffix}`);
			}
			if (reqBorders) {
				args.push(`array[int, 1..4] of var bool: borders${suffix}`);
			}
			if (reqLines) {
				args.push(`array[int, 1..4] of var int: lines${suffix}`);
			}
			if (groupHasValue) {
				args.push(`int: ${groupValueLabel.toLowerCase().replace(/\s+/g, '_')}${suffix}`);
			}
		}
		return `predicate ${predicateName}(${args.join(', ')})`;
	});

	function buildRequiredSpaces(): Array<'numbers' | 'shading' | 'borders' | 'lines'> {
		const spaces: Array<'numbers' | 'shading' | 'borders' | 'lines'> = [];
		if (reqNumbers) spaces.push('numbers');
		if (reqShading) spaces.push('shading');
		if (reqBorders) spaces.push('borders');
		if (reqLines) spaces.push('lines');
		return spaces;
	}

	function handleSubmit() {
		if (!name.trim()) { error = 'Name is required'; return; }
		if (!mzn.trim()) { error = 'MiniZinc code is required'; return; }
		error = '';

		const id = editingRule?.id ?? `custom-${predicateName}-${nanoid(6)}`;
		const rule: CustomRuleDefinition = {
			id,
			name: name.trim(),
			description: description.trim(),
			scope,
			mzn: mzn.trim(),
			requiredSpaces: buildRequiredSpaces(),
			groups: scope === 'local' ? {
				min: groupCount,
				max: groupCount,
				constraints: {
					minSize: groupMinSize,
					maxSize: groupMaxSize,
					hasValue: groupHasValue,
					valueLabel: groupHasValue ? groupValueLabel : undefined
				}
			} : undefined,
			predicateName: scope === 'local' ? predicateName : undefined
		};

		if (editingRule) {
			puzzleStore.updateCustomRule(rule);
		} else {
			puzzleStore.addCustomRule(rule);
		}
		onclose();
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<div class="overlay" role="presentation" onclick={handleOverlayClick}>
	<div class="editor-modal" role="dialog" aria-modal="true" aria-label="Custom constraint editor">
		<h2>{editingRule ? 'Edit' : 'New'} Custom Constraint</h2>

		<div class="form-row">
			<label>
				Name
				<input type="text" bind:value={name} placeholder="My Constraint" />
			</label>
		</div>

		<div class="form-row">
			<label>
				Description
				<input type="text" bind:value={description} placeholder="What this constraint does" />
			</label>
		</div>

		<div class="form-row">
			<label>
				Scope
				<select bind:value={scope}>
					<option value="global">Global (bare constraints)</option>
					<option value="local">Local (predicate with cell groups)</option>
				</select>
			</label>
		</div>

		<fieldset class="form-row">
			<legend>Required Solution Spaces</legend>
			<label class="checkbox"><input type="checkbox" bind:checked={reqNumbers} /> Numbers</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqShading} /> Shading</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqBorders} /> Borders</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqLines} /> Lines</label>
		</fieldset>

		{#if scope === 'local'}
			<fieldset class="form-row">
				<legend>Group Configuration</legend>
				<div class="group-config">
					<label>
						Number of groups
						<input type="number" min="1" max="10" bind:value={groupCount} />
					</label>
					<label>
						Min cells/group
						<input type="number" min="0" max="100" bind:value={groupMinSize} />
					</label>
					<label>
						Max cells/group
						<input type="number" min="0" max="100" value={groupMaxSize ?? ''} oninput={(e) => {
							const v = (e.target as HTMLInputElement).value;
							groupMaxSize = v === '' ? null : parseInt(v);
						}} placeholder="unlimited" />
					</label>
					<label class="checkbox">
						<input type="checkbox" bind:checked={groupHasValue} /> Group has value
					</label>
					{#if groupHasValue}
						<label>
							Value label
							<input type="text" bind:value={groupValueLabel} placeholder="Value" />
						</label>
					{/if}
				</div>
			</fieldset>
		{/if}

		<div class="form-row">
			<label>
				MiniZinc Code
				{#if scope === 'global'}
					<span class="hint">Write bare constraints (e.g., <code>constraint ...</code>). Variables: <code>grid</code>, <code>shaded</code>, <code>rows</code>, <code>cols</code>, <code>region</code></span>
				{:else}
					<span class="hint">Define a predicate with this signature:</span>
					<code class="signature">{predicateSignature}</code>
				{/if}
				<textarea bind:value={mzn} rows="12" spellcheck="false"></textarea>
			</label>
		</div>

		{#if error}
			<div class="error">{error}</div>
		{/if}

		<div class="buttons">
			<button class="btn cancel" onclick={onclose}>Cancel</button>
			<button class="btn submit" onclick={handleSubmit}>
				{editingRule ? 'Save' : 'Add Constraint'}
			</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.editor-modal {
		background: white;
		border-radius: 8px;
		padding: 24px;
		width: 600px;
		max-width: 90vw;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	h2 {
		margin: 0 0 16px;
		font-size: 18px;
	}

	.form-row {
		margin-bottom: 12px;
	}

	.form-row > label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
		font-weight: 500;
		color: #555;
	}

	fieldset {
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 8px 12px;
	}

	legend {
		font-size: 13px;
		font-weight: 500;
		color: #555;
		padding: 0 4px;
	}

	input[type="text"],
	select {
		padding: 6px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
	}

	input[type="number"] {
		width: 80px;
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
	}

	.checkbox {
		display: flex;
		flex-direction: row !important;
		align-items: center;
		gap: 6px;
		font-weight: 400 !important;
		cursor: pointer;
	}

	.group-config {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
	}

	.group-config label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
		color: #666;
	}

	textarea {
		width: 100%;
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 12px;
		line-height: 1.5;
		padding: 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		resize: vertical;
		box-sizing: border-box;
		tab-size: 4;
	}

	.hint {
		font-size: 11px;
		color: #999;
		font-weight: 400;
	}

	.hint code {
		background: #f0f0f0;
		padding: 1px 3px;
		border-radius: 2px;
		font-size: 10px;
	}

	.signature {
		display: block;
		background: #f0f0f0;
		padding: 6px 8px;
		border-radius: 4px;
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 11px;
		color: #333;
		margin: 4px 0;
		user-select: all;
		word-break: break-all;
	}

	.error {
		background: #ffebee;
		color: #c62828;
		padding: 8px;
		border-radius: 4px;
		font-size: 12px;
		margin-bottom: 12px;
	}

	.buttons {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.btn {
		padding: 8px 16px;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn.cancel {
		background: white;
	}

	.btn.cancel:hover {
		background: #f5f5f5;
	}

	.btn.submit {
		background: #4287f5;
		color: white;
		border-color: #4287f5;
	}

	.btn.submit:hover {
		background: #3070d0;
	}
</style>
