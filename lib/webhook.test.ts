import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWebhookRequest } from "./webhook";

describe("webhook request", () => {
  it("sends the key as a bearer token and keeps it out of the body by default", () => {
    const built = buildWebhookRequest({
      url: "https://example.invalid/run",
      key: "placeholder-key",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.request.headers.Authorization, "Bearer placeholder-key");
    assert.equal(JSON.stringify(built.request.body).includes("placeholder-key"), false);
    assert.equal(built.request.body.action, "run-backlog");
  });

  it("can put the raw key in a named header", () => {
    const built = buildWebhookRequest({
      url: "https://example.invalid/run",
      key: "placeholder-key",
      header: "X-API-Key",
      scheme: "raw",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.request.headers["X-API-Key"], "placeholder-key");
    assert.equal(built.request.headers.Authorization, undefined);
  });

  it("can put the key in the JSON body instead of a header", () => {
    const built = buildWebhookRequest({
      url: "https://example.invalid/run",
      key: "placeholder-key",
      header: "none",
      bodyField: "key",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.request.headers.Authorization, undefined);
    assert.equal(built.request.body.key, "placeholder-key");
  });

  it("refuses a non-https URL in production and explains a missing setup", () => {
    const insecure = buildWebhookRequest({
      url: "http://example.invalid/run",
      key: "placeholder-key",
      production: true,
    });
    assert.equal(insecure.ok, false);

    const missing = buildWebhookRequest({ url: "", key: "" });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.message.includes("WEBHOOK_URL"), true);
    assert.equal(missing.message.includes("placeholder-key"), false);
  });
});
