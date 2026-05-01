import { getCacheAgeMs, isCacheFresh, loadCache, saveCache } from "./cache";
import { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, FETCH_TIMEOUT_MS } from "./config";
import type { DiscoveredModel, DiscoveryResult, EnrichmentStats, OllamaConfig } from "./types";

async function fetchWithTimeout(
	url: string,
	init: RequestInit = {},
	timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(id);
	}
}

function buildAuthHeaders(config: OllamaConfig): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (config.authHeader && config.apiKey) {
		headers.Authorization = `Bearer ${config.apiKey}`;
	}
	return headers;
}

async function discoverOpenAiModelIds(config: OllamaConfig): Promise<string[]> {
	const url = `${config.baseUrl}/v1/models`;
	const response = await fetchWithTimeout(url, {
		headers: buildAuthHeaders(config),
	});
	if (!response.ok) {
		throw new Error(`OpenAI-compat API returned ${response.status}: ${await response.text()}`);
	}
	const payload = (await response.json()) as {
		data: Array<{ id: string; object?: string }>;
	};
	return (payload.data || [])
		.filter((m) => m.object === "model" || !m.object)
		.map((m) => m.id)
		.filter(Boolean);
}

async function discoverNativeModelIds(config: OllamaConfig): Promise<string[]> {
	const root = config.baseUrl.replace(/\/v1$/, "");
	const url = `${root}/api/tags`;
	const response = await fetchWithTimeout(url, {
		headers: buildAuthHeaders(config),
	});
	if (!response.ok) {
		throw new Error(`Native API returned ${response.status}: ${await response.text()}`);
	}
	const payload = (await response.json()) as {
		models?: Array<{ name: string }>;
	};
	return (payload.models || []).map((m) => m.name).filter(Boolean);
}

function extractContextLength(modelInfo: Record<string, unknown>): number {
	for (const [key, value] of Object.entries(modelInfo)) {
		if (!key.endsWith(".context_length")) continue;
		const num = Number(value);
		if (Number.isFinite(num) && num > 0) return num;
	}
	return DEFAULT_CONTEXT_WINDOW;
}

async function enrichModel(config: OllamaConfig, modelId: string): Promise<DiscoveredModel> {
	const root = config.baseUrl.replace(/\/v1$/, "");
	const url = `${root}/api/show`;
	const response = await fetchWithTimeout(
		url,
		{
			method: "POST",
			headers: buildAuthHeaders(config),
			body: JSON.stringify({ model: modelId, verbose: true }),
		},
		FETCH_TIMEOUT_MS,
	);

	if (!response.ok) {
		throw new Error(`/api/show ${response.status}: ${await response.text()}`);
	}

	const payload = (await response.json()) as {
		capabilities?: string[];
		model_info?: Record<string, unknown>;
	};

	const capabilities = payload.capabilities || [];
	const vision = capabilities.includes("vision");
	const thinking = capabilities.includes("thinking");
	const contextWindow = extractContextLength(payload.model_info || {});

	return {
		id: modelId,
		name: modelId,
		reasoning: thinking,
		input: vision ? ["text", "image"] : ["text"],
		contextWindow,
		maxTokens: Math.min(DEFAULT_MAX_TOKENS, contextWindow),
	};
}

async function normalizeAndEnrich(
	config: OllamaConfig,
	modelIds: string[],
): Promise<{ models: DiscoveredModel[]; enrichment: EnrichmentStats }> {
	const unique = Array.from(new Set(modelIds)).sort();
	const enrichment: EnrichmentStats = {
		attempted: unique.length,
		succeeded: 0,
		failed: 0,
	};

	const models: DiscoveredModel[] = [];
	for (const id of unique) {
		try {
			const model = await enrichModel(config, id);
			models.push(model);
			enrichment.succeeded += 1;
		} catch {
			models.push({
				id,
				name: id,
				reasoning: false,
				input: ["text"],
				contextWindow: DEFAULT_CONTEXT_WINDOW,
				maxTokens: DEFAULT_MAX_TOKENS,
			});
			enrichment.failed += 1;
		}
	}

	return { models, enrichment };
}

async function discoverLive(config: OllamaConfig): Promise<DiscoveryResult> {
	const errors: string[] = [];

	try {
		const ids = await discoverOpenAiModelIds(config);
		if (ids.length > 0) {
			const { models, enrichment } = await normalizeAndEnrich(config, ids);
			return { source: "live-openai", models, enrichment };
		}
		errors.push("OpenAI-compat endpoint returned empty model list");
	} catch (err) {
		errors.push(`OpenAI-compat endpoint: ${err instanceof Error ? err.message : String(err)}`);
	}

	try {
		const ids = await discoverNativeModelIds(config);
		if (ids.length > 0) {
			const { models, enrichment } = await normalizeAndEnrich(config, ids);
			return { source: "live-native", models, enrichment };
		}
		errors.push("Native API returned empty model list");
	} catch (err) {
		errors.push(`Native API: ${err instanceof Error ? err.message : String(err)}`);
	}

	throw new Error(errors.join("; "));
}

/**
 * Discover available models with cache fallback.
 * - successful live discovery updates cache
 * - on failure, fresh/stale cache is used when available
 */
export async function discoverModels(config: OllamaConfig): Promise<DiscoveryResult> {
	try {
		const live = await discoverLive(config);
		await saveCache({
			baseUrl: config.baseUrl,
			timestamp: Date.now(),
			source: "live",
			models: live.models,
			enrichment: live.enrichment,
		});
		return live;
	} catch (liveErr) {
		const cache = await loadCache();
		if (cache && Array.isArray(cache.models) && cache.models.length > 0) {
			const age = getCacheAgeMs(cache);
			const fresh = isCacheFresh(cache);
			return {
				source: fresh ? "cache-fresh" : "cache-stale",
				models: cache.models,
				enrichment: cache.enrichment,
				cacheAgeMs: age,
				warnings: [
					`Live discovery failed: ${liveErr instanceof Error ? liveErr.message : String(liveErr)}`,
				],
			};
		}
		throw liveErr;
	}
}

/**
 * Determine whether a model should be included in the final provider list.
 * - Excludes embedding models by default (`/embed/i`).
 * - If a user filter regex is provided, only includes matching models.
 */
export function shouldInclude(modelId: string, filter?: string): boolean {
	if (/embed/i.test(modelId)) return false;
	if (filter) {
		try {
			const regex = new RegExp(filter, "i");
			return regex.test(modelId);
		} catch {
			// Invalid regex — ignore filter rather than crashing
		}
	}
	return true;
}
