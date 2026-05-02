I got tired of editing models.json every time I pulled a new Ollama model 🫠

So I built pi-ollama — a zero-config pi extension that auto-discovers your Ollama models on startup.

No restart. No JSON editing. Just install and go.

Here's the thing: Ollama has two APIs (OpenAI-compat and native), some need auth, some don't, and the metadata isn't always accurate. So the extension handles discovery, key rotation, caching for offline fallback, and even guided model capability fixes.

Built it in ~800 lines of TypeScript with zero runtime dependencies. No build step needed — pi runs .ts files directly.

Try it:

```bash
pi install npm:@jamesjfoong/pi-ollama
```

Or test drive:

```bash
pi -e npm:@jamesjfoong/pi-ollama
```

Then in pi:
• /ollama-status — see discovered models
• /ollama-setup — interactive endpoint config
• /ollama-refresh — update without restart
• /ollama-fix — correct model capabilities when metadata is wrong

Full write-up coming soon. Repo link in bio 🔗

#ollama #pi #codingagent #localai #programming #typescript
