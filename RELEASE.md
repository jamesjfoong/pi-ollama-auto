# Release Process

Use this checklist for every `@jamesjfoong/pi-ollama` release.

## 1. Validate locally

```bash
npm run format:check
npm run typecheck
npm run test
npm run test:coverage
```

## 2. Smoke test in pi

With local Ollama running:

```bash
pi -e ./extensions --list-models ollama
```

Then test interactively:

```bash
pi -e ./extensions
```

Inside pi, verify:

- `/ollama-status` shows discovered models
- `/ollama-refresh` updates the model list
- `/ollama-setup` persists config and re-registers provider
- `/ollama-doctor` reports endpoint/cache/enrichment state
- `/ollama-info` shows model capabilities

## 3. Update release metadata

- Update `CHANGELOG.md`
- Bump `package.json` version
- Confirm README install instructions point to `npm:@jamesjfoong/pi-ollama`
- If gallery media changed, confirm `package.json` `pi.image` or `pi.video` points to a public URL

## 4. Dry-run npm publish

```bash
npm publish --dry-run
```

Check tarball contents for secrets, local files, or oversized artifacts.

## 5. Publish

Use an npm granular access token with publish permission and 2FA bypass, or pass a current OTP.

```bash
npm publish --access public
```

## 6. Tag and push

```bash
git tag v$(node -p "require('./package.json').version")
git push origin main --tags
```

## 7. Verify

```bash
npm view @jamesjfoong/pi-ollama version
pi install npm:@jamesjfoong/pi-ollama
```

Then confirm the listing at:

- https://www.npmjs.com/package/@jamesjfoong/pi-ollama
- https://pi.dev/packages/@jamesjfoong/pi-ollama

## Security note

Never paste long-lived npm tokens into chats, issues, or logs. If a token is exposed, revoke it immediately at:

https://www.npmjs.com/settings/jamesjfoong/tokens
