<script lang="ts">
	import { nanoid } from 'nanoid';
	import JSZip from 'jszip';
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { getAllLoadedRules, getAvailableImports } from '$lib/rules/registry';
	import type { CustomRuleDefinition, RequiredSpace, RuleGroupConfig } from '$lib/model/types';

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
	let categoriesText = $state((initial?.categories ?? []).join(', '));
	let scope = $state<'global' | 'local'>(initial?.scope ?? 'global');
	let mzn = $state(initial?.mzn ?? '');
	let reqDigits = $state(initial?.requiredSpaces.includes('digits') ?? true);
	let reqValues = $state(initial?.requiredSpaces.includes('values') ?? false);
	let reqModifier = $state(initial?.requiredSpaces.includes('modifier') ?? false);
	let reqShading = $state(initial?.requiredSpaces.includes('shading') ?? false);
	let reqBorders = $state(initial?.requiredSpaces.includes('borders') ?? false);
	let reqLines = $state(initial?.requiredSpaces.includes('lines') ?? false);
	let reqRegions = $state(initial?.requiredSpaces.includes('regions') ?? false);
	let reqPositions = $state(initial?.requiredSpaces.includes('positions') ?? false);

	// Available imports (all .mzn files under src/lib/rules/imports/)
	const availableImports = getAvailableImports();
	let selectedImports = $state<Set<string>>(new Set(initial?.imports ?? []));

	function toggleImport(name: string) {
		const next = new Set(selectedImports);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		selectedImports = next;
	}

	// Per-group config (local rules only). Each entry = one group.
	let groupConfigs = $state<RuleGroupConfig[]>(
		initial?.groups
			? initial.groups.map((g) => ({ ...g }))
			: [{ minSize: 1, maxSize: null, hasValue: false }]
	);

	function addGroupConfig() {
		groupConfigs = [...groupConfigs, { minSize: 1, maxSize: null, hasValue: false }];
	}

	function removeGroupConfig(i: number) {
		if (groupConfigs.length <= 1) return;
		groupConfigs = groupConfigs.filter((_, idx) => idx !== i);
	}

	function updateGroupConfig(i: number, patch: Partial<RuleGroupConfig>) {
		groupConfigs = groupConfigs.map((g, idx) => (idx === i ? { ...g, ...patch } : g));
	}

	let error = $state('');

	// Templates: existing rules with a .mzn source (skip JS-generator-only rules)
	const templates = getAllLoadedRules()
		.filter((r) => r.mzn !== undefined)
		.map((r) => ({ id: r.config.id, name: r.config.name, loaded: r }))
		.sort((a, b) => a.name.localeCompare(b.name));

	let selectedTemplate = $state('');

	function loadTemplate() {
		const tpl = templates.find((t) => t.id === selectedTemplate);
		if (!tpl) return;
		const c = tpl.loaded.config;
		name = c.name;
		description = c.description;
		categoriesText = (c.categories ?? []).filter((cat) => cat !== 'custom').join(', ');
		scope = c.scope;
		mzn = tpl.loaded.mzn ?? '';
		reqDigits = c.requiredSpaces.includes('digits');
		reqValues = c.requiredSpaces.includes('values');
		reqModifier = c.requiredSpaces.includes('modifier');
		reqShading = c.requiredSpaces.includes('shading');
		reqBorders = c.requiredSpaces.includes('borders');
		reqLines = c.requiredSpaces.includes('lines');
		reqRegions = c.requiredSpaces.includes('regions');
		reqPositions = c.requiredSpaces.includes('positions');
		groupConfigs = c.groups?.length
			? c.groups.map((g) => ({ ...g }))
			: [{ minSize: 1, maxSize: null, hasValue: false }];
		selectedImports = new Set(c.imports ?? []);
		selectedTemplate = '';
	}

	const predicateName = $derived(
		name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'my_constraint'
	);

	const predicateSignature = $derived.by(() => {
		const args: string[] = [];
		const multi = groupConfigs.length > 1;
		for (let i = 0; i < groupConfigs.length; i++) {
			const g = groupConfigs[i];
			const suffix = multi ? `_${i + 1}` : '';
			const isCellless = g.maxSize === 0;
			if (!isCellless) {
				if (reqDigits) args.push(`array[int] of var int: digits${suffix}`);
				if (reqValues) args.push(`array[int] of var int: values${suffix}`);
				if (reqShading) args.push(`array[int] of var bool: shaded${suffix}`);
				if (reqBorders) args.push(`array[int, 1..4] of var bool: borders${suffix}`);
				if (reqLines) args.push(`array[int, 1..4] of var int: lines${suffix}`);
			}
			if (g.hasValue) {
				const label = (g.valueLabel ?? 'value').toLowerCase().replace(/\s+/g, '_') || 'value';
				args.push(`int: ${label}${suffix}`);
			}
		}
		return `predicate ${predicateName}(${args.join(', ')})`;
	});

	function buildRequiredSpaces(): RequiredSpace[] {
		const spaces: RequiredSpace[] = [];
		if (reqDigits) spaces.push('digits');
		if (reqValues) spaces.push('values');
		if (reqModifier) spaces.push('modifier');
		if (reqShading) spaces.push('shading');
		if (reqBorders) spaces.push('borders');
		if (reqLines) spaces.push('lines');
		if (reqRegions) spaces.push('regions');
		if (reqPositions) spaces.push('positions');
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
			categories: parseCategories(),
			scope,
			mzn: mzn.trim(),
			requiredSpaces: buildRequiredSpaces(),
			groups: scope === 'local'
				? groupConfigs.map((g) => ({
						minSize: g.minSize,
						maxSize: g.maxSize,
						hasValue: g.hasValue,
						valueLabel: g.hasValue ? (g.valueLabel ?? 'Value') : undefined,
					}))
				: undefined,
			predicateName: scope === 'local' ? predicateName : undefined,
			imports: selectedImports.size > 0 ? [...selectedImports].sort() : undefined,
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

	function parseCategories(): string[] {
		return categoriesText
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	/** Library-style folder slug: lowercase with hyphens, derived from the name. */
	const folderSlug = $derived(
		(name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'my-constraint'
	);

	async function downloadAsLibraryRule() {
		if (!name.trim() || !mzn.trim()) {
			error = 'Name and MiniZinc code are required before download.';
			return;
		}
		error = '';

		const config: Record<string, unknown> = {
			id: folderSlug,
			name: name.trim(),
			description: description.trim(),
			categories: parseCategories(),
			requiredSpaces: buildRequiredSpaces(),
			scope,
		};
		if (scope === 'local') {
			config.groups = groupConfigs.map((g) => ({
				minSize: g.minSize,
				maxSize: g.maxSize,
				hasValue: g.hasValue,
				...(g.hasValue ? { valueLabel: g.valueLabel ?? 'Value' } : {}),
			}));
			config.predicateName = predicateName;
		}
		if (selectedImports.size > 0) {
			config.imports = [...selectedImports].sort();
		}

		const zip = new JSZip();
		const folder = zip.folder(folderSlug);
		if (!folder) return;
		folder.file('config.json', JSON.stringify(config, null, '\t') + '\n');
		folder.file('rule.mzn', mzn.trim() + '\n');

		const blob = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${folderSlug}.zip`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="overlay" role="presentation" onclick={handleOverlayClick}>
	<div class="editor-modal" role="dialog" aria-modal="true" aria-label="Custom constraint editor">
		<h2>{editingRule ? 'Edit' : 'New'} Custom Constraint</h2>

		<div class="form-row template-row">
			<label>
				Load from existing rule
				<div class="template-controls">
					<select bind:value={selectedTemplate}>
						<option value="">Select a rule…</option>
						{#each templates as tpl}
							<option value={tpl.id}>{tpl.name}</option>
						{/each}
					</select>
					<button class="btn" onclick={loadTemplate} disabled={!selectedTemplate}>Load</button>
				</div>
				<span class="hint">Populates the form with the selected rule's code and config. Only rules with MiniZinc source are listed (JS-generated rules are excluded).</span>
			</label>
		</div>

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
				Categories
				<input type="text" bind:value={categoriesText} placeholder="comma,separated,tags" />
				<span class="hint">Used for filtering/grouping in the rule library (e.g. <code>sudoku, arithmetic</code>)</span>
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
			<label class="checkbox"><input type="checkbox" bind:checked={reqDigits} /> Digits</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqValues} /> Values</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqModifier} /> Modifier</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqShading} /> Shading</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqBorders} /> Borders</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqLines} /> Lines</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqRegions} /> Regions</label>
			<label class="checkbox"><input type="checkbox" bind:checked={reqPositions} /> Positions</label>
		</fieldset>

		{#if availableImports.length > 0}
			<details class="form-row imports-details">
				<summary>
					Advanced: Shared imports
					{#if selectedImports.size > 0}
						<span class="import-count">({selectedImports.size})</span>
					{/if}
				</summary>
				<p class="hint imports-hint">
					Prepend reusable MiniZinc snippets (e.g. <code>include "alldifferent.mzn";</code>,
					shared helper predicates). Each selected import is emitted once per compilation,
					deduplicated across rules.
				</p>
				<div class="imports-list">
					{#each availableImports as imp}
						<label class="checkbox">
							<input
								type="checkbox"
								checked={selectedImports.has(imp)}
								onchange={() => toggleImport(imp)}
							/>
							<code>{imp}</code>
						</label>
					{/each}
				</div>
			</details>
		{/if}

		{#if scope === 'local'}
			<fieldset class="form-row">
				<legend>Groups</legend>
				<div class="group-list">
					{#each groupConfigs as g, gi}
						<div class="group-card">
							<div class="group-card-header">
								<span>Group {gi + 1}{g.maxSize === 0 ? ' (value-only)' : ''}</span>
								{#if groupConfigs.length > 1}
									<button class="remove-btn" onclick={() => removeGroupConfig(gi)}>×</button>
								{/if}
							</div>
							<div class="group-card-fields">
								<label>
									Min cells
									<input
										type="number" min="0" max="100"
										value={g.minSize}
										oninput={(e) => updateGroupConfig(gi, { minSize: parseInt((e.target as HTMLInputElement).value) || 0 })}
									/>
								</label>
								<label>
									Max cells
									<input
										type="number" min="0" max="100"
										value={g.maxSize ?? ''}
										placeholder="unlimited"
										oninput={(e) => {
											const v = (e.target as HTMLInputElement).value;
											updateGroupConfig(gi, { maxSize: v === '' ? null : parseInt(v) });
										}}
									/>
								</label>
								<label class="checkbox">
									<input
										type="checkbox"
										checked={g.hasValue}
										onchange={(e) => updateGroupConfig(gi, { hasValue: (e.target as HTMLInputElement).checked })}
									/>
									Has value
								</label>
								{#if g.hasValue}
									<label>
										Value label
										<input
											type="text"
											value={g.valueLabel ?? 'Value'}
											oninput={(e) => updateGroupConfig(gi, { valueLabel: (e.target as HTMLInputElement).value })}
										/>
									</label>
								{/if}
							</div>
						</div>
					{/each}
					<button class="add-group-btn" onclick={addGroupConfig}>+ Add group</button>
				</div>
			</fieldset>
		{/if}

		<div class="form-row">
			<label>
				MiniZinc Code
				{#if scope === 'global'}
					<span class="hint">
						Write bare constraints (e.g. <code>constraint ...</code>).
						Variables: <code>digits</code>, <code>values</code>, <code>shaded</code>,
						<code>rows</code>, <code>cols</code>, <code>region</code>, <code>position</code>.
						<em>Note:</em> <code>values[r,c] = digits[r,c]</code> when the Modifiers
						solution space is off; when on, <code>values</code> has its own domain and rules
						constrain how it relates to <code>digits</code>.
					</span>
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
			<button class="btn" onclick={downloadAsLibraryRule}
				title="Download as a library rule folder (zipped): unzip into src/lib/rules/library/">
				Download as library rule
			</button>
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

	.imports-details {
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 6px 10px;
	}

	.imports-details summary {
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		color: #555;
		user-select: none;
	}

	.import-count {
		font-weight: 400;
		color: #888;
		font-size: 12px;
	}

	.imports-hint {
		margin: 6px 0 8px;
	}

	.imports-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
	}

	.imports-list .checkbox code {
		background: #f0f0f0;
		padding: 1px 4px;
		border-radius: 2px;
		font-size: 11px;
	}

	.template-controls {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.template-controls select {
		flex: 1;
	}

	.template-controls .btn {
		padding: 4px 10px;
		font-size: 12px;
	}

	.group-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-card {
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		padding: 6px 8px;
		background: #fafafa;
	}

	.group-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 12px;
		font-weight: 500;
		color: #555;
		margin-bottom: 6px;
	}

	.group-card-header .remove-btn {
		background: none;
		border: none;
		color: #999;
		cursor: pointer;
		font-size: 16px;
		padding: 0 4px;
	}

	.group-card-header .remove-btn:hover {
		color: #c62828;
	}

	.group-card-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 12px;
	}

	.group-card-fields label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
		color: #666;
	}

	.add-group-btn {
		padding: 4px 10px;
		border: 1px dashed #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		color: #666;
		align-self: flex-start;
	}

	.add-group-btn:hover {
		background: #f5f5f5;
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
