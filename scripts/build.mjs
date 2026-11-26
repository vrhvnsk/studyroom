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
  const modules = await Promise.all(["providers", "api", "worker"].map(async (name) => {
    const source = await readFile(new URL("src/" + name + ".mjs", root), "utf8");
    return source.replace(/^import .*;\r?\n/gm, "");
  }));
  await writeFile(new URL("index.js", server), "const assets = " + JSON.stringify(assets) + ";\n" + modules.join("\n"));
  if (hosted) {
    await mkdir(new URL("dist/.openai/", root), { recursive: true });
    await copyFile(new URL(".openai/hosting.json", root), new URL("dist/.openai/hosting.json", root));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
