import type { AppMode, SidebarTab, CustomRuleDefinition } from '$lib/model/types';

class UIStore {
	mode = $state<AppMode>('quickstart');
	/** The variable instance the grid tools currently edit (null = none available) */
	activeVarId = $state<string | null>(null);
	sidebarTab = $state<SidebarTab>('setup');
	selectedRuleInstanceId = $state<string | null>(null);
	selectedGroupIndex = $state<number>(0);
	/** Selected manual global rule application (by key) — shows its detail panel */
	selectedGlobalRuleKey = $state<string | null>(null);
	/** Selected active ruleset (by id) — shows its detail panel */
	selectedRulesetId = $state<string | null>(null);
	customRuleEditorOpen = $state(false);
	customRuleEditing = $state<CustomRuleDefinition | null>(null);
	ruleBrowserOpen = $state(false);
	favoriteRules = $state<Set<string>>(new Set());
	/** One-shot: when set, the value input for this (instanceId, groupIndex=0) autofocuses on render */
	pendingValueFocus = $state<string | null>(null);
	/** Tracks in-progress number-key typing for a group value field (used by handleKeyDown). */
	groupValueBuffer = $state<{ instanceId: string; groupIndex: number; str: string; ts: number } | null>(null);
	/** Whether the region editor is in "draw edges" sub-mode vs the default "paint" mode */
	regionDrawEdges = $state(false);

	setMode(mode: AppMode): void {
		this.mode = mode;
		if (mode === 'grid-setup') {
			this.sidebarTab = 'setup';
		} else if (mode === 'setting') {
			this.sidebarTab = 'rules';
		} else if (mode === 'solving') {
			this.sidebarTab = 'solver';
		}
	}

	setActiveVar(varId: string | null): void {
		this.activeVarId = varId;
	}

	selectRuleInstance(instanceId: string | null, groupIndex: number = 0): void {
		this.selectedRuleInstanceId = instanceId;
		this.selectedGroupIndex = groupIndex;
		this.selectedGlobalRuleKey = null;
		this.selectedRulesetId = null;
	}

	selectGlobalRule(key: string | null): void {
		this.selectedGlobalRuleKey = key;
		this.selectedRuleInstanceId = null;
		this.selectedRulesetId = null;
	}

	selectRuleset(rulesetId: string | null): void {
		this.selectedRulesetId = rulesetId;
		this.selectedRuleInstanceId = null;
		this.selectedGlobalRuleKey = null;
	}

	clearRuleSelection(): void {
		this.selectedRuleInstanceId = null;
		this.selectedGlobalRuleKey = null;
		this.selectedRulesetId = null;
	}

	openRuleBrowser(): void { this.ruleBrowserOpen = true; }
	closeRuleBrowser(): void { this.ruleBrowserOpen = false; }

	openCustomRuleEditor(rule: CustomRuleDefinition | null = null): void {
		this.customRuleEditing = rule;
		this.customRuleEditorOpen = true;
	}

	closeCustomRuleEditor(): void {
		this.customRuleEditorOpen = false;
		this.customRuleEditing = null;
	}

	toggleFavoriteRule(ruleId: string): void {
		const next = new Set(this.favoriteRules);
		if (next.has(ruleId)) {
			next.delete(ruleId);
		} else {
			next.add(ruleId);
		}
		this.favoriteRules = next;
	}

	/** Auto-favorite all rules used by the current puzzle */
	autoFavoriteUsedRules(globalRuleIds: string[], localRules: { ruleId: string }[]): void {
		const next = new Set(this.favoriteRules);
		for (const id of globalRuleIds) next.add(id);
		for (const inst of localRules) next.add(inst.ruleId);
		this.favoriteRules = next;
	}
}

export const ui = new UIStore();
