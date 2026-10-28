import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dispatchAnswerPings } from "./answer-pings";

const shared = {
  WEBHOOK_KEY_HEADER: "X-API-Key",
  WEBHOOK_KEY_SCHEME: "raw",
};

describe("send all answers by source", () => {
  it("pings only the sources that have answered rows", async () => {
    const calls: { url: string; body: string; header: string }[] = [];
    const result = await dispatchAnswerPings({
      production: true,
      env: {
        ...shared,
        ANSWERS_WEBHOOK_URL: "https://example.invalid/zip",
        ANSWERS_WEBHOOK_KEY: "placeholder-key",
        LINKEDIN_ANSWERS_WEBHOOK_URL: "https://example.invalid/linkedin",
        LINKEDIN_ANSWERS_WEBHOOK_KEY: "placeholder-key",
      },
      questions: [
        { status: "Open", source: "" },
        { status: "Answered", source: "" },
        { status: "Answered", source: "LinkedIn" },
        { status: "Done", source: "LinkedIn" },
      ],
      fetchImpl: async (url, init) => {
        calls.push({
          url: String(url),
          body: String(init?.body ?? ""),
          header: new Headers(init?.headers).get("X-API-Key") ?? "",
        });
        return new Response(null, { status: 204 });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    const zip = calls.find((call) => call.url.includes("/zip"));
    const linkedIn = calls.find((call) => call.url.includes("/linkedin"));
    assert.ok(zip);
    assert.ok(linkedIn);
    assert.deepEqual(JSON.parse(zip.body), { action: "answers-ready", source: "hunter" });
    assert.deepEqual(JSON.parse(linkedIn.body), { action: "answers", source: "hunter" });
    assert.equal(zip.header, "placeholder-key");
    assert.equal(linkedIn.header, "placeholder-key");
    assert.equal(calls.every((call) => call.body.includes("placeholder-key")), false);
    assert.equal(calls.every((call) => call.body.includes("160000")), false);
  });

  it("does not call a webhook for a source with no answered rows", async () => {
    const urls: string[] = [];
    const result = await dispatchAnswerPings({
      env: {
        ANSWERS_WEBHOOK_URL: "https://example.invalid/zip",
        ANSWERS_WEBHOOK_KEY: "placeholder-key",
        LINKEDIN_ANSWERS_WEBHOOK_URL: "https://example.invalid/linkedin",
        LINKEDIN_ANSWERS_WEBHOOK_KEY: "placeholder-key",
      },
      questions: [
        { status: "Open", source: "LinkedIn" },
        { status: "Answered", source: "ZipRecruiter" },
      ],
      fetchImpl: async (url) => {
        urls.push(String(url));
        return new Response(null, { status: 204 });
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(urls, ["https://example.invalid/zip"]);
  });

  it("skips LinkedIn when those settings are missing and still sends ZipRecruiter", async () => {
    const urls: string[] = [];
    const result = await dispatchAnswerPings({
      env: {
        ANSWERS_WEBHOOK_URL: "https://example.invalid/zip",
        ANSWERS_WEBHOOK_KEY: "placeholder-key",
        LINKEDIN_ANSWERS_WEBHOOK_URL: "  ",
        LINKEDIN_ANSWERS_WEBHOOK_KEY: "",
      },
      questions: [
        { status: "Answered", source: "ZipRecruiter" },
        { status: "Answered", source: "LinkedIn" },
      ],
      fetchImpl: async (url) => {
        urls.push(String(url));
        return new Response(null, { status: 204 });
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(urls, ["https://example.invalid/zip"]);
  });

  it("does not call LinkedIn or fail when only LinkedIn rows are answered and it is not configured", async () => {
    const result = await dispatchAnswerPings({
      env: {
        ANSWERS_WEBHOOK_URL: "https://example.invalid/zip",
        ANSWERS_WEBHOOK_KEY: "placeholder-key",
      },
      questions: [{ status: "Answered", source: "LinkedIn" }],
      fetchImpl: async () => {
        throw new Error("No webhook should be called.");
      },
    });
    assert.equal(result.ok, true);
  });

  it("reports a failed call without failing the skipped source", async () => {
    const urls: string[] = [];
    const result = await dispatchAnswerPings({
      env: {
        ANSWERS_WEBHOOK_URL: "https://example.invalid/zip",
        ANSWERS_WEBHOOK_KEY: "placeholder-key",
        LINKEDIN_ANSWERS_WEBHOOK_URL: "https://example.invalid/linkedin",
        LINKEDIN_ANSWERS_WEBHOOK_KEY: "placeholder-key",
      },
      questions: [
        { status: "Answered", source: "" },
        { status: "Answered", source: "LinkedIn" },
      ],
      fetchImpl: async (url) => {
        urls.push(String(url));
        if (String(url).includes("linkedin")) return new Response("placeholder-key", { status: 500 });
        return new Response(null, { status: 204 });
      },
    });
    assert.equal(result.ok, false);
    assert.deepEqual(urls.sort(), ["https://example.invalid/linkedin", "https://example.invalid/zip"]);
  });
});
