<script lang="ts">
	import { puzzleStore, type QuickstartSpec, type QuickstartVariable } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { solverStore } from '$lib/solver/solver.svelte';
	import { getAllRulesets } from '$lib/rules/registry';
	import { boxHeightFor, boxWidthFor, rulesetDefaults, rulesetSlots, type RulesetSlot } from '$lib/rules/rulesets';
	import { kindLabel } from '$lib/model/variables';
	import type { RegionLayout, RulesetConfig } from '$lib/model/types';

	const allRulesets = getAllRulesets();

	interface SlotRef {
		uid: number;
		slotIdx: number;
	}

	interface SelectedRs {
		uid: number;
		rs: RulesetConfig;
		slots: RulesetSlot[];
		/** Per slot: merged into this other slot (null = own variable) */
		sameAs: (SlotRef | null)[];
	}

	let selected = $state<SelectedRs[]>([]);
	let nextUid = 1;

	// Grid settings — seeded from the first selected ruleset, editable
	let rows = $state(9);
	let cols = $state(9);
	let regionLayout = $state<RegionLayout>('none');
	let boxRows = $state(3);
	let boxCols = $state(3);

	/** Which slot's "same as" picker is open */
	let pickerFor = $state<SlotRef | null>(null);

	/** Re-derive box sizes from the grid size until the user edits them directly */
	let boxTouched = $state(false);
	$effect(() => {
		const r = rows;
		const c = cols;
		if (!boxTouched) {
			boxRows = boxHeightFor(Math.max(1, r));
			boxCols = boxWidthFor(Math.max(1, c));
		}
	});

	function byUid(uid: number): SelectedRs | undefined {
		return selected.find((s) => s.uid === uid);
	}

	function addRuleset(rs: RulesetConfig) {
		const slots = rulesetSlots(rs);
		if (selected.length === 0) {
			// The first selected ruleset seeds size and region layout
			const d = rulesetDefaults(rs);
			rows = d.rows;
			cols = d.cols;
			regionLayout = d.regions;
			boxTouched = rs.defaults?.boxRows !== undefined || rs.defaults?.boxCols !== undefined;
			boxRows = d.boxRows;
			boxCols = d.boxCols;
		}
		selected = [...selected, { uid: nextUid++, rs, slots, sameAs: slots.map(() => null) }];
	}

	function removeRuleset(uid: number) {
		selected = selected
			.filter((s) => s.uid !== uid)
			.map((s) => ({
				...s,
				sameAs: s.sameAs.map((ref) => (ref?.uid === uid ? null : ref))
			}));
		if (pickerFor?.uid === uid) pickerFor = null;
	}

	function isSelected(rsId: string): boolean {
		return selected.some((s) => s.rs.id === rsId);
	}

	/** Follow sameAs pointers to the canonical slot (cycle-safe) */
	function canonical(ref: SlotRef): SlotRef {
		const seen = new Set<string>();
		let cur = ref;
		for (;;) {
			const key = `${cur.uid}:${cur.slotIdx}`;
			if (seen.has(key)) return cur;
			seen.add(key);
			const next = byUid(cur.uid)?.sameAs[cur.slotIdx];
			if (!next) return cur;
			cur = next;
		}
	}

	function sameGroup(a: SlotRef, b: SlotRef): boolean {
		const ca = canonical(a);
		const cb = canonical(b);
		return ca.uid === cb.uid && ca.slotIdx === cb.slotIdx;
	}

	function slotAt(ref: SlotRef): RulesetSlot | undefined {
		return byUid(ref.uid)?.slots[ref.slotIdx];
	}

	function slotLabel(ref: SlotRef): string {
		const sel = byUid(ref.uid);
		const slot = slotAt(ref);
		return sel && slot ? `${sel.rs.name}: ${slot.name}` : '?';
	}

	/** Merge candidates: same-kind slots of OTHER selected rulesets, outside this slot's group */
	function mergeCandidates(ref: SlotRef): SlotRef[] {
		const slot = slotAt(ref);
		if (!slot) return [];
		const out: SlotRef[] = [];
		for (const sel of selected) {
			if (sel.uid === ref.uid) continue;
			for (let i = 0; i < sel.slots.length; i++) {
				const cand = { uid: sel.uid, slotIdx: i };
				if (sel.slots[i].kind !== slot.kind) continue;
				if (sameGroup(cand, ref)) continue;
				out.push(cand);
			}
		}
		return out;
	}

	/** Point this slot at the target's canonical slot — the target keeps its render settings */
	function mergeInto(ref: SlotRef, target: SlotRef) {
		const sel = byUid(ref.uid);
		if (!sel) return;
		sel.sameAs[ref.slotIdx] = canonical(target);
		selected = [...selected];
		pickerFor = null;
	}

	function unlink(ref: SlotRef) {
		const sel = byUid(ref.uid);
		if (!sel) return;
		sel.sameAs[ref.slotIdx] = null;
		selected = [...selected];
	}

	// ── Building the puzzle ───────────────────────────────────────────────────

	function variableFromSlot(slot: RulesetSlot): QuickstartVariable {
		const spec = slot.spec;
		return {
			kind: slot.kind,
			name: slot.name,
			render: spec?.render,
			color: spec?.color,
			emojis: spec?.emojis,
			constant: spec?.constant,
			defaultValue: spec?.defaultValue,
			min: spec?.min,
			max: spec?.max,
			maxLinesPerPair: spec?.maxLinesPerPair
		};
	}

	function buildSpec(): QuickstartSpec {
		const variables: QuickstartVariable[] = [];
		const varOwner: SelectedRs[] = [];
		const keyToIdx = new Map<string, number>();

		for (const sel of selected) {
			for (let i = 0; i < sel.slots.length; i++) {
				const c = canonical({ uid: sel.uid, slotIdx: i });
				const key = `${c.uid}:${c.slotIdx}`;
				if (!keyToIdx.has(key)) {
					const cSel = byUid(c.uid)!;
					keyToIdx.set(key, variables.length);
					variables.push(variableFromSlot(cSel.slots[c.slotIdx]));
					varOwner.push(cSel);
				}
			}
		}

		// Disambiguate duplicate names with the owning ruleset's name
		const nameCounts = new Map<string, number>();
		for (const v of variables) nameCounts.set(v.name, (nameCounts.get(v.name) ?? 0) + 1);
		for (let i = 0; i < variables.length; i++) {
			if ((nameCounts.get(variables[i].name) ?? 0) > 1) {
				variables[i] = { ...variables[i], name: `${varOwner[i].rs.name} ${variables[i].name}` };
			}
		}

		const activations = selected.map((sel) => ({
			rulesetId: sel.rs.id,
			varIndices: sel.slots.map((_, i) => {
				const c = canonical({ uid: sel.uid, slotIdx: i });
				return keyToIdx.get(`${c.uid}:${c.slotIdx}`) ?? 0;
			})
		}));

		return {
			rows,
			cols,
			regions: regionLayout,
			boxRows,
			boxCols,
			variables,
			activations
		};
	}

	function start(advanced: boolean) {
		if (selected.length > 0) {
			solverStore.clear();
			puzzleStore.applyQuickstart(buildSpec());
		}
		ui.setMode(advanced ? 'grid-setup' : 'setting');
	}

	function skip() {
		ui.setMode('grid-setup');
	}
