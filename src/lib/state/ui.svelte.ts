import type { AppMode, ActiveTool, SidebarTab, CustomRuleDefinition } from '$lib/model/types';

class UIStore {
	mode = $state<AppMode>('grid-setup');
	activeTool = $state<ActiveTool>('number');
	sidebarTab = $state<SidebarTab>('setup');
	selectedRuleInstanceId = $state<string | null>(null);
	selectedGroupIndex = $state<number>(0);
	customRuleEditorOpen = $state(false);
	customRuleEditing = $state<CustomRuleDefinition | null>(null);
	favoriteRules = $state<Set<string>>(new Set());
	/** One-shot: when set, the value input for this (instanceId, groupIndex=0) autofocuses on render */
	pendingValueFocus = $state<string | null>(null);

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

	setActiveTool(tool: ActiveTool): void {
		this.activeTool = tool;
	}

	selectRuleInstance(instanceId: string | null, groupIndex: number = 0): void {
		this.selectedRuleInstanceId = instanceId;
		this.selectedGroupIndex = groupIndex;
	}

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
	autoFavoriteUsedRules(globalRules: string[], localRules: { ruleId: string }[]): void {
		const next = new Set(this.favoriteRules);
		for (const id of globalRules) next.add(id);
		for (const inst of localRules) next.add(inst.ruleId);
		this.favoriteRules = next;
	}
}

export const ui = new UIStore();
