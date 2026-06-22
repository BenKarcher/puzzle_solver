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

	// ── Keypad state ──────────────────────────────────────────────────────────

	const showKeypad = $derived(
		(ui.mode === 'setting' || ui.mode === 'solving') &&
		ui.activeTool === 'number' &&
		puzzleStore.puzzle.solutionSpaces.numbers.enabled &&
		puzzleStore.puzzle.solutionSpaces.numbers.max >= 10
	);

	const keypadN = $derived.by(() => {
		const { min, max } = puzzleStore.puzzle.solutionSpaces.numbers;
		const count = max - min + 1;
		return Math.ceil(Math.sqrt(count));
	});

	/** Flat list of values to show in keypad, row-major from min */
	const keypadValues = $derived.by(() => {
		const { min, max } = puzzleStore.puzzle.solutionSpaces.numbers;
		const N = keypadN;
		const out: (number | null)[] = [];
		for (let i = 0; i < N * N; i++) {
			const v = min + i;
			out.push(v <= max ? v : null);
		}
		return out;
	});

	function onKeypadClick(val: number, e: MouseEvent) {
		const cells = selection.cells;
		if (cells.length === 0) return;
		const { min, max } = puzzleStore.puzzle.solutionSpaces.numbers;
		if (val < min || val > max) return;

		const isGiven = ui.mode === 'setting';
		const isPencilMark = e.ctrlKey || e.metaKey;

		for (const cell of cells) {
			const currentCell = puzzleStore.getCell(cell.row, cell.col);
			if (ui.mode === 'solving' && currentCell.numberIsGiven) continue;
			if (isPencilMark && ui.mode === 'solving') {
				puzzleStore.togglePencilMark(cell, val);
			} else {
				puzzleStore.setCellNumber(cell, val, isGiven);
			}
		}
	}

	// ── Canvas ────────────────────────────────────────────────────────────────

	onMount(() => {
		ctx = canvas.getContext('2d');
		updateSize();

		const observer = new ResizeObserver(() => updateSize());
		observer.observe(canvas);

		return () => observer.disconnect();
	});

	function updateSize() {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		canvasWidth = rect.width;
		canvasHeight = rect.height;
	}

	$effect(() => {
		if (!ctx) return;

		canvas.width = canvasWidth;
		canvas.height = canvasHeight;

		const puzzle = puzzleStore.puzzle;
		const mode = ui.mode;
		const selectedCells = selection.cells;
		const selectedInstanceId = ui.selectedRuleInstanceId;
		const selectedGroupIdx = ui.selectedGroupIndex;

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

	function onMouseDown(e: MouseEvent) { handleCanvasMouseDown(e, layout); }
	function onMouseMove(e: MouseEvent) { handleCanvasMouseMove(e, layout); }
	function onMouseUp() { handleCanvasMouseUp(); }
	function onContextMenu(e: MouseEvent) { handleCanvasContextMenu(e, layout); }
	function onKeyDown(e: KeyboardEvent) { handleKeyDown(e); }
</script>

<div class="grid-canvas-outer" bind:this={container}>
	{#if showKeypad}
		{@const N = keypadN}
		<div class="keypad" style="--kpad-n: {N}">
			<p class="keypad-hint">Click a value<br/><span>Ctrl+click = pencil</span></p>
			<div class="keypad-grid" style="grid-template-columns: repeat({N}, 1fr)">
				{#each keypadValues as val}
					{#if val !== null}
						<button
							class="kpad-btn"
							title="Enter {val} in selected cells (Ctrl+click for pencil mark)"
							onclick={(e) => onKeypadClick(val, e)}
						>{val}</button>
					{:else}
						<span class="kpad-empty"></span>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

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
	.grid-canvas-outer {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: row;
		overflow: hidden;
	}

	canvas {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: block;
		cursor: crosshair;
		outline: none;
	}

	/* ── Keypad ── */
	.keypad {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px 10px;
		background: #fafafa;
		border-right: 1px solid #e0e0e0;
		width: calc(var(--kpad-n) * 40px + 20px);
		overflow-y: auto;
	}

	.keypad-hint {
		font-size: 10px;
		color: #999;
		text-align: center;
		margin: 0;
		line-height: 1.4;
	}

	.keypad-hint span {
		font-style: italic;
	}

	.keypad-grid {
		display: grid;
		gap: 4px;
		width: 100%;
	}

	.kpad-btn {
		aspect-ratio: 1;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		color: #333;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: background 0.1s, border-color 0.1s;
		user-select: none;
	}

	.kpad-btn:hover {
		background: #e8f0fe;
		border-color: #4287f5;
		color: #1a56d6;
	}

	.kpad-btn:active {
		background: #c7d9ff;
	}

	.kpad-empty {
		aspect-ratio: 1;
	}
</style>