</script>

<div class="quickstart">
	<div class="qs-inner">
		<h1>Start a new puzzle</h1>
		<p class="subtitle">
			Pick the genres your puzzle combines — variables, rules, and grid settings are set up for you.
			Combine several sets and use <em>same as</em> to share a variable between genres.
		</p>

		<div class="columns">
			<!-- Available rulesets -->
			<div class="col available">
				<h3>Rule Sets</h3>
				<div class="rs-list">
					{#each allRulesets as rs (rs.id)}
						{#if !isSelected(rs.id)}
							<div class="rs-card">
								<div class="rs-info">
									<span class="rs-name">{rs.name}</span>
									<span class="rs-desc">{rs.description}</span>
								</div>
								<button class="btn add" onclick={() => addRuleset(rs)}>Add</button>
							</div>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Selected rulesets + settings -->
			<div class="col chosen">
				<h3>Your Puzzle</h3>
				{#if selected.length === 0}
					<p class="empty">Nothing selected yet — add a rule set on the left, or skip below to configure everything by hand.</p>
				{/if}

				{#each selected as sel (sel.uid)}
					<div class="sel-card">
						<div class="sel-header">
							<span class="rs-name">{sel.rs.name}</span>
							<button class="remove-btn" title="Remove" onclick={() => removeRuleset(sel.uid)}>×</button>
						</div>
						<div class="slot-list">
							{#each sel.slots as slot, i}
								{@const ref = { uid: sel.uid, slotIdx: i }}
								{@const merged = sel.sameAs[i]}
								<div class="slot-row">
									<span class="kind-badge kind-{slot.kind}">{kindLabel(slot.kind)}</span>
									<span class="slot-name">{slot.name}</span>
									{#if merged}
										<span class="merged-info" title="This slot shares the variable of {slotLabel(canonical(ref))}">
											= {slotLabel(canonical(ref))}
										</span>
										<button class="link-btn" title="Give this slot its own variable again" onclick={() => unlink(ref)}>unlink</button>
									{:else if mergeCandidates(ref).length > 0}
										<button
											class="link-btn"
											title="Share a variable with another rule set's slot of the same kind"
											onclick={() => { pickerFor = pickerFor?.uid === sel.uid && pickerFor.slotIdx === i ? null : ref; }}
										>same as…</button>
									{/if}
								</div>
								{#if pickerFor?.uid === sel.uid && pickerFor.slotIdx === i}
									<div class="picker">
										{#each mergeCandidates(ref) as cand}
											<button class="picker-option" onclick={() => mergeInto(ref, cand)}>
												{slotLabel(cand)}
											</button>
										{/each}
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/each}

				{#if selected.length > 0}
					<p class="merge-tip">
						💡 <em>Same as</em> makes two slots share one identical variable. For more
						complex relations (e.g. "a cell is a star exactly where the other grid is even"),
						keep the variables separate and link them with a global rule or custom constraint
						in Design mode.
					</p>
					<div class="grid-settings">
						<h4>Grid</h4>
						<div class="settings-row">
							<label>
								Rows
								<input type="number" min="1" max="30" bind:value={rows} />
							</label>
							<label>
								Columns
								<input type="number" min="1" max="30" bind:value={cols} />
							</label>
							<label>
								Regions
								<select bind:value={regionLayout}>
									<option value="none">None</option>
									<option value="rectangular">Boxes</option>
									<option value="all">Each cell</option>
								</select>
							</label>
							{#if regionLayout === 'rectangular'}
								<label>
									Box rows
									<input type="number" min="1" max="30" bind:value={boxRows} oninput={() => { boxTouched = true; }} />
								</label>
								<label>
									Box cols
									<input type="number" min="1" max="30" bind:value={boxCols} oninput={() => { boxTouched = true; }} />
								</label>
							{/if}
						</div>
					</div>
				{/if}

				<div class="actions">
					<button class="btn primary" disabled={selected.length === 0} onclick={() => start(false)}>
						Start designing
					</button>
					<button class="btn" onclick={() => start(true)}>Advanced setup</button>
				</div>
				<button class="skip-link" onclick={skip}>Skip — start from a blank puzzle</button>
			</div>
		</div>
	</div>
</div>

<style>
	.quickstart {
		flex: 1;
		overflow-y: auto;
		background: #f7f8fa;
	}

	.qs-inner {
		max-width: 900px;
		margin: 0 auto;
		padding: 32px 24px;
	}

	h1 {
		margin: 0 0 6px;
		font-size: 24px;
		color: #222;
	}

	.subtitle {
		margin: 0 0 20px;
		font-size: 13px;
		color: #777;
	}

	.columns {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}

	.col {
		flex: 1;
		min-width: 0;
	}

	h3 {
		margin: 0 0 8px;
		font-size: 12px;
		font-weight: 700;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	h4 {
		margin: 0 0 6px;
		font-size: 11px;
		font-weight: 700;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* ── Available list ── */
	.rs-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 60vh;
		overflow-y: auto;
	}

	.rs-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
	}

	.rs-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.rs-name {
		font-size: 14px;
		font-weight: 600;
		color: #222;
	}

	.rs-desc {
		font-size: 11px;
		color: #888;
		line-height: 1.4;
	}

	/* ── Selected cards ── */
	.sel-card {
		background: white;
		border: 1px solid #ce93d8;
		border-radius: 6px;
		margin-bottom: 8px;
		overflow: hidden;
	}

	.sel-header {
		display: flex;
		align-items: center;
		padding: 8px 12px;
		background: #f3e5f5;
	}

	.sel-header .rs-name {
		flex: 1;
	}

	.remove-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: #999;
		padding: 0 4px;
	}

	.remove-btn:hover { color: #e53935; }

	.slot-list {
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.slot-row {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
	}

	.kind-badge {
		font-size: 10px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.kind-number  { background: #e3f2fd; color: #1565c0; }
	.kind-boolean { background: #efebe9; color: #4e342e; }
	.kind-border  { background: #e8f5e9; color: #2e7d32; }
	.kind-line    { background: #fff3e0; color: #e65100; }

	.slot-name {
		font-weight: 500;
		color: #333;
	}

	.merged-info {
		font-size: 11px;
		color: #7b1fa2;
		font-style: italic;
	}

	.link-btn {
		margin-left: auto;
		background: none;
		border: 1px solid #ccc;
		border-radius: 10px;
		padding: 1px 8px;
		cursor: pointer;
		font-size: 11px;
		color: #555;
	}

	.link-btn:hover {
		background: #f3e8fd;
		border-color: #9c36b5;
		color: #6a1b9a;
	}

	.picker {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin: 2px 0 4px 24px;
		padding: 6px;
		background: #faf5ff;
		border: 1px solid #d6bbf5;
		border-radius: 4px;
	}

	.picker-option {
		text-align: left;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 4px 8px;
		cursor: pointer;
		font-size: 12px;
	}

	.picker-option:hover {
		background: #ede1fb;
		border-color: #9c36b5;
	}

	/* ── Grid settings ── */
	.grid-settings {
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 10px 12px;
		margin: 12px 0;
	}

	.settings-row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.settings-row label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 11px;
		color: #666;
	}

	.settings-row input[type='number'] {
		width: 60px;
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 13px;
	}

	.settings-row select {
		padding: 4px 6px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 13px;
	}

	/* ── Actions ── */
	.actions {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.btn {
		padding: 8px 16px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 5px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn:hover:not(:disabled) { background: #eee; }
	.btn:disabled { opacity: 0.4; cursor: default; }

	.btn.add {
		padding: 4px 12px;
		background: #e8f5e9;
		border-color: #4caf50;
		color: #2e7d32;
		flex-shrink: 0;
	}

	.btn.add:hover { background: #c8e6c9; }

	.btn.primary {
		background: #4287f5;
		border-color: #4287f5;
		color: white;
		font-weight: 600;
	}

	.btn.primary:hover:not(:disabled) { background: #3070d0; }

	.skip-link {
		background: none;
		border: none;
		color: #888;
		font-size: 12px;
		cursor: pointer;
		padding: 0;
		margin-top: 10px;
		text-decoration: underline;
	}

	.skip-link:hover { color: #4287f5; }

	.empty {
		font-size: 12px;
		color: #999;
		font-style: italic;
	}

	.merge-tip {
		margin: 8px 0 0;
		padding: 7px 10px;
		background: #fff8e1;
		border: 1px solid #ffe082;
		border-radius: 4px;
		font-size: 11px;
		color: #7a5c00;
		line-height: 1.5;
	}
</style>
