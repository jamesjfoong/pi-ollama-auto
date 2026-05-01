import { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS } from "./config";
import { shouldInclude } from "./discovery";
import type { DiscoveredModel, DiscoveryResult, ExtensionAPI, OllamaConfig } from "./types";

/** Mutable runtime state — kept in this module to avoid global pollution. */
const state = {
	config: null as OllamaConfig | null,
	models: [] as DiscoveredModel[],
	lastResult: null as DiscoveryResult | null,
	lastRefreshAt: 0,
};

export function setCurrentConfig(config: OllamaConfig): void {
	state.config = config;
}

export function getCurrentConfig(): OllamaConfig | null {
	return state.config;
}

export function getLastDiscovered(): DiscoveredModel[] {
	return state.models;
}

export function getLastResult(): DiscoveryResult | null {
	return state.lastResult;
}

export function getLastRefreshAt(): number {
	return state.lastRefreshAt;
}

/**
 * Register the `ollama` provider with pi using the discovered (and filtered) models.
 */
export function registerProvider(
	pi: ExtensionAPI,
	config: OllamaConfig,
	result: DiscoveryResult,
): void {
	const filtered = result.models.filter((m) => shouldInclude(m.id, config.filter));
	state.models = filtered;
	state.lastResult = {
		...result,
		models: filtered,
	};
	state.lastRefreshAt = Date.now();

	pi.registerProvider("ollama", {
		baseUrl: config.baseUrl,
		api: config.api as any,
		apiKey: config.apiKey,
		compat: config.compat as any,
		authHeader: config.authHeader,
		models: filtered.map((m) => ({
			id: m.id,
			name: m.name,
			reasoning: m.reasoning,
			input: m.input,
			contextWindow: m.contextWindow || DEFAULT_CONTEXT_WINDOW,
			maxTokens: m.maxTokens || DEFAULT_MAX_TOKENS,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		})),
	});
}
