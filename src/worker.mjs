import { api } from "./api.mjs";
import { assets } from "./assets.mjs";

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/")) return api(request, env);
    if ((request.method !== "GET" && request.method !== "HEAD") || !Object.hasOwn(assets, path)) return new Response("Page not found.", { status: 404 });
    const [type, body] = assets[path];
    return new Response(request.method === "HEAD" ? null : body, { headers: {
      "Content-Type": type,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "microphone=(self), camera=(self)",
      "Content-Security-Policy": path === "/gaze-worker.js"
        ? "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net https://storage.googleapis.com"
        : "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'self'",
    } });
  },
};
