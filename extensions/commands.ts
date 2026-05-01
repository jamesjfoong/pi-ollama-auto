import { getCacheAgeMs, getCacheTtlMs, isCacheFresh, loadCache } from "./cache";
import { resolveConfig, savePersistedConfig } from "./config";
import { discoverModels } from "./discovery";
import { log } from "./logger";
import {
	getCurrentConfig,
	getLastDiscovered,
	getLastRefreshAt,
	getLastResult,
	registerProvider,
	setCurrentConfig,
} from "./provider";
import { runSetupWizard } from "./setup-wizard";
import type { CommandContext, ExtensionAPI, OllamaConfig } from "./types";

/** Return cached config or re-resolve from disk/env. */
function getConfig(): Promise<OllamaConfig> {
	const cached = getCurrentConfig();
	return cached ? Promise.resolve(cached) : resolveConfig();
}

function formatDuration(ms?: number): string {
	if (!ms || ms < 1000) return "<1s";
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	const rem = sec % 60;
	return `${min}m ${rem}s`;
}

export function registerCommands(pi: ExtensionAPI): void {
	// ---------------------------------------------------------------------------
	// /ollama-setup
	// ---------------------------------------------------------------------------
	pi.registerCommand("ollama-setup", {
		description: "Interactive setup for Ollama auto-discovery endpoint",
		handler: async (_args: unknown, ctx: CommandContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("[pi-ollama] Setup requires interactive mode", "error");
				return;
			}

			const config = await getConfig();
			const result = await runSetupWizard(ctx, config);

			if (!result) {
				ctx.ui.notify("[pi-ollama] Setup cancelled", "info");
				return;
			}

			// Persist
			setCurrentConfig(result);
			await savePersistedConfig({
				baseUrl: result.baseUrl,
				apiKey: result.apiKey,
				api: result.api,
				compat: result.compat,
				authHeader: result.authHeader,
				filter: result.filter,
			});

			// Re-discover and register
			try {
				const discovery = await discoverModels(result);
				registerProvider(pi, result, discovery);
				ctx.ui.notify(`[pi-ollama] ${discovery.models.length} models configured`, "success");
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(
					`[pi-ollama] Config saved, but discovery failed: ${msg.slice(0, 120)}`,
					"warning",
				);
			}
		},
	});

	// ---------------------------------------------------------------------------
	// /ollama-refresh
	// ---------------------------------------------------------------------------
	pi.registerCommand("ollama-refresh", {
		description: "Refresh Ollama model list from API",
		handler: async (_args: unknown, ctx: CommandContext) => {
			const config = await getConfig();
			try {
				const discovery = await discoverModels(config);
				registerProvider(pi, config, discovery);
				ctx.ui.notify(
					`[pi-ollama] ${discovery.models.length} models refreshed (${discovery.source})`,
					"success",
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`[pi-ollama] Refresh failed: ${msg.slice(0, 120)}`, "error");
			}
		},
	});

	// ---------------------------------------------------------------------------
	// /ollama-status
	// ---------------------------------------------------------------------------
	pi.registerCommand("ollama-status", {
		description: "Show Ollama auto-discovery status",
		handler: async (_args: unknown, ctx: CommandContext) => {
			const config = await getConfig();
			const discovered = getLastDiscovered();
			const result = getLastResult();
			if (discovered.length === 0) {
				ctx.ui.notify(`[pi-ollama] No models loaded. Endpoint: ${config.baseUrl}`, "warning");
				return;
			}

			const age = result?.cacheAgeMs ? formatDuration(result.cacheAgeMs) : "n/a";
			const source = result?.source || "unknown";
			const filter = config.filter ? ` filter=${config.filter}` : "";
			const refreshed = formatDuration(Date.now() - getLastRefreshAt());
			ctx.ui.notify(
				`[pi-ollama] ${discovered.length} models @ ${config.baseUrl} source=${source} cacheAge=${age} refreshed=${refreshed} ago${filter}`,
				"info",
			);
		},
	});

	// ---------------------------------------------------------------------------
	// /ollama-doctor
	// ---------------------------------------------------------------------------
	pi.registerCommand("ollama-doctor", {
		description: "Diagnose Ollama endpoint, cache, and discovery state",
		handler: async (_args: unknown, ctx: CommandContext) => {
			const config = await getConfig();
			const result = getLastResult();
			const cache = await loadCache();

			const lines: string[] = [];
			lines.push(`endpoint=${config.baseUrl}`);
			lines.push(`api=${config.api}`);
			lines.push(`authHeader=${config.authHeader ? "on" : "off"}`);
			lines.push(`filter=${config.filter || "(none)"}`);
			lines.push(`cacheTtl=${formatDuration(getCacheTtlMs())}`);

			if (cache) {
				const age = getCacheAgeMs(cache);
				lines.push(
					`cache=present age=${formatDuration(age)} fresh=${isCacheFresh(cache) ? "yes" : "no"} models=${cache.models.length}`,
				);
			} else {
				lines.push("cache=missing");
			}

			if (result) {
				lines.push(`lastSource=${result.source}`);
				lines.push(
					`models=${result.models.length} enrichment=${result.enrichment.succeeded}/${result.enrichment.attempted} ok (${result.enrichment.failed} failed)`,
				);
				if (result.warnings?.length) lines.push(`warnings=${result.warnings[0]}`);
			} else {
				lines.push("lastSource=none");
			}

			const summary = `[pi-ollama] doctor: ${lines.join(" | ")}`;
			ctx.ui.notify(summary, "info");
			log("info", summary);
		},
	});
}
