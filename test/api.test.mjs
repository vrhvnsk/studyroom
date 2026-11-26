import assert from "node:assert/strict";
import test from "node:test";
import { api } from "../src/api.mjs";
import { sampleWorkspace } from "../public/demo.js";

const url = "http://localhost/api/gemini";
const request = (body, headers = {}) => new Request(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});
const upstream = (result) => Response.json({
  candidates: [{ content: { parts: [{ thought: true, text: "internal" }, { text: JSON.stringify(result) }] } }],
});

test("keys are required and cross-origin requests are rejected before calling Gemini", async () => {
  const unreachable = () => assert.fail("Gemini must not be called");
  assert.equal((await api(request({ action: "connect" }), {}, unreachable)).status, 401);
  assert.equal((await api(request({ action: "connect" }, { Origin: "https://unrelated.example" }), { GEMINI_API_KEY: "test-key" }, unreachable)).status, 403);
});

test("the session key overrides the runtime key and structured feedback is returned", async () => {
  const answer = { score: 75, strength: "Example", gap: "Explain recall", feedback: "Good start", followUp: "What changes after feedback?" };
  const response = await api(request({ action: "grade", attempt: { answer: "Recall", allowFollowUp: true } }, { "x-studyroom-key": "session-test" }),
    { GEMINI_API_KEY: "runtime-test" }, async (url, options) => {
      assert.match(url, /gemini-3\.8-flash:generateContent$/);
      assert.equal(options.headers["x-goog-api-key"], "session-test");
      const body = JSON.parse(options.body);
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.match(body.contents[0].parts[0].text, /Recall/);
      return upstream(answer);
    });
  assert.deepEqual(await response.json(), answer);
});

test("a Gemini pack clears inaccurate text excerpts and rejects unknown source IDs", async () => {
  const { sources, pack, board } = sampleWorkspace();
  const output = { notes: pack.notes, topics: board, oral: pack.oral, written: pack.written, quiz: pack.quiz };
  output.notes[0].reference = { ...output.notes[0].reference, excerpt: "An invented quote", page: 7 };
  const make = () => api(request({ action: "bundle", sources }), { GEMINI_API_KEY: "test" }, async () => upstream(output));
  const result = await make();
  assert.equal(result.status, 200);
  const json = await result.json();
  assert.equal(json.notes[0].reference.excerpt, "");
  assert.equal(json.notes[0].reference.page, 0);
  output.notes[0].reference.sourceId = "unknown";
  assert.equal((await make()).status, 502);
});

test("a recording is forwarded with a Gemini-supported MIME type and returns its transcript", async () => {
  const response = await api(request({ action: "transcribe", mimeType: "audio/mp4", data: "dGVzdA==" }), { GEMINI_API_KEY: "test" }, async (_, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.contents[0].parts[0].inlineData, { mimeType: "audio/m4a", data: "dGVzdA==" });
    return upstream({ transcript: "This is a test." });
  });
  assert.deepEqual(await response.json(), { transcript: "This is a test." });
});
