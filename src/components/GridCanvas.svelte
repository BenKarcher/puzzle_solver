<script lang="ts">
	import { onMount } from 'svelte';
	import type { RenderFn } from '$lib/model/types';
	import { renderGrid, type GridLayout } from '$lib/canvas/GridRenderer';
	import {
		handleCanvasMouseDown,
		handleCanvasMouseMove,
		handleCanvasMouseUp,
		handleCanvasContextMenu,
		handleKeyDown
	} from '$lib/canvas/interaction';
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { selection } from '$lib/state/selection.svelte';
	import { ui } from '$lib/state/ui.svelte';
	import { solverStore } from '$lib/solver/solver.svelte';
	let canvas: HTMLCanvasElement;
	let container: HTMLDivElement;
	let ctx = $state<CanvasRenderingContext2D | null>(null);
	let layout = $state<GridLayout>({ cellSize: 40, offsetX: 0, offsetY: 0 });
	let canvasWidth = $state(600);
	let canvasHeight = $state(600);

	interface Props {
		ruleRenderers: Map<string, RenderFn>;
	}

	let { ruleRenderers }: Props = $props();

	onMount(() => {
		ctx = canvas.getContext('2d');
		updateSize();

		const observer = new ResizeObserver(() => updateSize());
		observer.observe(container);

		return () => observer.disconnect();
	});

	function updateSize() {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		canvasWidth = rect.width;
		canvasHeight = rect.height;
	}

	// Re-render whenever any relevant state changes
	$effect(() => {
		if (!ctx) return;

		// Set canvas bitmap dimensions (clears canvas)
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;

		// Touch reactive dependencies
		const puzzle = puzzleStore.puzzle;
		const mode = ui.mode;
		const selectedCells = selection.cells;
		const selectedInstanceId = ui.selectedRuleInstanceId;
		const selectedGroupIdx = ui.selectedGroupIndex;

		// Build highlighted cells map for the selected rule instance
		let highlightedCells: Map<string, string> | undefined;
		if (selectedInstanceId) {
			const inst = puzzle.localRules.find((r) => r.id === selectedInstanceId);
			if (inst) {
				const GROUP_COLORS = [
					'rgba(66, 135, 245, 0.3)',
					'rgba(245, 166, 66, 0.3)',
					'rgba(76, 175, 80, 0.3)',
					'rgba(156, 39, 176, 0.3)'
				];
				highlightedCells = new Map();
				for (let gi = 0; gi < inst.groups.length; gi++) {
					const color = gi === selectedGroupIdx
						? GROUP_COLORS[gi % GROUP_COLORS.length].replace('0.3)', '0.5)')
						: GROUP_COLORS[gi % GROUP_COLORS.length];
					for (const cell of inst.groups[gi].cells) {
						highlightedCells.set(`${cell.row},${cell.col}`, color);
					}
				}
			}
		}

		// Overlay check-solution violation highlights
		const checkResult = solverStore.checkResult;
		if (checkResult && checkResult.violations.length > 0) {
			if (!highlightedCells) highlightedCells = new Map();
			for (const v of checkResult.violations) {
				for (const cell of v.cells) {
					highlightedCells.set(`${cell.row},${cell.col}`, 'rgba(244, 67, 54, 0.3)');
				}
			}
		}

		layout = renderGrid(ctx, canvasWidth, canvasHeight, {
			puzzle,
			mode,
			selectedCells,
			ruleRenderers,
			highlightedCells
		});
	});

	function onMouseDown(e: MouseEvent) {
		handleCanvasMouseDown(e, layout);
	}

	function onMouseMove(e: MouseEvent) {
		handleCanvasMouseMove(e, layout);
	}

	function onMouseUp() {
		handleCanvasMouseUp();
	}

	function onContextMenu(e: MouseEvent) {
		handleCanvasContextMenu(e, layout);
	}

	function onKeyDown(e: KeyboardEvent) {
		handleKeyDown(e);
	}
</script>

<div class="grid-canvas-container" bind:this={container}>
	<canvas
		bind:this={canvas}
		onmousedown={onMouseDown}
		onmousemove={onMouseMove}
		onmouseup={onMouseUp}
		onmouseleave={onMouseUp}
		oncontextmenu={onContextMenu}
		tabindex="0"
		aria-label="Puzzle grid"
	></canvas>
</div>

<svelte:window onkeydown={onKeyDown} />

<style>
	.grid-canvas-container {
		flex: 1;
		min-width: 300px;
		min-height: 300px;
		position: relative;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: crosshair;
		outline: none;
	}
</style>
