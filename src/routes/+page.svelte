<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '../components/TopBar.svelte';
	import Toolbar from '../components/Toolbar.svelte';
	import GridCanvas from '../components/GridCanvas.svelte';
	import Sidebar from '../components/Sidebar.svelte';
	import CustomRuleEditor from '../components/panels/CustomRuleEditor.svelte';
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { getAllRuleConfigs, getRuleRenderers, syncCustomRules } from '$lib/rules/registry';
	import type { RenderFn } from '$lib/model/types';

	const ruleRenderers: Map<string, RenderFn> = getRuleRenderers();

	// Sync custom rules into the registry and derive configs in one step
	const ruleConfigs = $derived.by(() => {
		syncCustomRules(puzzleStore.puzzle.customRules);
		return getAllRuleConfigs();
	});

	onMount(() => {
		puzzleStore.newPuzzle(9, 9);
	});
</script>

<div class="app">
	<TopBar />
	<div class="main">
		<div class="editor">
			<Toolbar />
			<GridCanvas {ruleRenderers} />
		</div>
		<Sidebar {ruleConfigs} />
	</div>
</div>

{#if ui.customRuleEditorOpen}
	<CustomRuleEditor
		editingRule={ui.customRuleEditing}
		onclose={() => ui.closeCustomRuleEditor()}
	/>
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.main {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.editor {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
