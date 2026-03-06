import type { AppMode, ActiveTool, SidebarTab } from '$lib/model/types';

class UIStore {
	mode = $state<AppMode>('grid-setup');
	activeTool = $state<ActiveTool>('number');
	sidebarTab = $state<SidebarTab>('setup');
	selectedRuleInstanceId = $state<string | null>(null);
	selectedGroupIndex = $state<number>(0);

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
}

export const ui = new UIStore();
