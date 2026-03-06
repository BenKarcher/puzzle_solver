import type { RuleConfig, LoadedRule, RenderFn, GeneratorFn } from '$lib/model/types';

// Eagerly load all config.json files
const configModules = import.meta.glob('./library/*/config.json', { eager: true });

// Lazily load MiniZinc files as raw strings
const mznModules = import.meta.glob('./library/*/rule.mzn', { eager: true, query: '?raw', import: 'default' });

// Lazily load render modules
const renderModules = import.meta.glob('./library/*/render.ts', { eager: true });

// Lazily load generate modules
const generateModules = import.meta.glob('./library/*/generate.ts', { eager: true });

interface ConfigModule {
	default: RuleConfig;
}

interface RenderModule {
	default: RenderFn;
}

interface GenerateModule {
	default: GeneratorFn;
}

function extractRuleId(path: string): string {
	const match = path.match(/\.\/library\/([^/]+)\//);
	return match ? match[1] : '';
}

// Build the full registry
const ruleMap = new Map<string, LoadedRule>();
const allConfigs: RuleConfig[] = [];

for (const [path, module] of Object.entries(configModules)) {
	const config = (module as ConfigModule).default;
	const ruleId = extractRuleId(path);

	const mznPath = `./library/${ruleId}/rule.mzn`;
	const renderPath = `./library/${ruleId}/render.ts`;
	const generatePath = `./library/${ruleId}/generate.ts`;

	const loaded: LoadedRule = {
		config,
		mzn: mznModules[mznPath] as string | undefined,
		render: renderModules[renderPath]
			? (renderModules[renderPath] as RenderModule).default
			: undefined,
		generate: generateModules[generatePath]
			? (generateModules[generatePath] as GenerateModule).default
			: undefined
	};

	ruleMap.set(config.id, loaded);
	allConfigs.push(config);
}

export function getRuleById(id: string): LoadedRule | undefined {
	return ruleMap.get(id);
}

export function getAllRuleConfigs(): RuleConfig[] {
	return allConfigs;
}

export function getAllLoadedRules(): LoadedRule[] {
	return Array.from(ruleMap.values());
}

export function getRuleRenderers(): Map<string, RenderFn> {
	const renderers = new Map<string, RenderFn>();
	for (const [id, rule] of ruleMap) {
		if (rule.render) {
			renderers.set(id, rule.render);
		}
	}
	return renderers;
}
