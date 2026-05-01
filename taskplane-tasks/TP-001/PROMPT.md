# TP-001 — Make `pi-ollama` stand out vs existing Ollama Pi extensions

## Context

We are building `pi-ollama` (formerly `pi-ollama-auto`) as an open-source Pi extension package.

There are existing packages in the ecosystem:

- `@0xkobold/pi-ollama` (cloud + local, model metadata + management)
- `pi-ollama-keyring` (multi-key rotation + persistent key-pool management)

`pi-ollama` should remain focused on **best-in-class auto-discovery UX + reliability + diagnostics**, while staying compatible with both local and cloud Ollama endpoints.

## Primary Goal

Ship a production-grade `pi-ollama` that is clearly differentiated by:

1. best setup UX,
2. resilient offline/cache behavior,
3. rich diagnostics,
4. accurate model metadata enrichment,
5. safe migration/backward compatibility.

---

## Required Workstreams

### 1) Rename / Branding consistency (done-in-code validation)

- Ensure package identity is consistently `pi-ollama`:
  - `package.json` name
  - README title and install examples
  - log prefix strings (`[pi-ollama]`)
  - persisted config path naming (`~/.pi/agent/pi-ollama.json`)
- Confirm no stale `pi-ollama-auto` references remain.

### 2) Metadata enrichment via `/api/show`

Implement enrichment after base discovery (`/v1/models` fallback `/api/tags`):

- derive `contextWindow` from `model_info.*.context_length`
- set `input` to include `image` if vision capability present
- set `reasoning=true` if thinking capability present
- enrich per model with best-effort semantics:
  - failures must not abort full registration
  - failed models keep default metadata
- track enrichment metrics:
  - total attempted
  - succeeded
  - failed

### 3) Cache + offline resilience

Implement cache file:

- path: `~/.pi/agent/cache/pi-ollama-models.json`
- include:
  - `baseUrl`
  - timestamp
  - registered/enriched model records
  - enrichment stats
  - source marker

Behavior:

- default TTL: 15 minutes
- env override support (document in README)
- on network failure:
  - use cache if available (fresh OR stale) with warning + staleness indicator
  - if no cache available, fail gracefully (no crash)

### 4) Operator diagnostics command

Add `/ollama-doctor` command with actionable output:

- endpoint/baseUrl
- reachability test result (HTTP status / timeout / auth failure)
- discovery source (live vs cache)
- cache state (exists, age, stale/fresh)
- model count
- enrichment summary
- active filter and compat flags

Must work in online and offline scenarios.

### 5) Upgrade `/ollama-status`

Enhance to show:

- endpoint
- current source (live/cache)
- cache age
- model count
- filter summary
- last refresh result snapshot

### 6) Keep existing UX stable

Must preserve:

- `/ollama-setup`
- `/ollama-refresh`
- `/ollama-status`

No breaking config precedence changes:

1. env vars
2. persisted config file
3. `~/.pi/agent/models.json` fallback
4. defaults

### 7) README / docs upgrade

Add or update sections:

- Why `pi-ollama` (differentiation)
- Feature comparison highlights (without attacking other packages)
- Offline/cache behavior
- `/ollama-doctor` usage
- New env vars / cache settings
- Troubleshooting matrix (auth, timeout, endpoint path, stale cache)
- Future compatibility note with keyring/rotation ecosystems

### 8) Quality + safety

- avoid heavy dependencies (prefer built-ins)
- strong defensive parsing for API payloads
- timeouts on all network calls
- never log raw secrets
- no unhandled promise rejections
- keep diffs modular (config/discovery/cache/commands/logger)

---

## Success Metrics

### Functional

1. Online discovery success: registers >=1 model when endpoint has models.
2. Enrichment coverage: >=80% enrichment success in healthy conditions.
3. Offline resilience: cached runs still register models when upstream is down.
4. Commands reliability: `/ollama-setup`, `/ollama-refresh`, `/ollama-status`, `/ollama-doctor` execute without crash in online/offline states.

### UX

1. Operator can identify root cause (auth vs timeout vs empty vs cache fallback) in <30s using `/ollama-doctor`.
2. First-time setup works without manual JSON editing.

### Regression

1. Existing users of refresh/status flow are not broken.
2. Startup does not hard-fail when Ollama is unreachable.

---

## Manual Validation Checklist

### A) Healthy endpoint

- start Pi with extension
- run `/ollama-status`
- run `/ollama-refresh`
- run `/ollama-doctor`
- verify model count + enrichment metrics visible

### B) Cloud endpoint with auth

- test with remote endpoint + auth header
- verify path handling and auth diagnostics

### C) Offline with cache

- warm cache
- disable endpoint
- restart/run refresh
- verify cached models loaded + warning shown

### D) Offline without cache

- remove cache
- keep endpoint offline
- verify graceful degraded state + clear doctor output

### E) Filter

- apply filter regex
- verify filtered registration and status/doctor reporting

---

## Deliverables

1. Code changes implementing all required workstreams.
2. Updated docs/README.
3. Test evidence summary (A–E) in final report.
4. Short release notes draft for next tag (no npm publish in this task).
