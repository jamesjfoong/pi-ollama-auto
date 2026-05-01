# Release Notes — v1.0.0

`pi-ollama` baseline release.

## Highlights

- Clean package identity: **pi-ollama**
- Dynamic model discovery for local/cloud Ollama endpoints
- Metadata enrichment via `/api/show`
- Cache + offline fallback support
- Diagnostics command: `/ollama-doctor`

## Install (git tag)

```bash
pi install git:github.com/jamesjfoong/pi-ollama@v1.0.0
```

Or test without installing:

```bash
pi -e git:github.com/jamesjfoong/pi-ollama@v1.0.0
```

## Commands

- `/ollama-setup`
- `/ollama-refresh`
- `/ollama-status`
- `/ollama-doctor`

## Notes

- npm publishing is intentionally deferred.
