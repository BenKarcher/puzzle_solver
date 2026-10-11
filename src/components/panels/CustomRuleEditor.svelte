<script lang="ts">
	import { nanoid } from 'nanoid';
	import JSZip from 'jszip';
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { getAllLoadedRules, getAvailableImports } from '$lib/rules/registry';
	import type { CustomRuleDefinition, RequiredSpace, RuleGroupConfig, WholeGridSpace } from '$lib/model/types';

	interface Props {
		editingRule?: CustomRuleDefinition | null;
		onclose: () => void;
	}

	let { editingRule = null, onclose }: Props = $props();

	// Capture initial values from the prop (this modal is created/destroyed, not reused)
	// svelte-ignore state_referenced_locally
	const initial = editingRule;

	const BINDABLE: { space: WholeGridSpace; label: string }[] = [
		{ space: 'digits', label: 'Numbers' },
		{ space: 'shading', label: 'Boolean' },
		{ space: 'borders', label: 'Borders' },
		{ space: 'lines', label: 'Lines' }
	];

	function isBindable(s: string): s is WholeGridSpace {
		return s === 'digits' || s === 'shading' || s === 'borders' || s === 'lines';
	}

	function bindableLabel(s: WholeGridSpace): string {
		return BINDABLE.find((b) => b.space === s)?.label ?? s;
	}

	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let categoriesText = $state((initial?.categories ?? []).join(', '));
	let scope = $state<'global' | 'local'>(initial?.scope ?? 'global');
	let mzn = $state(initial?.mzn ?? '');
	/**
	 * Ordered bindable variable occurrences (duplicates allowed — e.g. two Boolean
	 * entries = the rule receives two independently bound boolean layers).
	 */
	let reqSpacesList = $state<WholeGridSpace[]>(
		initial ? initial.requiredSpaces.filter(isBindable) : ['digits']
	);
	let reqRegions = $state(initial?.requiredSpaces.includes('regions') ?? false);
	let reqPositions = $state(initial?.requiredSpaces.includes('positions') ?? false);
	let reqCoordinates = $state(initial?.requiredSpaces.includes('coordinates') ?? false);
	/** Whole-grid args (local rules): entire arrays passed before the group args, in order. Duplicates allowed. */
	let wholeGridsList = $state<WholeGridSpace[]>([...(initial?.wholeGrids ?? [])]);

	function addReqSpace(s: WholeGridSpace) {
		reqSpacesList = [...reqSpacesList, s];
	}

	function removeReqSpace(i: number) {
		reqSpacesList = reqSpacesList.filter((_, idx) => idx !== i);
	}

	function addWholeGrid(s: WholeGridSpace) {
		wholeGridsList = [...wholeGridsList, s];
	}

	function removeWholeGrid(i: number) {
		wholeGridsList = wholeGridsList.filter((_, idx) => idx !== i);
	}

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
		reqSpacesList = c.requiredSpaces.filter(isBindable);
		reqRegions = c.requiredSpaces.includes('regions');
		reqPositions = c.requiredSpaces.includes('positions');
		reqCoordinates = c.requiredSpaces.includes('coordinates');
		wholeGridsList = [...(c.wholeGrids ?? [])];
		groupConfigs = c.groups?.length
			? c.groups.map((g) => ({ ...g }))
			: [{ minSize: 1, maxSize: null, hasValue: false }];
		selectedImports = new Set(c.imports ?? []);
		selectedTemplate = '';
	}

	const predicateName = $derived(
		name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'my_constraint'
	);

	/** Suffix repeated occurrences of the same kind: digits, digits2, digits3… */
	function makeOccNamer(): (base: string) => string {
		const counts = new Map<string, number>();
		return (base) => {
			const n = (counts.get(base) ?? 0) + 1;
			counts.set(base, n);
			return n === 1 ? base : `${base}${n}`;
		};
	}

	const predicateSignature = $derived.by(() => {
		const args: string[] = [];

		if (scope === 'global') {
			// Global rules are predicates over whole arrays, one arg set per occurrence
			// (in list order — repeated kinds arrive as separately bound variables)
			const occ = makeOccNamer();
			for (const s of reqSpacesList) {
				if (s === 'digits') args.push(`array[int,int] of var int: ${occ('digits')}`);
				else if (s === 'shading') args.push(`array[int,int] of var bool: ${occ('shaded')}`);
				else if (s === 'borders') args.push(`array[int,int] of var bool: ${occ('border_h')}`, `array[int,int] of var bool: ${occ('border_v')}`);
				else args.push(`array[int,int] of var int: ${occ('line_h')}`, `array[int,int] of var int: ${occ('line_v')}`);
			}
			return `predicate ${predicateName}(${args.join(', ')})`;
		}

		// Local rules: whole-grid args first...
		{
			const occ = makeOccNamer();
			for (const s of wholeGridsList) {
				if (s === 'digits') args.push(`array[int,int] of var int: ${occ('grid_digits')}`);
				else if (s === 'shading') args.push(`array[int,int] of var bool: ${occ('grid_shaded')}`);
				else if (s === 'borders') args.push(`array[int,int] of var bool: ${occ('grid_border_h')}`, `array[int,int] of var bool: ${occ('grid_border_v')}`);
				else args.push(`array[int,int] of var int: ${occ('grid_line_h')}`, `array[int,int] of var int: ${occ('grid_line_v')}`);
			}
		}

		// ...then per-group args: [coordinates?] then one cell-ref array per occurrence
		const multi = groupConfigs.length > 1;
		for (let i = 0; i < groupConfigs.length; i++) {
			const g = groupConfigs[i];
			const suffix = multi ? `_${i + 1}` : '';
			const isCellless = g.maxSize === 0;
			if (!isCellless) {
				const occ = makeOccNamer();
				if (reqCoordinates) args.push(`array[int] of int: rs${suffix}`, `array[int] of int: cs${suffix}`);
				for (const s of reqSpacesList) {
					if (s === 'digits') args.push(`array[int] of var int: ${occ('digits')}${suffix}`);
					else if (s === 'shading') args.push(`array[int] of var bool: ${occ('shaded')}${suffix}`);
					else if (s === 'borders') args.push(`array[int, 1..4] of var bool: ${occ('borders')}${suffix}`);
					else args.push(`array[int, 1..4] of var int: ${occ('lines')}${suffix}`);
				}
			}
			if (g.hasValue) {
				const label = (g.valueLabel ?? 'value').toLowerCase().replace(/\s+/g, '_') || 'value';
				args.push(`int: ${label}${suffix}`);
			}
		}
		return `predicate ${predicateName}(${args.join(', ')})`;
	});

	function buildRequiredSpaces(): RequiredSpace[] {
		const spaces: RequiredSpace[] = [...reqSpacesList];
		if (reqRegions) spaces.push('regions');
		if (reqPositions) spaces.push('positions');
		if (reqCoordinates && scope === 'local') spaces.push('coordinates');
		return spaces;
	}

	function buildWholeGrids(): WholeGridSpace[] | undefined {
		if (scope !== 'local') return undefined;
		return wholeGridsList.length > 0 ? [...wholeGridsList] : undefined;
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
			wholeGrids: buildWholeGrids(),
			groups: scope === 'local'
				? groupConfigs.map((g) => ({
						minSize: g.minSize,
						maxSize: g.maxSize,
						hasValue: g.hasValue,
						valueLabel: g.hasValue ? (g.valueLabel ?? 'Value') : undefined,
					}))
				: undefined,
			// Global rules are predicates too now — the compiler calls them with the bound arrays
			predicateName,
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
		const wg = buildWholeGrids();
		if (wg) config.wholeGrids = wg;
		if (scope === 'local') {
			config.groups = groupConfigs.map((g) => ({
				minSize: g.minSize,
				maxSize: g.maxSize,
				hasValue: g.hasValue,
				...(g.hasValue ? { valueLabel: g.valueLabel ?? 'Value' } : {}),
			}));
		}
		config.predicateName = predicateName;
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
			<legend>Variable Arguments</legend>
			<p class="hint fieldset-hint">
				{#if scope === 'global'}
					Each entry is one variable the rule receives as a whole array, in order.
					Add the same kind twice to get two independently bound layers (e.g. walls + lights) —
					the user picks which puzzle variable fills each slot when adding the rule.
				{:else}
					Each entry adds one array of the selected cells' values per group, in order.
					Add the same kind twice to receive two independently bound layers.
				{/if}
			</p>
			<div class="occ-list">
				{#each reqSpacesList as s, i}
					<span class="occ-chip">
						{bindableLabel(s)}
						<button class="chip-remove" title="Remove" onclick={() => removeReqSpace(i)}>×</button>
					</span>
				{/each}
				{#if reqSpacesList.length === 0}
					<span class="hint">none</span>
				{/if}
			</div>
			<div class="occ-add-row">
				{#each BINDABLE as b}
					<button class="chip-add" onclick={() => addReqSpace(b.space)}>+ {b.label}</button>
				{/each}
			</div>
		</fieldset>

		{#if scope === 'local'}
			<fieldset class="form-row">
				<legend>Whole-Grid Arguments</legend>
				<p class="hint fieldset-hint">
					The entire bound array(s), passed before the group args — for neighbor-aware rules
					that look outside the selected cells. Duplicates allowed here too.
				</p>
				<div class="occ-list">
					{#each wholeGridsList as s, i}
						<span class="occ-chip">
							{bindableLabel(s)} grid
							<button class="chip-remove" title="Remove" onclick={() => removeWholeGrid(i)}>×</button>
						</span>
					{/each}
					{#if wholeGridsList.length === 0}
						<span class="hint">none</span>
					{/if}
				</div>
				<div class="occ-add-row">
					{#each BINDABLE as b}
						<button class="chip-add" onclick={() => addWholeGrid(b.space)}>+ {b.label}</button>
					{/each}
				</div>
			</fieldset>
		{/if}

		<fieldset class="form-row">
			<legend>Grid Data</legend>
			<label class="checkbox" title="Emits the region-id array; reference region[r,c] directly in the body">
				<input type="checkbox" bind:checked={reqRegions} /> Regions
			</label>
			<label class="checkbox" title="Emits the per-region position array; reference position[r,c] directly in the body">
				<input type="checkbox" bind:checked={reqPositions} /> Positions
			</label>
			{#if scope === 'local'}
				<label class="checkbox" title="Each group also receives 1-indexed row/col coordinate arrays for its cells (rs, cs)">
					<input type="checkbox" bind:checked={reqCoordinates} /> Coordinates
				</label>
			{/if}
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
						Define a predicate with this signature (parameter names are yours to choose —
						only the order matters, matching the Variable Arguments list above).
						The compiler calls it once per application with the bound variable arrays,
						so the same rule can be applied several times to different variables.
						Globals <code>rows</code>, <code>cols</code>, <code>region</code>, <code>position</code>
						can be referenced directly inside the body; helper variables go in a
						<code>let &lbrace;...&rbrace; in</code> block.
					</span>
					<code class="signature">{predicateSignature}</code>
				{:else}
					<span class="hint">
						Define a predicate with this signature (parameter names are yours to choose —
						only the order matters): whole-grid args first, then per group its coordinate
						arrays, cell-value arrays, and value.
					</span>
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

	.fieldset-hint {
		margin: 2px 0 8px;
	}

	.occ-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 8px;
		min-height: 24px;
		align-items: center;
	}

	.occ-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 6px 3px 10px;
		background: #e8f0fe;
		border: 1px solid #aecbfa;
		border-radius: 12px;
		font-size: 12px;
		color: #1a56b0;
	}

	.chip-remove {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 14px;
		color: #7a9cd4;
		padding: 0 2px;
		line-height: 1;
	}

	.chip-remove:hover { color: #c62828; }

	.occ-add-row {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.chip-add {
		padding: 3px 9px;
		border: 1px dashed #aaa;
		background: white;
		border-radius: 12px;
		cursor: pointer;
		font-size: 12px;
		color: #555;
	}

	.chip-add:hover {
		background: #f0f7f0;
		border-color: #4caf50;
		color: #2e7d32;
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
