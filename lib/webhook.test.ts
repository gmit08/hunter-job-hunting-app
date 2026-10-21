import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answersStatus, buildWebhookRequest, triggerAnswers } from "./webhook";

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

describe("POST /api/answers", () => {
  const configured = {
    ANSWERS_WEBHOOK_URL: "https://example.invalid/answers",
    ANSWERS_WEBHOOK_KEY: "placeholder-key",
  };

  it("pings with the backlog header pattern and sends no answer text", async () => {
    let seenBody = "";
    let seenHeader = "";
    const result = await triggerAnswers({
      production: true,
      env: {
        ...configured,
        WEBHOOK_KEY_HEADER: "X-API-Key",
        WEBHOOK_KEY_SCHEME: "raw",
      },
      fetchImpl: async (_url, init) => {
        seenBody = String(init?.body ?? "");
        seenHeader = new Headers(init?.headers).get("X-API-Key") ?? "";
        return new Response(null, { status: 204 });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(answersStatus(result), 200);
    assert.equal(seenHeader, "placeholder-key");
    assert.deepEqual(JSON.parse(seenBody), { action: "answers-ready", source: "hunter" });
    assert.equal(seenBody.includes("placeholder-key"), false);
    assert.equal(seenBody.includes("Type an answer"), false);
  });

  it("can place the key in the JSON body without adding answer text", () => {
    const built = buildWebhookRequest({
      url: "https://example.invalid/answers",
      key: "placeholder-key",
      header: "none",
      bodyField: "token",
      action: "answers-ready",
      source: "hunter",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.deepEqual(built.request.body, {
      action: "answers-ready",
      source: "hunter",
      token: "placeholder-key",
    });
    assert.equal("answer" in built.request.body, false);
  });

  it("returns a not-configured message and does not call the webhook", async () => {
    const result = await triggerAnswers({
      env: { ANSWERS_WEBHOOK_URL: "  ", ANSWERS_WEBHOOK_KEY: "" },
      fetchImpl: async () => {
        throw new Error("The webhook should not be called.");
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.unconfigured, true);
    assert.equal(answersStatus(result), 400);
    assert.equal(result.message.includes("ANSWERS_WEBHOOK_URL"), true);
    assert.equal(result.message.includes("ANSWERS_WEBHOOK_KEY"), true);
    assert.equal(result.message.includes("not set up yet"), true);
  });

  it("reports a failed ping without including a response body", async () => {
    const result = await triggerAnswers({
      env: configured,
      fetchImpl: async () => new Response("salary 160000", { status: 502 }),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.unconfigured, undefined);
    assert.equal(answersStatus(result), 502);
    assert.equal(result.message.includes("502"), true);
    assert.equal(result.message.includes("160000"), false);
  });
});
