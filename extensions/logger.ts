type LogLevel = "info" | "warn" | "error";

const PREFIX = "[pi-ollama]";

/**
 * Centralized logger so we can swap output strategies later
 * (e.g. structured logging, silence in tests, etc.).
 */
export function log(level: LogLevel, message: string): void {
	const full = `${PREFIX} ${message}`;
	if (level === "error") {
		console.error(full);
	} else if (level === "warn") {
		console.warn(full);
	} else {
		console.log(full);
	}
}
