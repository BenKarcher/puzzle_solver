import type { RuleConfig, LoadedRule, RenderFn, GeneratorFn, CustomRuleDefinition, RulesetConfig } from '$lib/model/types';

// Eagerly load all config.json files
const configModules = import.meta.glob('./library/*/config.json', { eager: true });

// Lazily load MiniZinc files as raw strings
const mznModules = import.meta.glob('./library/*/rule.mzn', { eager: true, query: '?raw', import: 'default' });

// Lazily load render modules
const renderModules = import.meta.glob('./library/*/render.ts', { eager: true });

// Lazily load generate modules
const generateModules = import.meta.glob('./library/*/generate.ts', { eager: true });

// Shared MiniZinc import snippets (prepended once per compilation when any rule requests them)
const importModules = import.meta.glob('./imports/*.mzn', { eager: true, query: '?raw', import: 'default' });
const importMap = new Map<string, string>();
for (const [path, content] of Object.entries(importModules)) {
	const match = path.match(/\.\/imports\/([^/]+)\.mzn$/);
	if (match) importMap.set(match[1], content as string);
}

export function getImportSnippet(name: string): string | undefined {
	return importMap.get(name);
}

export function getAvailableImports(): string[] {
	return [...importMap.keys()].sort();
}

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
	return [...allConfigs];
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

// ---- Ruleset registry ----

const rulesetModules = import.meta.glob('./rulesets/*.json', { eager: true });
const allRulesets: RulesetConfig[] = [];

interface RulesetModule {
	default: RulesetConfig;
}

for (const [, module] of Object.entries(rulesetModules)) {
	allRulesets.push((module as RulesetModule).default);
}

export function getAllRulesets(): RulesetConfig[] {
	return [...allRulesets];
}

export function getRulesetById(id: string): RulesetConfig | undefined {
	return allRulesets.find((rs) => rs.id === id);
}

// ---- Custom rule registration ----

const customRuleMap = new Map<string, LoadedRule>();

function customToLoaded(def: CustomRuleDefinition): LoadedRule {
	const config: RuleConfig = {
		id: def.id,
		name: def.name,
		description: def.description,
		categories: def.categories?.length ? ['custom', ...def.categories] : ['custom'],
		requiredSpaces: def.requiredSpaces,
		scope: def.scope,
		groups: def.groups,
		predicateName: def.predicateName,
		imports: def.imports,
	};
	return { config, mzn: def.mzn };
}

export function syncCustomRules(definitions: CustomRuleDefinition[]): void {
	// Remove old custom rules
	for (const id of customRuleMap.keys()) {
		ruleMap.delete(id);
		const idx = allConfigs.findIndex((c) => c.id === id);
		if (idx >= 0) allConfigs.splice(idx, 1);
	}
	customRuleMap.clear();

	// Add current custom rules
	for (const def of definitions) {
		const loaded = customToLoaded(def);
		ruleMap.set(def.id, loaded);
		customRuleMap.set(def.id, loaded);
		allConfigs.push(loaded.config);
	}
}

export function isCustomRule(id: string): boolean {
	return customRuleMap.has(id);
}
