<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// Pressing Enter inside a text input blurs it — lets the user return
	// to canvas shortcuts without a click. Textareas keep Enter for newlines.
	function handleGlobalKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		const active = document.activeElement;
		if (active instanceof HTMLInputElement && active.type !== 'button' && active.type !== 'submit') {
			active.blur();
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Puzzle Solver</title>
</svelte:head>

{@render children()}

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		overflow: hidden;
		height: 100vh;
	}
</style>
