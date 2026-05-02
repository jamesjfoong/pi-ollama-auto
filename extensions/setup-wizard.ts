import { resolveBaseUrl } from "./config";
import { discoverModels } from "./discovery";
import type { CommandContext, OllamaConfig } from "./types";

function maskSecret(value: string): string {
	if (!value) return "";
	if (value.length <= 4) return "*".repeat(value.length);
	const visible = Math.min(6, Math.max(2, Math.floor(value.length / 4)));
	return `${value.slice(0, visible)}***`;
}

function buildMenu(working: OllamaConfig): string {
	const lines = [
		"1) Base URL     : " + working.baseUrl,
		"2) API Key      : " + maskSecret(working.apiKey),
		"3) Auth Header  : " + (working.authHeader ? "on" : "off"),
		"4) Filter       : " + (working.filter || "(none)"),
		"5) Test connection",
		"6) Save & discover",
		"7) Cancel",
		"",
		"Enter choice (1-7):",
	];
	return lines.join("\n");
}

/**
 * Interactive config menu you can navigate freely.
 * Pick a field, edit it, then return to the menu.
 * Returns the updated config, or `null` if the user cancelled.
 */
export async function runSetupWizard(
	ctx: CommandContext,
	current: OllamaConfig,
): Promise<OllamaConfig | null> {
	const working = { ...current };

	while (true) {
		const choice = await ctx.ui.input(buildMenu(working));
		if (choice === null) return null;

		switch (choice.trim()) {
			case "1": {
				const baseUrl = await ctx.ui.input(
					"Ollama Base URL (hint: local http://localhost:11434 or cloud https://ollama.com/v1)",
					working.baseUrl,
				);
				if (baseUrl !== null) {
					working.baseUrl = resolveBaseUrl(baseUrl || working.baseUrl);
				}
				break;
			}

			case "2": {
				const apiKey = await ctx.ui.input(
					"API Key (or env var name) — leave empty to keep current",
					maskSecret(working.apiKey),
				);
				if (apiKey !== null) {
					working.apiKey = apiKey || working.apiKey;
				}
				break;
			}

			case "3": {
				const authHeader = await ctx.ui.confirm(
					"Auth Header",
					`Send Authorization: Bearer header? Currently: ${working.authHeader ? "on" : "off"}`,
				);
				working.authHeader = authHeader;
				break;
			}

			case "4": {
				const filter = await ctx.ui.input("Model filter regex (optional)", working.filter || "");
				if (filter !== null) {
					working.filter = filter || undefined;
				}
				break;
			}

			case "5": {
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
				}
				break;
			}

			case "6": {
				return working;
			}

			case "7": {
				return null;
			}

			default:
				ctx.ui.notify("[pi-ollama] Invalid choice. Pick 1-7.", "warning");
				break;
		}
	}
}
