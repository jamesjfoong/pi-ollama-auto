import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import {
	getCurrentConfig,
	getLastDiscovered,
	getLastRefreshAt,
	getLastResult,
	registerProvider,
	setCurrentConfig,
} from "../extensions/provider";
import type { DiscoveredModel, DiscoveryResult, OllamaConfig } from "../extensions/types";

const makeConfig = (overrides: Partial<OllamaConfig> = {}): OllamaConfig => ({
	baseUrl: "http://localhost:11434",
	apiKey: "ollama",
	api: "openai-completions",
	compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
	authHeader: true,
	...overrides,
});

const makeModel = (overrides: Partial<DiscoveredModel> = {}): DiscoveredModel => ({
	id: "llama3:8b",
	name: "llama3:8b",
	reasoning: false,
	input: ["text"],
	contextWindow: 128000,
	maxTokens: 16384,
	...overrides,
});

const makeResult = (overrides: Partial<DiscoveryResult> = {}): DiscoveryResult => ({
	source: "live-openai",
	models: [makeModel()],
	enrichment: { attempted: 1, succeeded: 1, failed: 0 },
	...overrides,
});

const makeMockPi = () => {
	const calls: { name: string; config: any }[] = [];
	return {
		calls,
		registerProvider(name: string, config: any) {
			calls.push({ name, config });
		},
		registerCommand() {},
		on() {},
	};
};

describe("provider", () => {
	beforeEach(() => setCurrentConfig(null as any));

	describe("setCurrentConfig / getCurrentConfig", () => {
		it("stores and retrieves config", () => {
			const config = makeConfig();
			setCurrentConfig(config);
			assert.strictEqual(getCurrentConfig(), config);
		});

		it("returns null before any config is set", () => {
			assert.strictEqual(getCurrentConfig(), null);
		});
	});

	describe("registerProvider", () => {
		it("registers ollama provider with filtered models", () => {
			const mock = makeMockPi();
			const config = makeConfig();
			const result = makeResult({
				models: [makeModel({ id: "llama3:8b" }), makeModel({ id: "nomic-embed-text" })],
			});

			registerProvider(mock, config, result);

			assert.strictEqual(mock.calls[0].name, "ollama");
			assert.strictEqual(mock.calls[0].config.models.length, 1);
			assert.strictEqual(mock.calls[0].config.models[0].id, "llama3:8b");
		});

		it("applies custom filter regex", () => {
			const mock = makeMockPi();
			const config = makeConfig({ filter: "llama" });
			const result = makeResult({
				models: [makeModel({ id: "llama3:8b" }), makeModel({ id: "qwen2:7b" })],
			});

			registerProvider(mock, config, result);

			assert.strictEqual(mock.calls[0].config.models.length, 1);
			assert.strictEqual(mock.calls[0].config.models[0].id, "llama3:8b");
		});

		it("passes config fields to provider", () => {
			const mock = makeMockPi();
			const config = makeConfig({ baseUrl: "http://test", apiKey: "key1" });

			registerProvider(mock, config, makeResult());

			assert.strictEqual(mock.calls[0].config.baseUrl, "http://test");
			assert.strictEqual(mock.calls[0].config.apiKey, "key1");
		});

		it("applies defaults for zero contextWindow/maxTokens", () => {
			const mock = makeMockPi();
			const config = makeConfig();
			const result = makeResult({
				models: [makeModel({ contextWindow: 0, maxTokens: 0 })],
			});

			registerProvider(mock, config, result);

			assert.strictEqual(mock.calls[0].config.models[0].contextWindow, 128000);
			assert.strictEqual(mock.calls[0].config.models[0].maxTokens, 16384);
		});

		it("sets cost to zero", () => {
			const mock = makeMockPi();
			registerProvider(mock, makeConfig(), makeResult());

			assert.deepStrictEqual(mock.calls[0].config.models[0].cost, {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
			});
		});

		it("applies model overrides before provider registration", () => {
			const mock = makeMockPi();
			const config = makeConfig({
				modelOverrides: {
					"llama3:8b": {
						reasoning: true,
						input: ["text", "image"],
						compat: { thinkingFormat: "qwen-chat-template" },
						thinkingLevelMap: { xhigh: "max" },
					},
				},
			});

			registerProvider(mock, config, makeResult());

			assert.strictEqual(mock.calls[0].config.models[0].reasoning, true);
			assert.deepStrictEqual(mock.calls[0].config.models[0].input, ["text", "image"]);
			assert.deepStrictEqual(mock.calls[0].config.models[0].compat, {
				thinkingFormat: "qwen-chat-template",
			});
			assert.deepStrictEqual(mock.calls[0].config.models[0].thinkingLevelMap, {
				xhigh: "max",
			});
		});

		it("falls back to config-level sampling params when the model has none", () => {
			const mock = makeMockPi();
			const config = makeConfig({
				topP: 0.9,
				topK: 40,
				repeatPenalty: 1.1,
				minP: 0.05,
				presencePenalty: -0.5,
				frequencyPenalty: 0.5,
				seed: 42,
			});

			registerProvider(mock, config, makeResult());

			const registered = mock.calls[0].config.models[0];
			assert.strictEqual(registered.topP, 0.9);
			assert.strictEqual(registered.topK, 40);
			assert.strictEqual(registered.repeatPenalty, 1.1);
			assert.strictEqual(registered.minP, 0.05);
			assert.strictEqual(registered.presencePenalty, -0.5);
			assert.strictEqual(registered.frequencyPenalty, 0.5);
			assert.strictEqual(registered.seed, 42);
		});

		it("prefers a per-model sampling param override over the config-level fallback", () => {
			const mock = makeMockPi();
			const config = makeConfig({
				topP: 0.9,
				modelOverrides: { "llama3:8b": { topP: 0.5 } },
			});

			registerProvider(mock, config, makeResult());

			assert.strictEqual(mock.calls[0].config.models[0].topP, 0.5);
		});

		it("omits sampling params entirely when neither model nor config sets them", () => {
			const mock = makeMockPi();
			registerProvider(mock, makeConfig(), makeResult());

			const registered = mock.calls[0].config.models[0];
			assert.strictEqual(registered.topP, undefined);
			assert.strictEqual(registered.seed, undefined);
		});
	});

	describe("getLastDiscovered / getLastResult", () => {
		it("returns filtered models after registration", () => {
			const mock = makeMockPi();
			registerProvider(
				mock,
				makeConfig(),
				makeResult({
					models: [makeModel({ id: "a" }), makeModel({ id: "nomic-embed" })],
				}),
			);

			assert.strictEqual(getLastDiscovered().length, 1);
			assert.strictEqual(getLastDiscovered()[0].id, "a");
		});

		it("getLastResult preserves enrichment and source", () => {
			const mock = makeMockPi();
			registerProvider(
				mock,
				makeConfig(),
				makeResult({
					source: "live-native",
					enrichment: { attempted: 3, succeeded: 2, failed: 1 },
				}),
			);

			const r = getLastResult()!;
			assert.strictEqual(r.source, "live-native");
			assert.strictEqual(r.enrichment.succeeded, 2);
		});
	});

	describe("getLastRefreshAt", () => {
		it("is updated after registration", () => {
			const mock = makeMockPi();
			const before = getLastRefreshAt();
			registerProvider(mock, makeConfig(), makeResult());
			assert.ok(getLastRefreshAt() >= before);
		});
	});
});
