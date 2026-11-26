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

const providerRequest = (provider, action, fields = {}, headers = {}) => new Request("http://localhost/api/ai", {
  method:"POST",
  headers:{ "Content-Type":"application/json", ...headers },
  body:JSON.stringify({ provider, action, ...fields }),
});

test("provider configuration returns model names and key availability only", async () => {
  const response = await api(new Request("http://localhost/api/config"), {
    AI_PROVIDER:"anthropic", ANTHROPIC_API_KEY:"server-secret", OPENAI_MODEL:"gpt-example",
  });
  const config = await response.json();
  assert.equal(config.defaultProvider, "anthropic");
  assert.deepEqual(config.providers.anthropic, { serverKey:true, model:"claude-haiku-5-5" });
  assert.deepEqual(config.providers.openai, { serverKey:false, model:"gpt-example" });
  assert.doesNotMatch(JSON.stringify(config), /server-secret/);
});

test("OpenAI receives only its own credentials and a strict schema for a PDF pack", async () => {
  const { sources, pack, board } = sampleWorkspace();
  const pdf = { id:sources[0].id, name:"material.pdf", type:"pdf", data:"JVBERi0=" };
  const output = { notes:pack.notes, topics:board, oral:pack.oral, written:pack.written, quiz:pack.quiz };
  const response = await api(providerRequest("openai", "bundle", { sources:[pdf] }, { "x-studyroom-key":"openai-session" }),
    { GEMINI_API_KEY:"gemini-key", OPENAI_API_KEY:"openai-server" }, async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.deepEqual(options.headers, { "Content-Type":"application/json", Authorization:"Bearer openai-session" });
      const body = JSON.parse(options.body);
      assert.equal(body.model, "gpt-6-luna");
      assert.equal(body.store, false);
      assert.deepEqual(body.input[0].content[1], { type:"input_file", filename:"material.pdf", file_data:"data:application/pdf;base64,JVBERi0=" });
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.properties.notes.items.additionalProperties, false);
      return Response.json({ status:"completed", output:[{ type:"message", content:[{ type:"output_text", text:JSON.stringify(output) }] }] });
    });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).notes.length, 3);
});

test("Anthropic messages use their own key, grade oral answers, and accept base64 PDFs", async () => {
  const grade = { score:81, strength:"Clear", gap:"Explain why", feedback:"Good start", followUp:"Can you give an example?" };
  let response = await api(providerRequest("anthropic", "grade", { attempt:{ answer:"Recall" } }),
    { ANTHROPIC_API_KEY:"claude-server" }, async (url, options) => {
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      assert.equal(options.headers["x-api-key"], "claude-server");
      assert.equal(options.headers["anthropic-version"], "2023-06-01");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "claude-haiku-5-5");
      assert.match(body.messages[0].content[0].text, /Recall/);
      assert.match(body.output_config.format.schema.properties.score.description, /0 to 100/);
      return Response.json({ stop_reason:"end_turn", content:[{ type:"text", text:JSON.stringify(grade) }] });
    });
  assert.deepEqual(await response.json(), grade);

  const { sources, pack, board } = sampleWorkspace();
  const source = { id:sources[0].id, name:"material.pdf", type:"pdf", data:"JVBERi0=" };
  response = await api(providerRequest("anthropic", "bundle", { sources:[source] }),
    { ANTHROPIC_API_KEY:"claude-server" }, async (_, { body }) => {
      assert.deepEqual(JSON.parse(body).messages[0].content[1], {
        type:"document", title:"material.pdf", source:{ type:"base64", media_type:"application/pdf", data:"JVBERi0=" },
      });
      return Response.json({ stop_reason:"end_turn", content:[{ type:"text", text:JSON.stringify({ notes:pack.notes, topics:board, oral:pack.oral, written:pack.written, quiz:pack.quiz }) }] });
    });
  assert.equal(response.status, 200);
});

test("OpenAI transcribes multipart audio and Claude rejects audio before any upstream call", async () => {
  const clip = { mimeType:"audio/webm", data:"dGVzdA==" };
  const response = await api(providerRequest("openai", "transcribe", clip), { OPENAI_API_KEY:"test" }, async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal(options.body.get("model"), "gpt-transcribe");
    assert.equal(options.body.get("file").name, "recording.webm");
    assert.equal(await options.body.get("file").text(), "test");
    return Response.json({ text:"Practice makes progress." });
  });
  assert.deepEqual(await response.json(), { transcript:"Practice makes progress." });
  assert.equal((await api(providerRequest("anthropic", "transcribe", clip), { ANTHROPIC_API_KEY:"test" }, () => assert.fail("No upstream audio request"))).status, 400);
});

test("unknown providers and mismatched server keys cannot make upstream requests", async () => {
  const noUpstream = () => assert.fail("No upstream request");
  assert.equal((await api(providerRequest("unlisted", "connect"), {}, noUpstream)).status, 400);
  assert.equal((await api(providerRequest("openai", "connect"), { GEMINI_API_KEY:"gemini-key" }, noUpstream)).status, 401);
});
