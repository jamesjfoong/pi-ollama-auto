import { describe, it } from "node:test";
import assert from "node:assert";
import { stripTrailingSlash, resolveBaseUrl, resolveApiKey, DEFAULTS } from "../extensions/config";

describe("config", () => {
	describe("stripTrailingSlash", () => {
		it("removes a single trailing slash", () => {
			assert.strictEqual(stripTrailingSlash("http://localhost/"), "http://localhost");
		});

		it("leaves slash-less URLs untouched", () => {
			assert.strictEqual(stripTrailingSlash("http://localhost"), "http://localhost");
		});

		it("removes only the last slash", () => {
			assert.strictEqual(stripTrailingSlash("http://localhost/v1/"), "http://localhost/v1");
		});
	});

	describe("resolveBaseUrl", () => {
		it("uses the default when input is undefined", () => {
			assert.strictEqual(resolveBaseUrl(undefined), DEFAULTS.baseUrl);
		});

		it("strips trailing slash from input", () => {
			assert.strictEqual(resolveBaseUrl("http://host:1234/"), "http://host:1234");
		});

		it("preserves path segments", () => {
			assert.strictEqual(resolveBaseUrl("http://host/api/v1"), "http://host/api/v1");
		});
	});

	describe("resolveApiKey", () => {
		it("uses the default when input is empty", () => {
			assert.strictEqual(resolveApiKey(undefined), DEFAULTS.apiKey);
		});

		it("returns literal key prefixed with !", () => {
			assert.strictEqual(resolveApiKey("!secret"), "!secret");
		});

		it("resolves env var when name matches", () => {
			process.env.TEST_API_KEY = "from-env";
			assert.strictEqual(resolveApiKey("TEST_API_KEY"), "from-env");
			delete process.env.TEST_API_KEY;
		});

		it("falls back to default when env var is empty", () => {
			process.env.EMPTY_KEY = "";
			assert.strictEqual(resolveApiKey("EMPTY_KEY"), DEFAULTS.apiKey);
			delete process.env.EMPTY_KEY;
		});

		it("returns literal value when no env var matches", () => {
			assert.strictEqual(resolveApiKey("hardcoded-key"), "hardcoded-key");
		});
	});
});
