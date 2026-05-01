import { registerCommands } from "./commands";
import { resolveConfig } from "./config";
import { discoverModels } from "./discovery";
import { log } from "./logger";
import { getLastDiscovered, getLastResult, registerProvider, setCurrentConfig } from "./provider";
import type { ExtensionAPI, SessionContext } from "./types";

export default async function (pi: ExtensionAPI) {
	const config = await resolveConfig();
	setCurrentConfig(config);
	let startupError: string | null = null;

	// ---------------------------------------------------------------------------
	// Initial discovery
	// ---------------------------------------------------------------------------
	try {
		const discovery = await discoverModels(config);
		registerProvider(pi, config, discovery);
		log(
			"info",
			`${discovery.models.length} models from ${config.baseUrl} source=${discovery.source} enrichment=${discovery.enrichment.succeeded}/${discovery.enrichment.attempted}`,
		);
	} catch (err) {
		startupError = err instanceof Error ? err.message : String(err);
		log("warn", `Discovery failed: ${startupError}`);
	}

	// ---------------------------------------------------------------------------
	// Session start notification
	// ---------------------------------------------------------------------------
	pi.on("session_start", async (_event: unknown, ctx: SessionContext) => {
		const discovered = getLastDiscovered();
		const result = getLastResult();
		if (discovered.length > 0) {
			ctx.ui.notify(
				`[pi-ollama] ${discovered.length} Ollama models ready (${result?.source || "unknown"})`,
				"success",
			);
			if (result?.warnings?.length) {
				ctx.ui.notify(`[pi-ollama] ${result.warnings[0].slice(0, 120)}`, "warning");
			}
		} else if (startupError) {
			ctx.ui.notify(`[pi-ollama] Off-line: ${startupError.slice(0, 80)}`, "warning");
		}
	});

	// ---------------------------------------------------------------------------
	// Commands
	// ---------------------------------------------------------------------------
	registerCommands(pi);
}
