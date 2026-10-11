<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { VAR_COLOR_PALETTE } from '$lib/model/defaults';
	import type { VarKind, VariableInstance } from '$lib/model/types';

	const presetModules = import.meta.glob('$lib/presets/*.json', {
		eager: true,
		import: 'default',
	}) as Record<string, unknown>;

	const presets = Object.entries(presetModules)
		.map(([path, data]) => {
			const filename = path.split('/').pop() ?? path;
			const label = filename.replace(/\.json$/, '').replace(/_/g, ' ');
			return { label, data };
		})
		.sort((a, b) => a.label.localeCompare(b.label));

	function loadPreset(data: unknown) {
		puzzleStore.importJSON(JSON.stringify(data));
	}

	let rowsInput = $state(puzzleStore.rows);
	let colsInput = $state(puzzleStore.cols);
	/** Which variable's inline color palette is open */
	let colorPickerFor = $state<string | null>(null);

	function applyDimensions() {
		if (rowsInput >= 1 && rowsInput <= 30 && colsInput >= 1 && colsInput <= 30) {
			puzzleStore.setDimensions(rowsInput, colsInput);
		}
	}

	const KIND_INFO: Record<VarKind, { label: string; hint: string }> = {
		number: { label: 'Numbers', hint: 'a number in each cell (e.g. 1–9 for sudoku)' },
		boolean: { label: 'Boolean', hint: 'each cell is on or off (shading, object placement)' },
		border: { label: 'Borders', hint: 'edges between cells on/off (e.g. Slitherlink)' },
		line: { label: 'Lines', hint: 'edges carry a count (e.g. Hashiwokakero, paths)' }
	};

	function renderOptions(v: VariableInstance): { value: string; label: string }[] {
		switch (v.kind) {
			case 'number':
				return [
					{ value: 'digits', label: 'Digits' },
					{ value: 'objects', label: 'Objects (emoji)' },
					{ value: 'invisible', label: 'Invisible' }
				];
			case 'boolean':
				return [
					{ value: 'shading', label: 'Shading' },
					{ value: 'objects', label: 'Object (emoji)' },
					{ value: 'invisible', label: 'Invisible' }
				];
			default:
				return [
					{ value: 'lines', label: 'Lines' },
					{ value: 'invisible', label: 'Invisible' }
				];
		}
	}

	function update(v: VariableInstance, patch: Partial<VariableInstance>) {
		puzzleStore.updateVariable(v.id, patch);
	}

	function removeVariable(v: VariableInstance) {
		const boundApps = puzzleStore.puzzle.manualGlobalRules.filter((a) => a.bindings.includes(v.id)).length;
		const boundLocal = puzzleStore.puzzle.localRules.filter((i) => i.bindings.includes(v.id)).length;
		const extra = boundApps + boundLocal > 0
			? ` ${boundApps + boundLocal} rule(s) bound to it will also be removed.`
			: '';
		if (confirm(`Remove variable "${v.name}" and all its values?${extra}`)) {
			puzzleStore.removeVariable(v.id);
		}
	}

	function emojiString(v: VariableInstance): string {
		return (v.emojis ?? []).join(' ');
	}

	function setEmojis(v: VariableInstance, raw: string) {
		// Split on whitespace; falls back to splitting into grapheme-ish chunks when unspaced
		const parts = raw.trim().length === 0 ? [] : raw.trim().split(/\s+/);
		update(v, { emojis: parts });
	}

	function domainSize(v: VariableInstance): number {
		return (v.max ?? 9) - (v.min ?? 1) + 1;
	}
</script>

