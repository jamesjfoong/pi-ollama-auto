import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/** Runtime configuration for Ollama auto-discovery. */
export interface OllamaConfig {
	baseUrl: string;
	apiKey: string;
	apiKeys?: string[];
	api: string;
	compat: Record<string, unknown>;
	authHeader: boolean;
	filter?: string;
	prefix?: string;
	globalModelDefaults?: ModelOverride;
	modelOverridePatterns?: ModelOverridePattern[];
	modelOverrides?: Record<string, ModelOverride>;
}

/** Shape of the JSON file persisted to disk. */
export interface PersistedConfig extends Partial<OllamaConfig> {
	version?: number;
}

export interface EnrichmentStats {
	attempted: number;
	succeeded: number;
	failed: number;
}

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface ModelCost {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface ModelOverride {
	/** Model IDs are discovered from Ollama and cannot be changed by overrides. */
	id?: never;
	name?: string;
	api?: string;
	baseUrl?: string;
	reasoning?: boolean;
	thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>;
	input?: ["text"] | ["text", "image"];
	contextWindow?: number;
	maxTokens?: number;
	cost?: Partial<ModelCost>;
	headers?: Record<string, string>;
	compat?: Record<string, unknown>;
}

export interface ModelOverridePattern {
	match: string;
	override: ModelOverride;
}

/** A discovered model with normalized Pi provider metadata. */
export interface DiscoveredModel {
	id: string;
	name: string;
	api?: string;
	baseUrl?: string;
	reasoning: boolean;
	thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>;
	input: ["text"] | ["text", "image"];
	contextWindow: number;
	maxTokens: number;
	cost?: Partial<{
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	}>;
	headers?: Record<string, string>;
	compat?: Record<string, unknown>;
	/** Extra Ollama /api/chat `options` sampling params, from env vars (see settings.ts). */
	topP?: number;
	topK?: number;
	repeatPenalty?: number;
	minP?: number;
	presencePenalty?: number;
	frequencyPenalty?: number;
	seed?: number;
}

/** Extension settings resolved from environment variables and persisted config. */
export interface OllamaExtensionSettings {
	/** Base URL of the Ollama server, e.g. http://localhost:11434 */
	baseUrl: string;
	/**
	 * keep_alive for /api/chat requests. Resolution order:
	 *   1. Persisted config from `/ollama-keep-alive` slash command
	 *   2. `OLLAMA_KEEP_ALIVE` env var
	 *   3. undefined - the field is omitted; the Ollama server's own setting
	 *      decides (the default, since a per-request value overrides the server).
	 *
	 * Mutable at runtime - the slash command writes here AND to the persisted
	 * config file so changes survive restart.
	 */
	keepAlive?: string | number;
	/** Default num_ctx if model's contextWindow is unavailable. Default: 32768 */
	numCtx: number;
	/** Max ghost-token retries before surfacing an error. Default: 2 */
	ghostRetries: number;
	/** User-set context length override. Resolution order:
	 *   1. Persisted config from `/ollama-context` slash command
	 *   2. `OLLAMA_CONTEXT_LENGTH` env var
	 *   3. undefined (fall through to min(model.contextWindow, numCtx) in provider)
	 *
	 * Mutable at runtime - the slash command writes here AND to the persisted
	 * config file so changes survive restart.
	 */
	contextLength?: number;
	/** Per-model num_ctx overrides, from the persisted config file. Takes priority over contextLength. */
	perModelContext?: Record<string, number>;
	/** Extra Ollama /api/chat `options` sampling params, from env vars (see below). */
	topP?: number;
	topK?: number;
	repeatPenalty?: number;
	minP?: number;
	presencePenalty?: number;
	frequencyPenalty?: number;
	seed?: number;
}

/** Context passed to command handlers by the pi runtime. */
export interface CommandContext {
	hasUI: boolean;
	ui: {
		input: (title: string, placeholder?: string) => Promise<string | null>;
		confirm: (title: string, message: string) => Promise<boolean>;
		select: (title: string, options: string[]) => Promise<string | null>;
		notify: (message: string, type?: string) => void;
	};
}

/** Session start event context. */
export interface SessionContext {
	ui: {
		notify: (message: string, type?: string) => void;
	};
}

export type { ExtensionAPI };
