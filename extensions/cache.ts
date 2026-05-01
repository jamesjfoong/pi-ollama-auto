import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type { DiscoveredModel, EnrichmentStats } from "./types";

const CACHE_VERSION = 1;
export const CACHE_PATH = resolve(homedir(), ".pi/agent/cache/pi-ollama-models.json");

export interface ModelCache {
	version: number;
	baseUrl: string;
	timestamp: number;
	source: "live" | "cache";
	models: DiscoveredModel[];
	enrichment: EnrichmentStats;
}

export function getCacheTtlMs(): number {
	const ttlMs = Number(process.env.OLLAMA_CACHE_TTL_MS || "");
	if (Number.isFinite(ttlMs) && ttlMs > 0) return ttlMs;

	const ttlMin = Number(process.env.OLLAMA_CACHE_TTL_MIN || "");
	if (Number.isFinite(ttlMin) && ttlMin > 0) return ttlMin * 60_000;

	return 15 * 60_000;
}

export async function loadCache(): Promise<ModelCache | null> {
	try {
		const raw = await readFile(CACHE_PATH, "utf-8");
		const parsed = JSON.parse(raw) as ModelCache;
		if (!Array.isArray(parsed.models) || !parsed.timestamp) return null;
		return parsed;
	} catch {
		return null;
	}
}

export async function saveCache(data: Omit<ModelCache, "version">): Promise<void> {
	await mkdir(dirname(CACHE_PATH), { recursive: true });
	await writeFile(CACHE_PATH, JSON.stringify({ version: CACHE_VERSION, ...data }, null, 2));
}

export function getCacheAgeMs(cache: ModelCache): number {
	return Math.max(0, Date.now() - cache.timestamp);
}

export function isCacheFresh(cache: ModelCache): boolean {
	return getCacheAgeMs(cache) <= getCacheTtlMs();
}
