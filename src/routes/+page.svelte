<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '../components/TopBar.svelte';
	import Toolbar from '../components/Toolbar.svelte';
	import GridCanvas from '../components/GridCanvas.svelte';
	import Sidebar from '../components/Sidebar.svelte';
	import CustomRuleEditor from '../components/panels/CustomRuleEditor.svelte';
	import RuleBrowser from '../components/panels/RuleBrowser.svelte';
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
	<footer class="footer">
		<span>Puzzle Solver</span>
		<span class="sep">|</span>
		<a href="https://github.com/BenKarcher/puzzle_solver" target="_blank" rel="noopener">Source Code</a>
		<span class="sep">|</span>
		<a href="https://github.com/BenKarcher/puzzle_solver/blob/main/LICENSE" target="_blank" rel="noopener">MIT License</a>
		<span class="sep">|</span>
		<span>Powered by <a href="https://www.minizinc.org/" target="_blank" rel="noopener">MiniZinc</a> (MPL-2.0)</span>
	</footer>
</div>

{#if ui.ruleBrowserOpen}
	<RuleBrowser {ruleConfigs} onclose={() => ui.closeRuleBrowser()} />
{/if}

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

	.footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 4px 12px;
		background: #f5f5f5;
		border-top: 1px solid #ddd;
		font-size: 11px;
		color: #888;
		flex-shrink: 0;
	}

	.footer a {
		color: #666;
		text-decoration: none;
	}

	.footer a:hover {
		color: #333;
		text-decoration: underline;
	}

	.footer .sep {
		color: #ccc;
	}
</style>
