# TP-001 Status — `pi-ollama`

## Objective

Make `pi-ollama` stand out as a production-grade Pi Ollama extension with superior setup UX, metadata quality, and reliability.

## Current State

- [x] Project renamed locally: `pi-ollama-auto` → `pi-ollama`
- [x] Package name updated to `pi-ollama`
- [x] GitHub remote updated to `github.com/jamesjfoong/pi-ollama`
- [x] Task packet created: `PROMPT.md`
- [x] This status file created

## Planned Implementation Work

- [ ] Metadata enrichment via `/api/show`
- [ ] Cache layer with TTL + stale fallback
- [ ] `/ollama-doctor` command
- [ ] Enhanced `/ollama-status`
- [ ] README upgrade (positioning + troubleshooting + cache behavior)
- [ ] Manual validation scenarios A–E

## Risks / Notes

- Existing ecosystem packages already cover key rotation and broad model management.
- Differentiation target for `pi-ollama`: best setup UX + diagnostics + resilience.

## Success Metrics Snapshot

- [ ] Online discovery works and registers models
- [ ] Enrichment coverage acceptable under healthy endpoint
- [ ] Offline fallback from cache works
- [ ] Commands do not crash online/offline

## Last Updated

- 2026-05-01
