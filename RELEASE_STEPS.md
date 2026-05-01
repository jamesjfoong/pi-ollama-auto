# Release Steps (Reset to v1.0.0, No npm publish)

## Pre-flight

```bash
cd /home/james/pi-ollama
npm ci
npm run typecheck
npm run format:check
npm test
```

## Commit release artifacts

```bash
git add -A
git commit -m "chore: reset versioning baseline to v1.0.0 and fix formatting"
git push origin main
```

## Remove old tags/releases (v1.1.x)

```bash
gh release delete v1.1.1 -y || true
gh release delete v1.1.0 -y || true
git push origin :refs/tags/v1.1.1 || true
git push origin :refs/tags/v1.1.0 || true
git tag -d v1.1.1 || true
git tag -d v1.1.0 || true
```

## Create v1.0.0 tag + release

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 --title "v1.0.0" --notes-file RELEASE_NOTES_v1.0.0.md
```

## Verify install

```bash
pi -e git:github.com/jamesjfoong/pi-ollama@v1.0.0
```

## Important

- Do NOT run `npm publish` yet.
