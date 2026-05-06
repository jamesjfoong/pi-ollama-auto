import { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, ENRICH_TIMEOUT_MS } from "./constants";
import type { DiscoveredModel, OllamaConfig } from "./types";

// ---------------------------------------------------------------------------
// Heuristics — matched against model id / family / capabilities
// ---------------------------------------------------------------------------

const REASONING_NAMES = /r1|deepseek.*reason|think|reason|qwq|o1|o3/i;
const CODE_NAMES = /coder|code(?!nt)|starcoder|codellama|qwen.*coder|deepseek.*coder|gemma.*code/i;
const EMBED_NAMES = /embed|nomic|mxbai|all-minilm|gte|e5|bge|snowflake/i;
const TOOLS_NAMES = /llama3\.[2-9]|qwen2\.5|qwen3|nemotron|granite|mixtral|mistral.*large|command.*plus|phi4|glm-4/i;
const VISION_NAMES = /llava|bakllava|moondream|minicpm|gemma3|qwen.*vl/i;

// ---------------------------------------------------------------------------
// HTTP helpers — duplicated here to avoid circular import with discovery.ts
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
	url: string,
	init: RequestInit = {},
	timeoutMs = ENRICH_TIMEOUT_MS,
): Promise<Response> {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(id);
	}
}

function buildAuthHeaders(config: OllamaConfig, keyIndex = 0): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (config.authHeader) {
		const keys = config.apiKeys ?? [config.apiKey];
		const key = keys[keyIndex] || keys[0];
		if (key) {
			headers.Authorization = `Bearer ${key}`;
		}
	}
	return headers;
}

function isAuthFailure(err: unknown): boolean {
	if (err instanceof Error) {
		return /401|403|Unauthorized|Forbidden/i.test(err.message);
	}
	return false;
}

async function tryWithKeyRotation<T>(
	config: OllamaConfig,
	operation: (keyIndex: number) => Promise<T>,
	isAuthError: (err: unknown) => boolean,
): Promise<T> {
	const keys = config.apiKeys ?? [config.apiKey];
	let lastErr: unknown;

	for (let i = 0; i < keys.length; i++) {
		try {
			return await operation(i);
		} catch (err) {
			lastErr = err;
			if (!isAuthError(err) || i === keys.length - 1) {
				throw err;
			}
		}
	}

	throw lastErr;
}

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

export function extractContextLength(modelInfo: Record<string, unknown>): number {
	for (const [key, value] of Object.entries(modelInfo)) {
		if (!key.endsWith(".context_length")) continue;
		const num = Number(value);
		if (Number.isFinite(num) && num > 0) return num;
	}
	return DEFAULT_CONTEXT_WINDOW;
}

function parseParameterSize(raw?: string): { size: number; label: string } | null {
	if (!raw) return null;
	const match = raw.match(/^([\d.]+)\s*([KMGT]?)/i);
	if (!match) return null;
	const num = Number.parseFloat(match[1]);
	const unit = match[2].toUpperCase();
	const multiplier = unit === "K" ? 1e3 : unit === "M" ? 1e6 : unit === "G" ? 1e9 : unit === "T" ? 1e12 : 1;
	const total = num * (multiplier || 1);
	return { size: total, label: raw };
}

function sizeTierEmoji(raw?: string): string | null {
	const parsed = parseParameterSize(raw);
	if (!parsed) return null;
	const { size } = parsed;
	if (size < 4e9) return "🐁";
	if (size < 20e9) return "🐕";
	if (size < 70e9) return "🐘";
	return "🦣";
}

export function contextBucket(ctx: number): DiscoveredModel["contextBucket"] {
	if (ctx < 8_000) return "short";
	if (ctx < 32_000) return "standard";
	if (ctx < 128_000) return "long";
	return "massive";
}

// ---------------------------------------------------------------------------
// Badge computation
// ---------------------------------------------------------------------------

function computeBadges(
	name: string,
	family: string | undefined,
	parameterSize: string | undefined,
	quantizationLevel: string | undefined,
	capabilities: string[],
): string[] {
	const badges: string[] = [];

	if (capabilities.includes("vision") || VISION_NAMES.test(name)) badges.push("👁️");
	if (capabilities.includes("thinking") || REASONING_NAMES.test(name)) badges.push("🧠");
	if (capabilities.includes("tools") || TOOLS_NAMES.test(name)) badges.push("🔧");
	if (CODE_NAMES.test(name)) badges.push("💻");
	if (EMBED_NAMES.test(name)) badges.push("📊");

	const tier = sizeTierEmoji(parameterSize);
	if (tier) badges.push(tier);

	if (quantizationLevel) badges.push(`🎯${quantizationLevel}`);

	return badges;
}

/** Name-only heuristic badges used when /api/show fails. */
export function quickBadges(modelId: string): string[] {
	const badges: string[] = [];
	if (VISION_NAMES.test(modelId)) badges.push("👁️");
	if (REASONING_NAMES.test(modelId)) badges.push("🧠");
	if (TOOLS_NAMES.test(modelId)) badges.push("🔧");
	if (CODE_NAMES.test(modelId)) badges.push("💻");
	if (EMBED_NAMES.test(modelId)) badges.push("📊");
	return badges;
}

// ---------------------------------------------------------------------------
// Primary enrichment — hits /api/show
// ---------------------------------------------------------------------------

export async function enrichModel(
	config: OllamaConfig,
	modelId: string,
): Promise<DiscoveredModel> {
	const url = `${config.baseUrl}/api/show`;
	const response = await tryWithKeyRotation(
		config,
		async (keyIndex) => {
			const res = await fetchWithTimeout(
				url,
				{
					method: "POST",
					headers: buildAuthHeaders(config, keyIndex),
					body: JSON.stringify({ model: modelId, verbose: true }),
				},
				ENRICH_TIMEOUT_MS,
			);
			if (!res.ok) {
				throw new Error(`/api/show ${res.status}: ${await res.text()}`);
			}
			return res;
		},
		isAuthFailure,
	);

	const payload = (await response.json()) as {
		capabilities?: string[];
		model_info?: Record<string, unknown>;
		details?: {
			parameter_size?: string;
			quantization_level?: string;
			family?: string;
			families?: string[];
		};
	};

	const capabilities = payload.capabilities || [];
	const modelInfo = payload.model_info || {};
	const details = payload.details || {};

	const contextWindow = extractContextLength(modelInfo);
	const family = details.family || details.families?.[0];
	const parameterSize = details.parameter_size;
	const quantizationLevel = details.quantization_level;

	const badges = computeBadges(modelId, family, parameterSize, quantizationLevel, capabilities);
	const vision = capabilities.includes("vision") || badges.includes("👁️");

	return {
		id: modelId,
		name: modelId,
		reasoning: badges.includes("🧠"),
		input: vision ? ["text", "image"] : ["text"],
		contextWindow,
		maxTokens: Math.min(DEFAULT_MAX_TOKENS, contextWindow),
		badges,
		parameterSize,
		quantizationLevel,
		family,
		contextBucket: contextBucket(contextWindow),
	};
}
