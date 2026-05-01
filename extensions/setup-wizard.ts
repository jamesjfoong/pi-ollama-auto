import { resolveBaseUrl } from "./config";
import { discoverModels } from "./discovery";
import type { CommandContext, OllamaConfig } from "./types";

/**
 * Interactive step-by-step wizard for configuring Ollama auto-discovery.
 * Returns the updated config, or `null` if the user cancelled.
 */
export async function runSetupWizard(
	ctx: CommandContext,
	current: OllamaConfig,
): Promise<OllamaConfig | null> {
	const working = { ...current };

	// Step 1: Base URL
	const baseUrl = await ctx.ui.input("Ollama Base URL", working.baseUrl);
	if (baseUrl === null) return null;
	working.baseUrl = resolveBaseUrl(baseUrl || working.baseUrl);

	// Step 2: API Key
	const apiKey = await ctx.ui.input("API Key (or env var name)", working.apiKey);
	if (apiKey === null) return null;
	working.apiKey = apiKey || working.apiKey;

	// Step 3: Auth Header
	const authHeader = await ctx.ui.confirm(
		"Auth Header",
		`Send Authorization: Bearer header? Currently: ${working.authHeader ? "on" : "off"}`,
	);
	working.authHeader = authHeader;

	// Step 4: Filter regex
	const filter = await ctx.ui.input("Model filter regex (optional)", working.filter || "");
	if (filter === null) return null;
	working.filter = filter || undefined;

	// Step 5: Test connection
	const test = await ctx.ui.confirm("Test connection?", `Test ${working.baseUrl} before saving?`);
	if (test) {
		ctx.ui.notify("[pi-ollama] Testing…", "info");
		try {
			const discovery = await discoverModels(working);
			ctx.ui.notify(
				`[pi-ollama] ✓ ${discovery.models.length} models found (${discovery.source})`,
				"success",
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			ctx.ui.notify(`[pi-ollama] ✗ ${msg.slice(0, 120)}`, "warning");
			const proceed = await ctx.ui.confirm("Save anyway?", "Test failed. Save config anyway?");
			if (!proceed) return null;
		}
	}

	return working;
}
