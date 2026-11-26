import assert from "node:assert/strict";
import test from "node:test";
import { api, claudeSchema } from "../src/api.mjs";
import { sampleWorkspace } from "../public/demo.js";

const url = "http://localhost/api/ai";
const request = (body, headers = {}) => new Request(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});
const upstream = (result, extra = {}) => Response.json({
  model: "claude-opus-5-5",
  stop_reason: "end_turn",
  content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(result) }],
  ...extra,
});

test("keys are required and cross-origin requests are rejected before calling Claude", async () => {
  const unreachable = () => assert.fail("Claude must not be called");
  assert.equal((await api(request({ action: "connect" }), {}, unreachable)).status, 401);
  assert.equal((await api(request({ action: "connect" }, { Origin: "https://unrelated.example" }), { ANTHROPIC_API_KEY: "test-key" }, unreachable)).status, 403);
  assert.equal((await api(request({ action: "transcribe" }), { ANTHROPIC_API_KEY: "test-key" }, unreachable)).status, 400);
});

test("the key check lists models instead of spending tokens", async () => {
  const response = await api(request({ action: "connect" }, { "x-studyroom-key": "session-test" }), {}, async (target, options) => {
    assert.equal(target, "https://api.anthropic.com/v1/models?limit=1");
    assert.equal(options.headers["x-api-key"], "session-test");
    assert.ok(options.headers["anthropic-version"]);
    return Response.json({ data: [] });
  });
  assert.deepEqual(await response.json(), { status: "ready" });
});

test("the session key overrides the runtime key and grading uses structured output", async () => {
  const answer = { score: 75, strength: "Example", gap: "Explain recall", feedback: "Good start", followUp: "What changes after feedback?" };
  const response = await api(request({ action: "grade", attempt: { answer: "Recall", allowFollowUp: true } }, { "x-studyroom-key": "session-test" }),
    { ANTHROPIC_API_KEY: "runtime-test" }, async (target, options) => {
      assert.equal(target, "https://api.anthropic.com/v1/messages");
      assert.equal(options.headers["x-api-key"], "session-test");
      assert.equal(options.headers["anthropic-beta"], "server-side-fallback-2026-07-01");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "claude-opus-5-5");
      assert.equal(body.fallbacks, "default");
      assert.equal(body.output_config.effort, "low");
      assert.equal(body.output_config.format.type, "json_schema");
      assert.equal(body.output_config.format.schema.additionalProperties, false);
      assert.ok(!JSON.stringify(body.output_config.format.schema).includes("minimum"));
      assert.equal(body.temperature, undefined);
      assert.match(body.messages[0].content[0].text, /Recall/);
      return upstream(answer);
    });
  assert.deepEqual(await response.json(), answer);
});

test("a study pack sends sources as documents, clears inaccurate excerpts, and rejects unknown source IDs", async () => {
  const { sources, pack, board } = sampleWorkspace();
  const output = { notes: pack.notes, topics: board, oral: pack.oral, written: pack.written, quiz: pack.quiz };
  output.notes[0].reference = { ...output.notes[0].reference, excerpt: "An invented quote", page: 7 };
  const make = () => api(request({ action: "bundle", sources }), { ANTHROPIC_API_KEY: "test" }, async (_, options) => {
    const [document] = JSON.parse(options.body).messages[0].content;
    assert.equal(document.type, "document");
    assert.equal(document.source.type, "text");
    assert.equal(document.context, "Source ID: " + sources[0].id);
    return upstream(output);
  });
  const result = await make();
  assert.equal(result.status, 200);
  const json = await result.json();
  assert.equal(json.notes[0].reference.excerpt, "");
  assert.equal(json.notes[0].reference.page, 0);
  output.notes[0].reference.sourceId = "unknown";
  assert.equal((await make()).status, 502);
});

test("an overloaded API is retried once and Claude's own error text is passed through", async (t) => {
  t.mock.method(console, "warn", () => {});
  t.mock.method(console, "error", () => {});
  const answer = { score: 60, strength: "Example", gap: "Example", feedback: "Example", followUp: "" };
  let calls = 0;
  const recovered = await api(request({ action: "grade", attempt: { answer: "Recall" } }), { ANTHROPIC_API_KEY: "test" }, async () => {
    calls += 1;
    return calls === 1 ? Response.json({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, { status: 529 }) : upstream(answer);
  }, { retryDelay: 0 });
  assert.equal(calls, 2);
  assert.deepEqual(await recovered.json(), answer);

  const broke = await api(request({ action: "grade", attempt: { answer: "Recall" } }), { ANTHROPIC_API_KEY: "test" },
    async () => Response.json({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low." } }, { status: 400 }), { retryDelay: 0 });
  assert.equal(broke.status, 400);
  assert.match((await broke.json()).error, /Claude said: Your credit balance is too low/);
});

test("refusals and cut-off answers become clear errors", async () => {
  const refused = await api(request({ action: "grade", attempt: { answer: "Recall" } }), { ANTHROPIC_API_KEY: "test" }, async () => upstream({}, { stop_reason: "refusal" }));
  assert.equal(refused.status, 502);
  assert.match((await refused.json()).error, /declined/);
  const cut = await api(request({ action: "grade", attempt: { answer: "Recall" } }), { ANTHROPIC_API_KEY: "test" }, async () => upstream({}, { stop_reason: "max_tokens" }));
  assert.match((await cut.json()).error, /cut off/);
});

test("schemas sent to Claude drop constraints that structured outputs reject", () => {
  const schema = claudeSchema({ type: "object", properties: { items: { type: "array", minItems: 2, maxItems: 3, items: { type: "integer", minimum: 0, maximum: 3 } } }, required: ["items"] });
  assert.deepEqual(schema, { type: "object", properties: { items: { type: "array", items: { type: "integer" } } }, required: ["items"], additionalProperties: false });
});
