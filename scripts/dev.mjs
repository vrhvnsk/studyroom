import { createServer } from "node:http";
import { Readable } from "node:stream";
import { build } from "./build.mjs";

await build({ hosted: false });
const { default: worker } = await import("../dist/server/index.js");
const port = Number(process.env.PORT || 4173);
const origin = "http://127.0.0.1:" + port;
createServer(async (req, res) => {
  try {
    const options = { method: req.method, headers: req.headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      options.body = Readable.toWeb(req);
      options.duplex = "half";
    }
    const request = new Request(new URL(req.url, origin), options);
    const started = Date.now();
    const response = await worker.fetch(request, process.env);
    if (req.url.startsWith("/api/")) console.log(req.method + " " + req.url + " -> " + response.status + " (" + (Date.now() - started) + " ms)");
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch {
    res.writeHead(500);
    res.end("Studyroom could not handle this request.");
  }
}).listen(port, "127.0.0.1", () => console.log("Local: " + origin));
