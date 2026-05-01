# AGENTS.md

Guidance for contributors and coding agents working on `pi-ollama`.

## Project goal

Make Ollama model management in pi zero-maintenance by auto-discovering models and registering provider config dynamically.

## Scope

- Auto-discovery from OpenAI-compatible endpoint (`/v1/models`)
- Fallback discovery from native Ollama endpoint (`/api/tags`)
- Runtime commands (`/ollama-setup`, `/ollama-refresh`, `/ollama-status`)
- Safe config persistence (`~/.pi/agent/pi-ollama.json`)

## Coding rules

1. Keep the extension dependency-light (prefer Node built-ins only).
2. Preserve backward compatibility with existing `~/.pi/agent/models.json` fallback.
3. Never hardcode user secrets in code or docs.
4. Keep startup resilient: discovery failures should warn, not crash.
5. Keep diffs small and focused.

## Release policy

- Do **not** publish npm releases without explicit maintainer confirmation.
- Use git tags only after manual verification in real pi sessions.
- Update `package.json` version and `README.md` install instructions before tagging.

## Test checklist (manual)

- Extension loads in pi (`pi -e ...`)
- `/ollama-status` shows discovered models
- `/ollama-refresh` updates model list
- `/ollama-setup` persists config and re-registers provider
- Works with both local and remote Ollama endpoints
