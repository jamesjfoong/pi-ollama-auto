import assert from "node:assert";
import { describe, it } from "node:test";
import { contextBucket, extractContextLength, quickBadges } from "../extensions/enrich";

describe("enrich", () => {
	describe("extractContextLength", () => {
		it("extracts from model_info keys ending in .context_length", () => {
			const info = {
				"llama.context_length": 8192,
				"llama.foo": "ignore",
			};
			assert.strictEqual(extractContextLength(info), 8192);
		});

		it("returns default when no context_length key exists", () => {
			assert.strictEqual(extractContextLength({}), 128_000);
		});

		it("ignores zero or negative values", () => {
			const info = { "x.context_length": -1 };
			assert.strictEqual(extractContextLength(info), 128_000);
		});
	});

	describe("contextBucket", () => {
		it("classifies short contexts", () => {
			assert.strictEqual(contextBucket(4_096), "short");
		});

		it("classifies standard contexts", () => {
			assert.strictEqual(contextBucket(8_192), "standard");
			assert.strictEqual(contextBucket(31_999), "standard");
		});

		it("classifies long contexts", () => {
			assert.strictEqual(contextBucket(32_000), "long");
			assert.strictEqual(contextBucket(127_999), "long");
		});

		it("classifies massive contexts", () => {
			assert.strictEqual(contextBucket(128_000), "massive");
			assert.strictEqual(contextBucket(200_000), "massive");
		});
	});

	describe("quickBadges", () => {
		it("detects vision models by name", () => {
			assert.ok(quickBadges("llava:latest").includes("👁️"));
			assert.ok(quickBadges("gemma3:4b").includes("👁️"));
		});

		it("detects reasoning models by name", () => {
			assert.ok(quickBadges("deepseek-r1:32b").includes("🧠"));
			assert.ok(quickBadges("qwq:32b").includes("🧠"));
		});

		it("detects code models by name", () => {
			assert.ok(quickBadges("qwen2.5-coder:7b").includes("💻"));
			assert.ok(quickBadges("codellama:13b").includes("💻"));
		});

		it("detects embedding models by name", () => {
			assert.ok(quickBadges("nomic-embed-text").includes("📊"));
			assert.ok(quickBadges("mxbai-embed-large").includes("📊"));
		});

		it("detects tool-capable models by name", () => {
			assert.ok(quickBadges("llama3.2:latest").includes("🔧"));
			assert.ok(quickBadges("qwen2.5:72b").includes("🔧"));
		});

		it("returns empty for plain text models", () => {
			assert.deepStrictEqual(quickBadges("llama3.1:8b"), []);
		});
	});
});
