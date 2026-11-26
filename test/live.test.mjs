import assert from "node:assert/strict";
import test from "node:test";
import { api, personas } from "../src/api.mjs";
import { sampleWorkspace } from "../public/demo.js";
import { createLiveTranscript, liveAttempt } from "../public/live-state.js";

const request = (body, headers = {}) => new Request("http://localhost/api/ai", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify({ action: "examine", ...body }),
});
const reply = (result) => Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(result) }] });
const { pack } = sampleWorkspace();
const questions = pack.oral.map(({ topic, prompt, answer, rubric }) => ({ topic, prompt, answer, rubric }));
const env = { ANTHROPIC_API_KEY: "test" };

test("the examiner gets the persona, the current and next question, and the conversation", async () => {
  const turns = [{ role: "examiner", text: "Why does recall help?" }, { role: "learner", text: "It strengthens memory." }];
  const response = await api(request({ persona: "professor", event: "reply", index: 1, questions, turns }), env, async (_, options) => {
    const body = JSON.parse(options.body);
    assert.ok(body.system.includes(personas.professor.style));
    assert.equal(body.output_config.effort, "low");
    const payload = JSON.parse(body.messages[0].content[0].text);
    assert.match(payload.instruction, /follow-up/);
    assert.equal(payload.currentQuestion.number, 2);
    assert.equal(payload.currentQuestion.referenceAnswer, questions[1].answer);
    assert.equal(payload.nextQuestion.question, questions[2].prompt);
    assert.equal(payload.followUpsAsked, 0);
    assert.deepEqual(payload.conversation, turns);
    return reply({ say: "Be precise. What exactly is strengthened?", advance: false, language: "en-US" });
  });
  assert.deepEqual(await response.json(), { say: "Be precise. What exactly is strengthened?", advance: false, language: "en-US" });
});

test("start and resume never advance, and the last question has no next question", async () => {
  const response = await api(request({ persona: "buddy", event: "start", index: 0, questions }), env, async () => reply({ say: "Hey! First one.", advance: true, language: "en" }));
  assert.equal((await response.json()).advance, false);
  await api(request({ persona: "buddy", event: "skip", index: 2, questions }), env, async (_, options) => {
    assert.equal(JSON.parse(JSON.parse(options.body).messages[0].content[0].text).nextQuestion, null);
    return reply({ say: "That's a wrap!", advance: true, language: "en" });
  });
});

test("examine requests are validated before calling Claude", async () => {
  const unreachable = () => assert.fail("Claude must not be called");
  assert.equal((await api(request({ persona: "pirate", event: "start", index: 0, questions }), env, unreachable)).status, 400);
  assert.equal((await api(request({ persona: "mentor", event: "dance", index: 0, questions }), env, unreachable)).status, 400);
  assert.equal((await api(request({ persona: "mentor", event: "start", index: 3, questions }), env, unreachable)).status, 400);
  assert.equal((await api(request({ persona: "mentor", event: "reply", index: 0, questions, turns: [{ role: "examiner", text: "Hi" }] }), env, unreachable)).status, 400);
  assert.equal((await api(request({ persona: "mentor", event: "start", index: 0, questions: [{ prompt: "Only a prompt" }] }), env, unreachable)).status, 400);
  assert.equal((await api(request({ persona: "mentor", event: "start", index: 0, questions }), {}, unreachable)).status, 401);
  const empty = await api(request({ persona: "mentor", event: "start", index: 0, questions }), env, async () => reply({ say: " ", advance: false, language: "en" }));
  assert.equal(empty.status, 502);
});

test("the model can be overridden and personas are listed without their prompts", async () => {
  const response = await api(request({ persona: "mentor", event: "start", index: 0, questions }), { ...env, CLAUDE_MODEL: "claude-sonnet-5-5" }, async (_, options) => {
    assert.equal(JSON.parse(options.body).model, "claude-sonnet-5-5");
    return reply({ say: "Hello.", advance: false, language: "en" });
  });
  assert.equal(response.status, 200);
  const config = await (await api(new Request("http://localhost/api/config"), env)).json();
  assert.equal(config.serverKey, true);
  assert.deepEqual(config.personas.map(({ id }) => id), Object.keys(personas));
  assert.ok(config.personas.every((persona) => !("style" in persona)));
});

test("transcripts merge by speaker and stay per question", () => {
  const transcript = createLiveTranscript(2);
  transcript.add(0, "examiner", "Why does");
  transcript.add(0, "examiner", "spacing help?");
  transcript.add(0, "learner", " It gives  time ");
  transcript.add(0, "learner", "to forget a little.");
  transcript.add(5, "learner", "ignored");
  assert.deepEqual(transcript.turns(0), [{ role: "examiner", text: "Why does spacing help?" }, { role: "learner", text: "It gives time to forget a little." }]);
  assert.equal(transcript.learnerText(0), "It gives time to forget a little.");
  assert.deepEqual(transcript.turns(1), []);
});

test("graded attempts keep the latest turns within the request limit", () => {
  const turns = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? "learner" : "examiner", text: String(index).repeat(3_000) }));
  const attempt = liveAttempt(pack.oral[0], turns);
  assert.equal(attempt.allowFollowUp, false);
  assert.ok(JSON.stringify(attempt).length < 30_000);
  assert.ok(attempt.conversation.at(-1).text === turns.at(-1).text.slice(0, 4_000), "the newest turn is kept and capped");
  assert.ok(attempt.conversation.length < turns.length, "the oldest turns are dropped");
});
