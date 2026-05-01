import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { OllamaConfig, PersistedConfig } from "./types";

export const CONFIG_VERSION = 1;
export const CONFIG_PATH = resolve(homedir(), ".pi/agent/pi-ollama.json");

export const DEFAULTS: Required<Omit<OllamaConfig, "filter">> = {
	baseUrl: "http://localhost:11434",
	apiKey: "ollama",
	api: "openai-completions",
	compat: {
		supportsDeveloperRole: false,
		supportsReasoningEffort: false,
	},
	authHeader: true,
};

export const DEFAULT_CONTEXT_WINDOW = 128_000;
export const DEFAULT_MAX_TOKENS = 16_384;
export const FETCH_TIMEOUT_MS = 8_000;

/** Load the persisted JSON config, returning an empty object on any error. */
export async function loadPersistedConfig(): Promise<PersistedConfig> {
	try {
		const raw = await readFile(CONFIG_PATH, "utf-8");
		return JSON.parse(raw) as PersistedConfig;
	} catch {
		return {};
	}
}

/** Atomically write the persisted config file. */
export async function savePersistedConfig(config: PersistedConfig): Promise<void> {
	await writeFile(CONFIG_PATH, JSON.stringify({ ...config, version: CONFIG_VERSION }, null, 2));
}

/**
 * Read legacy `models.json` as a fallback for baseUrl / apiKey / api / compat.
 * Returns a partial config so the normal resolution chain can override it.
 */
export async function loadModelsJsonFallback(): Promise<Partial<OllamaConfig>> {
	try {
		const path = resolve(homedir(), ".pi/agent/models.json");
		const raw = await readFile(path, "utf-8");
		const parsed = JSON.parse(raw);
		const ollama = parsed.providers?.ollama;
		if (!ollama) return {};
		return {
			baseUrl: ollama.baseUrl,
			apiKey: ollama.apiKey,
			api: ollama.api,
			compat: ollama.compat,
			authHeader: ollama.authHeader,
		};
	} catch {
		return {};
	}
}

export function stripTrailingSlash(s: string): string {
	return s.replace(/\/$/, "");
}

export function resolveBaseUrl(input?: string): string {
	return stripTrailingSlash(input || DEFAULTS.baseUrl);
}

/**
 * Resolve the API key value.
 * - If prefixed with `!`, treat the remainder as a literal key.
 * - If the value matches an environment variable name, resolve it.
 * - Otherwise return the value as-is.
 */
export function resolveApiKey(input?: string): string {
	if (!input) return DEFAULTS.apiKey;
	if (input.startsWith("!")) return input;
	if (input in process.env) return process.env[input] || DEFAULTS.apiKey;
	return input;
}

/**
 * Resolve the effective configuration using the priority chain:
 *   env vars → persisted file → models.json fallback → defaults
 */
export async function resolveConfig(): Promise<OllamaConfig> {
	const persisted = await loadPersistedConfig();
	const fallback = await loadModelsJsonFallback();

	return {
		baseUrl: resolveBaseUrl(process.env.OLLAMA_BASE_URL ?? persisted.baseUrl ?? fallback.baseUrl),
		apiKey: resolveApiKey(process.env.OLLAMA_API_KEY ?? persisted.apiKey ?? fallback.apiKey),
		api: process.env.OLLAMA_API ?? persisted.api ?? fallback.api ?? DEFAULTS.api,
		compat: persisted.compat ?? fallback.compat ?? DEFAULTS.compat,
		authHeader: persisted.authHeader ?? fallback.authHeader ?? DEFAULTS.authHeader,
		filter: process.env.OLLAMA_FILTER ?? persisted.filter,
	};
}
