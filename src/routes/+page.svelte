<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '../components/TopBar.svelte';
	import Toolbar from '../components/Toolbar.svelte';
	import GridCanvas from '../components/GridCanvas.svelte';
	import Sidebar from '../components/Sidebar.svelte';
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { getAllRuleConfigs, getRuleRenderers } from '$lib/rules/registry';
	import type { RuleConfig, RenderFn } from '$lib/model/types';

	const ruleConfigs: RuleConfig[] = getAllRuleConfigs();
	const ruleRenderers: Map<string, RenderFn> = getRuleRenderers();

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
