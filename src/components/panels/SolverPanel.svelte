<script lang="ts">
	import { puzzleStore } from '$lib/state/puzzle.svelte';
	import { solverStore, AVAILABLE_SOLVERS } from '$lib/solver/solver.svelte';
	import { getAllLoadedRules } from '$lib/rules/registry';

	const isBusy = $derived(solverStore.status === 'compiling' || solverStore.status === 'solving');

	function handleSolve() {
		const rules = getAllLoadedRules();
		const snapshot = $state.snapshot(puzzleStore.puzzle);
		solverStore.solvePuzzle(snapshot, rules);
	}

	function handleSolveAll() {
		const rules = getAllLoadedRules();
		const snapshot = $state.snapshot(puzzleStore.puzzle);
		solverStore.solveAllPuzzle(snapshot, rules);
	}

	function handleCandidates() {
		const rules = getAllLoadedRules();
		const snapshot = $state.snapshot(puzzleStore.puzzle);
		solverStore.findCandidates(snapshot, rules);
	}

	function handleClearEntries() {
		puzzleStore.clearSolveEntries();
	}

</script>

<div class="panel">
	<details class="solver-section" open>
		<summary class="solver-header"><h3>Solver</h3></summary>

	<div class="solver-select">
		<label title="The constraint solving engine to use. Chuffed is generally faster for most puzzles.">
			Solver:
			<select bind:value={solverStore.selectedSolver} disabled={isBusy}>
				{#each AVAILABLE_SOLVERS as solver}
					<option value={solver.id}>{solver.name}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="actions">
		<button class="btn solve-btn" title="Find one valid solution and display it on the grid" onclick={handleSolve} disabled={isBusy}>
			{isBusy ? 'Solving...' : 'Find a Solution'}
		</button>
		<button class="btn" title="Runs until every valid solution is found or you hit Cancel. The final count is shown when done. Only the first N solutions are stored and browsable (set N with &quot;Max solutions to store&quot; below) — but the count always reflects the true total." onclick={handleSolveAll} disabled={isBusy}>
			Find All Solutions
		</button>
		<button class="btn" title="For each cell and each possible value, checks whether that value can appear in at least one valid solution given only the rules and Design-mode givens. Cells with a single candidate are filled in; cells with multiple show pencil marks. Note: numbers you have entered in Solve mode are not treated as constraints here — only cells marked as given in Design mode count." onclick={handleCandidates} disabled={isBusy}>
			Show True Candidates
		</button>
		<button class="btn cancel-btn" onclick={() => solverStore.cancel()} disabled={!isBusy}>
			Cancel
		</button>
	</div>

	<div class="max-solutions">
		<label title="How many solutions to store and display. Raise this limit when checking for uniqueness.">
			Max solutions to store:
			<input
				type="number"
				min="1"
				bind:value={solverStore.maxStoredSolutions}
				disabled={isBusy}
			/>
		</label>
	</div>

	{#if solverStore.status === 'error'}
		<div class="error">
			<strong>Error:</strong> {solverStore.errorMessage}
		</div>
	{/if}

	{#if solverStore.solutionCount > 0}
		<div class="results">
			<p class="count">
				{solverStore.solutionCount} solution{solverStore.solutionCount !== 1 ? 's' : ''} found{solverStore.status === 'solving' ? ' so far...' : ''}
				{#if solverStore.status === 'done' && solverStore.solutionCount === 1}
					<span class="unique-badge" title="The puzzle has exactly one solution">✓ unique</span>
				{:else if solverStore.status === 'done' && solverStore.solutionCount > 1}
					<span class="not-unique-badge" title="A well-formed puzzle should have exactly one solution">not unique</span>
				{/if}
			</p>

			{#if solverStore.solutions.length > 1}
				<div class="navigation">
					<button class="nav-btn" onclick={() => solverStore.prevSolution()} disabled={solverStore.currentSolutionIndex === 0}>
						&lt;
					</button>
					<span>{solverStore.currentSolutionIndex + 1} / {solverStore.solutions.length}</span>
					<button class="nav-btn" onclick={() => solverStore.nextSolution()} disabled={solverStore.currentSolutionIndex >= solverStore.solutions.length - 1}>
						&gt;
					</button>
				</div>
				<button class="btn download-btn" onclick={() => solverStore.downloadSolutions()}>
					Download {solverStore.solutions.length} solutions as JSON
				</button>
			{/if}
		</div>
	{:else if solverStore.status === 'solving' && !solverStore.candidateProgress}
		<p class="searching">Searching...</p>
	{/if}

	{#if solverStore.status === 'solving' && solverStore.candidateProgress}
		<div class="progress">
			{#if solverStore.candidateProgress.phase === 'sampling'}
				Sampling solutions...
			{:else}
				Eliminating: {solverStore.candidateProgress.completed} / {solverStore.candidateProgress.total}
			{/if}
		</div>
	{/if}

	{#if solverStore.candidateResult}
		<div class="results">
			<p class="count">True candidates computed</p>
		</div>
	{/if}

	{#if solverStore.status === 'done' && solverStore.solutionCount === 0 && !solverStore.candidateResult}
		<p class="no-solution">No solution found — check that your rules and given clues are consistent.</p>
	{/if}

	{#if solverStore.compiledModel}
		<details class="model-details">
			<summary>View MiniZinc Model</summary>
			<pre class="model-code">{solverStore.compiledModel}</pre>
		</details>
	{/if}

	<button class="btn clear-btn" onclick={handleClearEntries}>
		Clear Solution
	</button>
	</details>
</div>

<style>
	.panel {
		padding: 12px;
	}

	.solver-section {
		border: none;
	}

	.solver-header {
		cursor: pointer;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.solver-header::-webkit-details-marker {
		display: none;
	}

	.solver-header::before {
		content: '▶';
		font-size: 9px;
		color: #888;
		transition: transform 0.15s;
	}

	.solver-section[open] > .solver-header::before {
		transform: rotate(90deg);
	}

	h3 {
		margin: 0 0 8px;
		font-size: 13px;
		font-weight: 600;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.solver-header h3 {
		margin: 0;
	}

	.solver-select {
		margin-bottom: 10px;
		font-size: 12px;
		color: #666;
	}

	.solver-select select {
		padding: 3px 6px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 12px;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}

	.btn {
		padding: 8px 12px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}

	.btn:hover:not(:disabled) {
		background: #eee;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.solve-btn {
		background: #e8f5e9;
		border-color: #4caf50;
		color: #2e7d32;
	}

	.solve-btn:hover:not(:disabled) {
		background: #c8e6c9;
	}

	.cancel-btn {
		background: #fff3e0;
		border-color: #ff9800;
		color: #e65100;
	}

	.cancel-btn:hover {
		background: #ffe0b2;
	}

	.max-solutions {
		margin-bottom: 12px;
		font-size: 12px;
		color: #666;
	}

	.max-solutions input {
		width: 70px;
		padding: 3px 6px;
		border: 1px solid #ccc;
		border-radius: 3px;
		font-size: 12px;
	}

	.download-btn {
		margin-top: 6px;
		width: 100%;
		font-size: 12px;
	}

	.clear-btn {
		margin-top: 8px;
		width: 100%;
	}

	.error {
		background: #ffebee;
		color: #c62828;
		padding: 8px;
		border-radius: 4px;
		font-size: 12px;
		margin-top: 8px;
		word-break: break-word;
	}

	.results {
		margin-top: 8px;
		padding: 8px;
		background: #f5f5f5;
		border-radius: 4px;
	}

	.count {
		margin: 0 0 6px;
		font-size: 13px;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.unique-badge {
		font-size: 11px;
		font-weight: 600;
		color: #2e7d32;
		background: #e8f5e9;
		border: 1px solid #a5d6a7;
		border-radius: 3px;
		padding: 1px 5px;
		cursor: help;
	}

	.not-unique-badge {
		font-size: 11px;
		font-weight: 600;
		color: #c62828;
		background: #ffebee;
		border: 1px solid #ef9a9a;
		border-radius: 3px;
		padding: 1px 5px;
		cursor: help;
	}

	.navigation {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
	}

	.nav-btn {
		padding: 2px 8px;
		border: 1px solid #ccc;
		background: white;
		border-radius: 3px;
		cursor: pointer;
	}

	.nav-btn:hover:not(:disabled) {
		background: #eee;
	}

	.nav-btn:disabled {
		opacity: 0.3;
	}

	.searching {
		margin-top: 8px;
		font-size: 13px;
		color: #666;
		font-style: italic;
	}

	.progress {
		margin-top: 8px;
		font-size: 12px;
		color: #666;
	}

	.no-solution {
		margin-top: 8px;
		font-size: 13px;
		color: #888;
		font-style: italic;
	}

	.model-details {
		margin-top: 12px;
		font-size: 12px;
	}

	.model-details summary {
		cursor: pointer;
		color: #666;
	}

	.model-code {
		background: #f5f5f5;
		padding: 8px;
		border-radius: 4px;
		font-size: 11px;
		overflow-x: auto;
		max-height: 300px;
		overflow-y: auto;
		white-space: pre-wrap;
	}
</style>
