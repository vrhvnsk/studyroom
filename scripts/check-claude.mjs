// Checks each Claude path Studyroom uses, with a real key, without printing the key.
// Usage: npm run check   (reads ANTHROPIC_API_KEY from the environment or .env, otherwise asks for it)
import { createInterface } from "node:readline/promises";
import { api } from "../src/api.mjs";
import { sampleWorkspace } from "../public/demo.js";

let key = process.env.ANTHROPIC_API_KEY?.trim();
if (!key) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  key = (await prompt.question("Paste your Anthropic API key and press Enter: ")).trim();
  prompt.close();
  process.stdout.write("\x1b[1A\x1b[2K");
}
if (!key) { console.log("No key entered."); process.exit(1); }

const env = { ...process.env, ANTHROPIC_API_KEY: key };
const { pack } = sampleWorkspace();
const call = (body) => api(new Request("http://localhost/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env);
const step = async (label, run) => {
  const started = Date.now();
  process.stdout.write(label + " … ");
  try {
    const detail = await run();
    console.log("OK (" + (Date.now() - started) + " ms)" + (detail ? " " + detail : ""));
  } catch (error) {
    console.log("FAILED (" + (Date.now() - started) + " ms) " + error.message);
  }
};
const expectOk = async (response) => {
  const body = await response.json();
  if (!response.ok) throw new Error("HTTP " + response.status + ": " + body.error);
  return body;
};

console.log("Studyroom Anthropic API check (" + (env.CLAUDE_MODEL || "claude-opus-5-5") + ")\n");
await step("1. Key check", async () => { await expectOk(await call({ action: "connect" })); });
await step("2. Grading an answer", async () => {
  const question = pack.oral[0];
  const body = await expectOk(await call({ action: "grade", attempt: { mode: "oral", question: question.prompt, modelAnswer: question.answer, rubric: question.rubric, answer: "Linking it to what I already know gives more cues to recall it.", allowFollowUp: false } }));
  return "score " + body.score;
});
await step("3. Examiner's opening line (game-show host)", async () => {
  const body = await expectOk(await call({ action: "examine", persona: "quizmaster", event: "start", index: 0, questions: pack.oral.map(({ topic, prompt, answer, rubric }) => ({ topic, prompt, answer, rubric })) }));
  return "[" + body.language + "] \"" + body.say + "\"";
});
console.log("\nSpeaking and listening run in the browser, so try a spoken exam in Chrome or Edge to check those.");
