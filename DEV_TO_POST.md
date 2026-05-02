---
title: "How I Built pi-ollama: Auto-Discovering Ollama Models with Zero Build Steps"
published: false
tags: "productivity", "ollama", "pi", "typescript", "developer-tools"
series:
canonical_url:
---

## TL;DR

I built a [pi extension](https://pi.dev) that eliminates `models.json` maintenance for Ollama users. It auto-discovers models on startup, handles multi-key auth rotation, and ships with an interactive TUI — all in ~800 lines of TypeScript with **zero runtime dependencies** and **no build step**.

---

## The Problem: Death by a Thousand models.json Edits

I use [Ollama](https://ollama.com) to run local LLMs and [pi](https://pi.dev) as my coding agent harness. The workflow was painful:

1. `ollama pull qwen2.5-coder:7b` — new model downloaded
2. Open `~/.pi/agent/models.json`
3. Add `{ "id": "qwen2.5-coder:7b" }` to the `ollama.models` array
4. Restart pi
5. Repeat every time I pull a new model

This doesn't scale. I pull models daily — new coding models, vision models, reasoning models. Editing JSON by hand and restarting my agent harness every time felt like a tax on experimentation.

**I wanted:** `ollama pull` → open pi → model is already there. No restart. No JSON.

---

## The Solution: A pi Extension That Talks to Ollama

pi has an extension system that lets you register providers dynamically at runtime. The hook is simple:

```typescript
export default async function (pi: ExtensionAPI) {
	pi.registerProvider("ollama", {
		baseUrl: "http://localhost:11434",
		models: [
			/* discovered at runtime */
		],
	});
}
```

The challenge: **how do you discover models reliably across different Ollama setups?**

### Discovery Strategy

Ollama has two APIs:

- **OpenAI-compatible:** `GET /v1/models` — returns `{ data: [{ id, object: "model" }] }`
- **Native:** `GET /api/tags` — returns `{ models: [{ name }] }`

Some setups expose only one. Some are behind proxies. Some need auth. My discovery logic tries OpenAI-compat first, falls back to native, and handles both:

```typescript
async function discoverLive(config: OllamaConfig) {
	try {
		const ids = await discoverOpenAiModelIds(config);
		if (ids.length > 0) return { source: "live-openai", models: await enrich(config, ids) };
	} catch {
		/* fallback */
	}

	try {
		const ids = await discoverNativeModelIds(config);
		if (ids.length > 0) return { source: "live-native", models: await enrich(config, ids) };
	} catch {
		/* no luck */
	}

	throw new Error("Both endpoints failed");
}
```

### Non-Blocking Startup

Here's the key architectural decision: **pi startup should never be blocked by network I/O.**

I register from cache immediately (synchronous, never fails), then kick off live discovery in the background:

```typescript
// Register from cache immediately — pi startup is never blocked
const cache = await loadCache();
if (cache?.models?.length > 0) {
	registerProvider(pi, config, { source: "cache", models: cache.models });
}

// Background live discovery (non-blocking)
(async () => {
	const discovery = await discoverModels(config);
	registerProvider(pi, config, discovery);
})();
```

This means pi opens instantly with your last-known models, then silently refreshes when the live response comes in.

### Key Rotation

Some users run Ollama behind authenticated proxies with multiple API keys. I added automatic failover:

```typescript
async function tryWithKeyRotation(config: OllamaConfig, operation) {
	const keys = config.apiKeys ?? [config.apiKey];
	for (let i = 0; i < keys.length; i++) {
		try {
			return await operation(i);
		} catch (err) {
			if (!isAuthFailure(err) || i === keys.length - 1) throw err;
			// Auth failure — try next key
		}
	}
}
```

### Model Fixes

Ollama's `/api/show` metadata isn't always accurate. A model might claim vision support but fail on image input. I added a guided fix system:

- `/ollama-info` inspects a model's resolved capabilities
- `/ollama-fix` lets you override vision, reasoning, context window, thinking format
- Fixes persist as per-model overrides

You can also apply regex-based patterns (e.g., `.*qwen.*` → reasoning enabled) and global defaults.

---

## The Architecture: 800 Lines, Zero Dependencies

I kept it dependency-free (Node.js built-ins only). Here's the module map:

```
extensions/
├── index.ts         # Entry point — cache-first bootstrap
├── discovery.ts     # HTTP discovery + filtering
├── provider.ts      # Provider registration state
├── config.ts        # Config resolution chain
├── cache.ts         # Disk cache for offline fallback
├── overrides.ts     # Model override merge logic
├── commands.ts      # /ollama-setup, /ollama-refresh, etc.
├── setup-wizard.ts  # Interactive TUI
├── logger.ts        # Debug-log toggle
└── types.ts         # Shared TypeScript interfaces
```

**Why no build step?** pi runs extensions via `tsx`, so `.ts` files execute directly. `tsconfig.json` is only for CI type-checking.

**Why zero runtime dependencies?** pi extensions execute in the user's Node process. Every dependency is supply-chain risk. Only dev tools ship: `tsx`, `c8`, `prettier`, `@types/node`.

---

## The Test Strategy

I used Node's native `node:test` + `node:assert` — zero config:

```bash
npx tsx --test test/*.test.ts
```

Key tests:

- HTTP mocking for discovery without a running Ollama
- Config resolution priority chain
- Override merge precedence
- Cache TTL boundary conditions

---

## Lessons Learned

1. **Design for failure** — every `await` is wrapped in try/catch that degrades gracefully
2. **Cache is a requirement, not a luxury** — network hiccups shouldn't break your workflow
3. **Interactive UX beats config files** — `/ollama-setup` gets 10× more usage than manual JSON editing
4. **Keep the API surface tiny** — you need `fetch`, `JSON.parse`, and a clean async mental model

---

## Try It

```bash
# One-command install
pi install npm:@jamesjfoong/pi-ollama

# Or test drive without installing
pi -e npm:@jamesjfoong/pi-ollama
```

Then inside pi:

- `/ollama-status` — see what's loaded
- `/ollama-setup` — configure your endpoint
- `/ollama-refresh` — re-discover without restarting

---

## What's Next

- **Team model sharing:** Sync model overrides across a team
- **Usage analytics:** Track which models get used most (local only, no telemetry)
- **Model recommendations:** Suggest models based on task type

If this saves you time, [sponsoring the project](https://github.com/sponsors/jamesjfoong) helps me justify more hours on it. Or star the repo — that's free and also appreciated.

**Repo:** https://github.com/jamesjfoong/pi-ollama  
**Package:** https://pi.dev/packages/@jamesjfoong/pi-ollama