<div class="panel">
	<!-- App intro card -->
	<div class="intro-card">
		<p class="intro-title">Build &amp; verify logic puzzles</p>
		<ol class="intro-steps">
			<li><strong>Setup</strong> — choose grid size and variables</li>
			<li><strong>Regions</strong> — group cells for box/region rules</li>
			<li><strong>Design</strong> — enter given clues and add rules</li>
			<li><strong>Solve</strong> — let the solver verify your puzzle</li>
		</ol>
		<p class="intro-note">💡 Start with a preset below, or configure from scratch.</p>
	</div>

	{#if presets.length > 0}
		<h3>Presets</h3>
		<div class="presets">
			{#each presets as preset}
				<button class="btn preset-btn" onclick={() => loadPreset(preset.data)}>
					{preset.label}
				</button>
			{/each}
		</div>
	{/if}

	<h3>Grid Size</h3>
	<div class="row">
		<label>
			Rows
			<input type="number" bind:value={rowsInput} min="1" max="30" />
		</label>
		<label>
			Columns
			<input type="number" bind:value={colsInput} min="1" max="30" />
		</label>
		<button class="btn" onclick={applyDimensions}>Apply</button>
	</div>

	<h3>Variables
		<span class="section-tip" title="Each variable is one thing the solver decides per cell (or per edge). You can add several of the same kind — e.g. shading plus a star placement, or two colors of line.">ⓘ</span>
	</h3>
	<p class="section-hint">What should the solver decide? Add one entry per independent layer of the puzzle.</p>

	<div class="var-list">
		{#each puzzleStore.puzzle.variables as v (v.id)}
			<div class="var-card">
				<div class="var-header">
					<span class="kind-badge kind-{v.kind}" title={KIND_INFO[v.kind].hint}>{KIND_INFO[v.kind].label}</span>
					<input
						class="var-name"
						type="text"
						value={v.name}
						onchange={(e) => update(v, { name: (e.target as HTMLInputElement).value })}
					/>
					<button class="icon-btn" title="Move up" onclick={() => puzzleStore.moveVariable(v.id, -1)}>▲</button>
					<button class="icon-btn" title="Move down" onclick={() => puzzleStore.moveVariable(v.id, 1)}>▼</button>
					<button class="icon-btn remove" title="Remove variable" onclick={() => removeVariable(v)}>×</button>
				</div>

				<div class="var-body">
					{#if v.kind === 'number'}
						<label class="inline">
							Min
							<input
								type="number"
								value={v.min ?? 1}
								onchange={(e) => update(v, { min: parseInt((e.target as HTMLInputElement).value) })}
							/>
						</label>
						<label class="inline">
							Max
							<input
								type="number"
								value={v.max ?? 9}
								onchange={(e) => update(v, { max: parseInt((e.target as HTMLInputElement).value) })}
							/>
						</label>
					{/if}
					{#if v.kind === 'line'}
						<label class="inline">
							Max per pair
							<input
								type="number"
								min="1"
								max="9"
								value={v.maxLinesPerPair ?? 1}
								onchange={(e) => update(v, { maxLinesPerPair: Math.max(1, parseInt((e.target as HTMLInputElement).value)) })}
							/>
						</label>
					{/if}

					<label class="inline">
						Render
						<select
							value={v.render}
							onchange={(e) => update(v, { render: (e.target as HTMLSelectElement).value as VariableInstance['render'] })}
						>
							{#each renderOptions(v) as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</label>

					{#if v.render === 'shading' || (v.render === 'lines' && (v.kind === 'border' || v.kind === 'line'))}
						<div class="inline">
							<span class="inline-label">Color</span>
							<button
								class="color-swatch"
								title="Pick a color"
								style="background: {v.color ?? (v.kind === 'boolean' ? '#646464' : '#3b82f6')}"
								onclick={() => { colorPickerFor = colorPickerFor === v.id ? null : v.id; }}
								aria-label="Pick color for {v.name}"
							></button>
						</div>
					{/if}

					{#if v.render === 'objects'}
						<label class="inline emoji-label" title={v.kind === 'number'
							? `One emoji per value, space-separated (${domainSize(v)} needed, min first)`
							: 'The emoji shown when this cell is on'}>
							Emoji
							<input
								type="text"
								class="emoji-input"
								value={emojiString(v)}
								placeholder={v.kind === 'number' ? '🐮 🐔 🐑 …' : '⭐'}
								onchange={(e) => setEmojis(v, (e.target as HTMLInputElement).value)}
							/>
						</label>
					{/if}
				</div>

				{#if colorPickerFor === v.id}
					<!-- Inline palette (in normal flow, so it can never render off-screen) -->
					<div class="palette-row">
						{#each VAR_COLOR_PALETTE as c}
							<button
								class="palette-swatch"
								class:picked={v.color === c}
								style="background: {c}"
								aria-label="Set color {c}"
								onclick={() => { update(v, { color: c }); colorPickerFor = null; }}
							></button>
						{/each}
						<label class="palette-custom" title="Custom color">
							<input
								type="color"
								value={v.color ?? '#3b82f6'}
								onchange={(e) => { update(v, { color: (e.target as HTMLInputElement).value }); colorPickerFor = null; }}
							/>
							✎
						</label>
					</div>
				{/if}

				<div class="var-footer">
					<label class="constant-row" title="Constant: the solver may not change this variable. All cells you did not mark as given are fixed to the default value below.">
						<input
							type="checkbox"
							checked={v.constant === true}
							onchange={() => update(v, { constant: !v.constant })}
						/>
						Constant (givens only)
					</label>
					{#if v.constant}
						{#if v.kind === 'number' || v.kind === 'line'}
							<label class="inline">
								Default
								<input
									type="number"
									value={typeof v.defaultValue === 'number' ? v.defaultValue : (v.kind === 'line' ? 0 : v.min ?? 1)}
									onchange={(e) => update(v, { defaultValue: parseInt((e.target as HTMLInputElement).value) })}
								/>
							</label>
						{:else}
							<label class="inline">
								Default
								<select
									value={v.defaultValue === true ? 'true' : 'false'}
									onchange={(e) => update(v, { defaultValue: (e.target as HTMLSelectElement).value === 'true' })}
								>
									<option value="false">off / unshaded</option>
									<option value="true">on / shaded</option>
								</select>
							</label>
						{/if}
					{/if}
				</div>
			</div>
		{/each}

		{#if puzzleStore.puzzle.variables.length === 0}
			<p class="empty">No variables yet — add at least one to proceed.</p>
		{/if}
	</div>

	<div class="add-row">
		{#each Object.entries(KIND_INFO) as [kind, info]}
			<button
				class="btn add-btn"
				title={info.hint}
				onclick={() => puzzleStore.addVariable(kind as VarKind)}
			>+ {info.label}</button>
		{/each}
	</div>
</div>

<style>
	.panel {
		padding: 12px;
	}

	/* ── Intro card ── */
	.intro-card {
		background: #f0f4ff;
		border: 1px solid #c7d7f7;
		border-radius: 6px;
		padding: 10px 12px;
		margin-bottom: 14px;
	}

	.intro-title {
		margin: 0 0 6px;
		font-size: 13px;
		font-weight: 600;
		color: #2c4a8c;
	}

	.intro-steps {
		margin: 0 0 6px;
		padding-left: 18px;
		font-size: 12px;
		color: #444;
		line-height: 1.7;
	}

	.intro-note {
		margin: 0;
		font-size: 11px;
		color: #666;
	}

	/* ── Section headers ── */
	h3 {
		margin: 14px 0 4px;
		font-size: 12px;
		font-weight: 700;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	h3:first-of-type {
		margin-top: 0;
	}

	.section-tip {
		font-size: 12px;
		color: #999;
		cursor: help;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
	}

	.section-hint {
		font-size: 11px;
		color: #888;
		margin: 0 0 6px;
	}

	/* ── Rows / labels ── */
	.row {
		display: flex;
		gap: 8px;
		align-items: end;
	}

	label {
		display: flex;
		flex-direction: column;
		font-size: 12px;
		color: #666;
		gap: 2px;
	}

	input[type='number'] {
		width: 60px;
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 13px;
	}

	/* ── Variable cards ── */
	.var-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.var-card {
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 8px;
		background: #fafafa;
	}

	.var-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
	}

	.kind-badge {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 3px;
		flex-shrink: 0;
		cursor: help;
	}

	.kind-number  { background: #e3f2fd; color: #1565c0; }
	.kind-boolean { background: #efebe9; color: #4e342e; }
	.kind-border  { background: #e8f5e9; color: #2e7d32; }
	.kind-line    { background: #fff3e0; color: #e65100; }

	.var-name {
		flex: 1;
		min-width: 0;
		padding: 3px 6px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 13px;
		font-weight: 500;
	}

	.icon-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 10px;
		color: #999;
		padding: 2px 3px;
	}

	.icon-btn:hover { color: #333; }
	.icon-btn.remove { font-size: 15px; }
	.icon-btn.remove:hover { color: #e53935; }

	.var-body {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: flex-end;
	}

	.inline {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 11px;
	}

	.inline select {
		padding: 3px 4px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 12px;
	}

	.inline input[type='color'] {
		width: 40px;
		height: 26px;
		padding: 1px;
		border: 1px solid #ccc;
		border-radius: 3px;
		cursor: pointer;
	}

	.emoji-input {
		width: 130px;
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 13px;
	}

	.var-footer {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 6px;
	}

	.constant-row {
		flex-direction: row;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: #666;
		cursor: pointer;
	}

	.empty {
		font-size: 12px;
		color: #999;
		font-style: italic;
	}

	/* ── Add row ── */
	.add-row {
		display: flex;
		gap: 6px;
		margin-top: 8px;
		flex-wrap: wrap;
	}

	/* ── Color picker ── */
	.inline-label {
		font-size: 11px;
		color: #666;
	}

	.color-swatch {
		width: 34px;
		height: 24px;
		border: 1px solid #bbb;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;
	}

	.palette-row {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		align-items: center;
		margin-top: 6px;
		padding: 6px;
		background: #f0f0f0;
		border-radius: 4px;
	}

	.palette-swatch {
		width: 22px;
		height: 22px;
		border: 1px solid rgba(0, 0, 0, 0.25);
		border-radius: 4px;
		cursor: pointer;
		padding: 0;
	}

	.palette-swatch.picked {
		outline: 2px solid #333;
		outline-offset: 1px;
	}

	.palette-custom {
		display: inline-flex;
		align-items: center;
		font-size: 13px;
		color: #555;
		cursor: pointer;
		position: relative;
	}

	.palette-custom input[type='color'] {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1px solid #bbb;
		border-radius: 4px;
		cursor: pointer;
		margin-right: 2px;
	}

	/* ── Buttons ── */
	.btn {
		padding: 4px 12px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn:hover {
		background: #eee;
	}

	.add-btn {
		background: #e8f5e9;
		border-color: #4caf50;
		color: #2e7d32;
		flex-shrink: 0;
	}

	.add-btn:hover {
		background: #c8e6c9;
	}

	.presets {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 4px;
	}

	.preset-btn {
		text-align: left;
		padding: 6px 10px;
	}
</style>
