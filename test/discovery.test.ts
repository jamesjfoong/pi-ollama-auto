import { describe, it } from "node:test";
import assert from "node:assert";
import { shouldInclude } from "../extensions/discovery";

describe("discovery", () => {
	describe("shouldInclude", () => {
		it("excludes embedding models by default", () => {
			assert.strictEqual(shouldInclude("nomic-embed-text"), false);
			assert.strictEqual(shouldInclude("mxbai-embed-large"), false);
			assert.strictEqual(shouldInclude("text-embedding-ada-002"), false);
		});

		it("includes non-embedding models", () => {
			assert.strictEqual(shouldInclude("llama3.1:8b"), true);
			assert.strictEqual(shouldInclude("qwen2.5-coder:7b"), true);
			assert.strictEqual(shouldInclude("mistral:latest"), true);
		});

		it("applies whitelist regex when provided", () => {
			assert.strictEqual(shouldInclude("llama3.1:8b", "llama"), true);
			assert.strictEqual(shouldInclude("qwen2.5:7b", "llama"), false);
		});

		it("ignores invalid regex and falls through", () => {
			assert.strictEqual(shouldInclude("llama3.1:8b", "[invalid"), true);
		});

		it("is case-insensitive for whitelist", () => {
			assert.strictEqual(shouldInclude("Llama3.1:8b", "llama"), true);
		});

		it("combines embed exclusion with whitelist", () => {
			assert.strictEqual(shouldInclude("nomic-embed-text", "embed"), false);
		});
	});
});
