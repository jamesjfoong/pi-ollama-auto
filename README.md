# pi-ollama

Auto-discover and register Ollama models in [pi](https://pi.dev). No more hand-editing `models.json`.

Whenever you `ollama pull` a new model, it shows up in `/model` automatically — no restart, no JSON editing.

## Install

```bash
pi install git:github.com/jamesjfoong/pi-ollama@main
```

Or test drive without installing:

```bash
pi -e git:github.com/jamesjfoong/pi-ollama@main
```

## What it does

1. **On startup** — fetches the list of models from your Ollama instance via the OpenAI-compatible `/v1/models` endpoint (falls back to Ollama native `/api/tags`)
2. **Registers them** as the `ollama` provider in pi, overriding any static `models.json` entry
3. **Skips embedding models** by default (`/embed/i` filter)
4. **Enriches model metadata** with `/api/show` when available (context length, vision, thinking)
5. **Caches discovery results** for offline/stale fallback resilience
6. **Notifies you** in the TUI once models are ready (or warns if Ollama is offline)

## Positioning in the ecosystem

`pi-ollama` is designed to be **complementary** to other Ollama Pi packages:

- [`pi-ollama-keyring`](https://pi.dev/packages/pi-ollama-keyring?name=pi-ollama): focuses on multi-key rotation and persistent key-pool management.
- [`@0xkobold/pi-ollama`](https://pi.dev/packages/@0xkobold/pi-ollama?name=pi-ollama): focuses on unified cloud+local model management and rich model tooling.

`pi-ollama` focuses on:

1. **Fast setup UX** (`/ollama-setup`)
2. **Resilient discovery** (live + cache fallback)
3. **Operational diagnostics** (`/ollama-doctor`)
4. **Drop-in migration** from manual `models.json`

## Commands

| Command           | What it does                                               |
| ----------------- | ---------------------------------------------------------- |
| `/ollama-setup`   | Interactive TUI setup — edit endpoint, key, filter, etc.   |
| `/ollama-refresh` | Re-fetch models from Ollama without restarting pi          |
| `/ollama-status`  | Show endpoint, source (live/cache), model count, cache age |
| `/ollama-doctor`  | Diagnose endpoint/auth/cache/enrichment state              |

## Configuration

Priority: **env vars** → **persisted config file** → **existing `models.json` fallback** → **defaults**

The easiest way to configure is `/ollama-setup` — no need to set environment variables or edit JSON.

### `/ollama-setup` (interactive)

Run `/ollama-setup` inside pi for a keyboard-driven config dialog:

```
> Base URL     : https://ollama.com/v1
  API Key      : your-key
> Auth header  : on
  Filter regex : (none)
  Test connection
  Save & discover
  Cancel
```

- **↑↓** navigate fields
- **Enter** to edit a field (or toggle, test, save)
- **Esc** to cancel
- After editing, **Enter** confirms, **Esc** discards
- "Test connection" verifies the endpoint before saving

Settings are saved to `~/.pi/agent/pi-ollama.json`.

### Persistent config file

Settings are saved to `~/.pi/agent/pi-ollama.json`:

```json
{
	"baseUrl": "https://ollama.com/v1",
	"apiKey": "your-key",
	"authHeader": true,
	"filter": ""
}
```

This file is auto-created and updated by `/ollama-setup`. You can also edit it directly.

### Environment variables

| Variable               | Default                  | Description                                           |
| ---------------------- | ------------------------ | ----------------------------------------------------- |
| `OLLAMA_BASE_URL`      | `http://localhost:11434` | Ollama API endpoint (with or without `/v1`)           |
| `OLLAMA_API_KEY`       | `ollama`                 | API key or env-var name. Ollama usually ignores this. |
| `OLLAMA_API`           | `openai-completions`     | API type used by pi                                   |
| `OLLAMA_FILTER`        | _(none)_                 | Regex to whitelist models (e.g. `llama\|qwen`)        |
| `OLLAMA_CACHE_TTL_MS`  | `900000`                 | Cache TTL in milliseconds                             |
| `OLLAMA_CACHE_TTL_MIN` | _(none)_                 | Cache TTL in minutes (used if `*_MS` not set)         |

**Tip:** If you already have an `ollama` provider in `~/.pi/agent/models.json`, this extension reads `baseUrl`, `apiKey`, `api`, and `compat` from it as a fallback. You can remove the static `models` array from `models.json`.

### Examples

**Local Ollama (default):**

```bash
# nothing to set
pi
```

**Remote / cloud Ollama:**

```bash
OLLAMA_BASE_URL=https://ollama.com/v1 \
OLLAMA_API_KEY=your-api-key \
pi
```

**Only keep llama and qwen models:**

```bash
OLLAMA_FILTER="llama|qwen" pi
```

## Migration from `models.json`

If your `models.json` looks like this:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "apiKey": "ollama",
      "api": "openai-completions",
      "compat": { ... },
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

You can replace it with:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "apiKey": "ollama",
      "api": "openai-completions",
      "compat": { ... }
    }
  }
}
```

Then install `pi-ollama` and the models array is managed automatically.

## How it works

```
pi starts
    │
    ├─► extension fetches /v1/models  (OpenAI-compat)
    │   └─► fallback to /api/tags   (Ollama native)
    │
    ├─► registers provider "ollama" with discovered models
    │
    └─► models available in /model, --list-models, Ctrl+P
```

## Compatibility

- **Local Ollama** (`http://localhost:11434`) — works out of the box
- **Remote Ollama endpoints** (authenticated or unauthenticated) — set `OLLAMA_BASE_URL`
- **OpenAI-compatible proxies** in front of Ollama — `OLLAMA_API=openai-completions`

## Uninstall

```bash
pi remove git:github.com/jamesjfoong/pi-ollama
```

## License

MIT
