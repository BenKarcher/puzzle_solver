import type { PuzzleState, RuleInstance, RenderFn, RenderHelpers, CellCoord } from '$lib/model/types';

export function drawRulesLayer(
	ctx: CanvasRenderingContext2D,
	puzzle: PuzzleState,
	ruleRenderers: Map<string, RenderFn>,
	cellSize: number,
	offsetX: number,
	offsetY: number
): void {
	const helpers = createRenderHelpers(ctx, cellSize, offsetX, offsetY);

	for (const instance of puzzle.localRules) {
		const renderer = ruleRenderers.get(instance.ruleId);
		if (renderer) {
			ctx.save();
			renderer(instance, helpers, puzzle);
			ctx.restore();
		}
	}
}

function createRenderHelpers(
	ctx: CanvasRenderingContext2D,
	cellSize: number,
	offsetX: number,
	offsetY: number
): RenderHelpers {
	return {
		ctx,
		cellSize,

		cellCenter(coord: CellCoord) {
			return {
				x: offsetX + coord.col * cellSize + cellSize / 2,
				y: offsetY + coord.row * cellSize + cellSize / 2
			};
		},

		cellTopLeft(coord: CellCoord) {
			return {
				x: offsetX + coord.col * cellSize,
				y: offsetY + coord.row * cellSize
			};
		},

		line(from: CellCoord, to: CellCoord, color: string, width: number) {
			const f = this.cellCenter(from);
			const t = this.cellCenter(to);
			ctx.strokeStyle = color;
			ctx.lineWidth = width;
			ctx.beginPath();
			ctx.moveTo(f.x, f.y);
			ctx.lineTo(t.x, t.y);
			ctx.stroke();
		},

		arrow(from: CellCoord, to: CellCoord, color: string) {
			const f = this.cellCenter(from);
			const t = this.cellCenter(to);
			const angle = Math.atan2(t.y - f.y, t.x - f.x);
			const headLen = cellSize * 0.15;

			ctx.strokeStyle = color;
			ctx.fillStyle = color;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(f.x, f.y);
			ctx.lineTo(t.x, t.y);
			ctx.stroke();

			ctx.beginPath();
			ctx.moveTo(t.x, t.y);
			ctx.lineTo(t.x - headLen * Math.cos(angle - 0.4), t.y - headLen * Math.sin(angle - 0.4));
			ctx.lineTo(t.x - headLen * Math.cos(angle + 0.4), t.y - headLen * Math.sin(angle + 0.4));
			ctx.closePath();
			ctx.fill();
		},

		cage(cells: CellCoord[], color: string, inset: number) {
			if (cells.length === 0) return;
			const cellSet = new Set(cells.map((c) => `${c.row},${c.col}`));

			ctx.strokeStyle = color;
			ctx.lineWidth = 1.5;
			ctx.setLineDash([cellSize * 0.06, cellSize * 0.06]);

			for (const cell of cells) {
				const x = offsetX + cell.col * cellSize + inset;
				const y = offsetY + cell.row * cellSize + inset;
				const s = cellSize - inset * 2;

				// Draw edge segments where neighbor is NOT in the cage
				// Top
				if (!cellSet.has(`${cell.row - 1},${cell.col}`)) {
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x + s, y);
					ctx.stroke();
				}
				// Bottom
				if (!cellSet.has(`${cell.row + 1},${cell.col}`)) {
					ctx.beginPath();
					ctx.moveTo(x, y + s);
					ctx.lineTo(x + s, y + s);
					ctx.stroke();
				}
				// Left
				if (!cellSet.has(`${cell.row},${cell.col - 1}`)) {
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x, y + s);
					ctx.stroke();
				}
				// Right
				if (!cellSet.has(`${cell.row},${cell.col + 1}`)) {
					ctx.beginPath();
					ctx.moveTo(x + s, y);
					ctx.lineTo(x + s, y + s);
					ctx.stroke();
				}
			}

			ctx.setLineDash([]);
		},

		text(
			coord: CellCoord,
			text: string,
			position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
			fontSize: number,
			color: string
		) {
			const tl = this.cellTopLeft(coord);
			let x: number, y: number;

			ctx.fillStyle = color;
			ctx.font = `${fontSize}px sans-serif`;

			switch (position) {
				case 'center':
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					x = tl.x + cellSize / 2;
					y = tl.y + cellSize / 2;
					break;
				case 'top-left':
					ctx.textAlign = 'left';
					ctx.textBaseline = 'top';
					x = tl.x + cellSize * 0.08;
					y = tl.y + cellSize * 0.05;
					break;
				case 'top-right':
					ctx.textAlign = 'right';
					ctx.textBaseline = 'top';
					x = tl.x + cellSize - cellSize * 0.08;
					y = tl.y + cellSize * 0.05;
					break;
				case 'bottom-left':
					ctx.textAlign = 'left';
					ctx.textBaseline = 'bottom';
					x = tl.x + cellSize * 0.08;
					y = tl.y + cellSize - cellSize * 0.05;
					break;
				case 'bottom-right':
					ctx.textAlign = 'right';
					ctx.textBaseline = 'bottom';
					x = tl.x + cellSize - cellSize * 0.08;
					y = tl.y + cellSize - cellSize * 0.05;
					break;
			}

			ctx.fillText(text, x, y);
		},

		dot(between: [CellCoord, CellCoord], color: string, radius: number) {
			const c1 = this.cellCenter(between[0]);
			const c2 = this.cellCenter(between[1]);
			const mx = (c1.x + c2.x) / 2;
			const my = (c1.y + c2.y) / 2;

			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(mx, my, radius, 0, Math.PI * 2);
			ctx.fill();
		},

		edgeMidpoint(from: CellCoord, to: CellCoord) {
			const c1 = this.cellCenter(from);
			const c2 = this.cellCenter(to);
			return { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
		},

		circle(coord: CellCoord, color: string, radius: number, fill: boolean = true) {
			const c = this.cellCenter(coord);
			if (fill) {
				ctx.fillStyle = color;
				ctx.beginPath();
				ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.strokeStyle = color;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
				ctx.stroke();
			}
		},

		diamond(coord: CellCoord, color: string, size: number, fill: boolean = true) {
			const c = this.cellCenter(coord);
			ctx.beginPath();
			ctx.moveTo(c.x, c.y - size);
			ctx.lineTo(c.x + size, c.y);
			ctx.lineTo(c.x, c.y + size);
			ctx.lineTo(c.x - size, c.y);
			ctx.closePath();
			if (fill) {
				ctx.fillStyle = color;
				ctx.fill();
			} else {
				ctx.strokeStyle = color;
				ctx.lineWidth = 2;
				ctx.stroke();
			}
		},

		edgeText(from: CellCoord, to: CellCoord, label: string, fontSize: number, color: string) {
			const mid = this.edgeMidpoint(from, to);
			ctx.fillStyle = color;
			ctx.font = `${fontSize}px sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(label, mid.x, mid.y);
		},

		cellFill(coord: CellCoord, color: string) {
			const tl = this.cellTopLeft(coord);
			ctx.fillStyle = color;
			ctx.fillRect(tl.x, tl.y, cellSize, cellSize);
		},

		thermometer(cells: CellCoord[], bulbColor: string, lineColor: string) {
			if (cells.length < 2) return;
			const radius = cellSize * 0.35;
			const lineWidth = cellSize * 0.2;

			// Draw the line through all cells
			ctx.strokeStyle = lineColor;
			ctx.lineWidth = lineWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.beginPath();
			const start = this.cellCenter(cells[0]);
			ctx.moveTo(start.x, start.y);
			for (let i = 1; i < cells.length; i++) {
				const p = this.cellCenter(cells[i]);
				ctx.lineTo(p.x, p.y);
			}
			ctx.stroke();

			// Draw the bulb at the first cell
			ctx.fillStyle = bulbColor;
			ctx.beginPath();
			ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = lineColor;
			ctx.lineWidth = 2;
			ctx.stroke();
		}
	};
}
