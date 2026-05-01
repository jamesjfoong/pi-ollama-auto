# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-05-01

### Added

- Project rename and packaging under `pi-ollama`
- Ollama model discovery via `/v1/models` with `/api/tags` fallback
- Metadata enrichment via `/api/show` (context length, vision/thinking capability mapping)
- Cache-backed model fallback:
  - cache file: `~/.pi/agent/cache/pi-ollama-models.json`
  - TTL controls: `OLLAMA_CACHE_TTL_MS`, `OLLAMA_CACHE_TTL_MIN`
  - stale/fresh cache source reporting
- Runtime commands:
  - `/ollama-setup`
  - `/ollama-refresh`
  - `/ollama-status`
  - `/ollama-doctor`
- Config persistence at `~/.pi/agent/pi-ollama.json`
- Developer docs and basic CI/test/typecheck wiring

### Notes

- This release is the baseline public versioning restart.
- npm publish is intentionally deferred pending additional validation.
