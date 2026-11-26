import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const types = {
  "index.html": "text/html; charset=utf-8",
  "styles.css": "text/css; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
  "demo.js": "text/javascript; charset=utf-8",
  "storage.js": "text/javascript; charset=utf-8",
  "gaze.js": "text/javascript; charset=utf-8",
  "gaze-math.js": "text/javascript; charset=utf-8",
  "gaze-worker.js": "text/javascript; charset=utf-8",
  "live-state.js": "text/javascript; charset=utf-8",
  "voice.js": "text/javascript; charset=utf-8",
  "favicon.svg": "image/svg+xml",
};
export async function readAssets() {
  return Object.fromEntries(await Promise.all(Object.entries(types).map(async ([name, type]) => [
    name === "index.html" ? "/" : "/" + name,
    [type, await readFile(new URL("public/" + name, root), "utf8")],
  ])));
}

export async function build({ hosted = true } = {}) {
  const server = new URL("dist/server/", root);
  await mkdir(server, { recursive: true });
  const assets = await readAssets();
  const api = await readFile(new URL("src/api.mjs", root), "utf8");
  const worker = await readFile(new URL("src/worker.mjs", root), "utf8");
  await writeFile(new URL("index.js", server), "const assets = " + JSON.stringify(assets) + ";\n" + api + "\n" + worker.replace(/^import .*;\r?\n/gm, ""));
  if (hosted) {
    await mkdir(new URL("dist/.openai/", root), { recursive: true });
    await copyFile(new URL(".openai/hosting.json", root), new URL("dist/.openai/hosting.json", root));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
