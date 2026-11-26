export const providers = {
  gemini: { label:"Gemini", key:"GEMINI_API_KEY", model:"GEMINI_MODEL", fallback:"gemini-3.8-flash" },
  openai: { label:"OpenAI", key:"OPENAI_API_KEY", model:"OPENAI_MODEL", fallback:"gpt-6-luna" },
  anthropic: { label:"Anthropic", key:"ANTHROPIC_API_KEY", model:"ANTHROPIC_MODEL", fallback:"claude-haiku-5-5" },
};

const jsonHeaders = { "Content-Type":"application/json" };

function formatSchema({ type, properties, required, items, minimum, maximum, minItems, maxItems }) {
  if (type === "object") return {
    type,
    properties:Object.fromEntries(Object.entries(properties).map(([name, property]) => [name, formatSchema(property)])),
    required,
    additionalProperties:false,
  };
  if (type === "array") return { type, items:formatSchema(items), description:"Use " + minItems + " to " + maxItems + " items." };
  if (minimum !== undefined) return { type, description:"Use an integer from " + minimum + " to " + maximum + "." };
  return { type };
}

function requestGemini({ model, key, instructions, parts, schema }) {
  return ["https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    headers:{ ...jsonHeaders, "x-goog-api-key":key },
    body:JSON.stringify({
      systemInstruction:{ parts:[{ text:instructions }] },
      contents:[{ role:"user", parts:parts.map(({ filename, ...part }) => part) }],
      generationConfig:{ responseMimeType:"application/json", responseJsonSchema:schema, thinkingConfig:{ thinkingLevel:"LOW" } },
    }),
  }];
}

function requestOpenAI({ model, key, instructions, parts, schema, action, env }) {
  const auth = { Authorization:"Bearer " + key };
  if (action === "transcribe") {
    const { mimeType, data } = parts[0].inlineData;
    const form = new FormData();
    form.set("model", env.OPENAI_TRANSCRIPTION_MODEL || "gpt-transcribe");
    form.set("file", new Blob([Uint8Array.from(atob(data), (byte) => byte.charCodeAt(0))], { type:mimeType }), "recording." + mimeType.split("/")[1]);
    return ["https://api.openai.com/v1/audio/transcriptions", { headers:auth, body:form }];
  }
  const content = parts.map(({ text, inlineData, filename }) => inlineData ?
    { type:"input_file", filename, file_data:"data:" + inlineData.mimeType + ";base64," + inlineData.data } :
    { type:"input_text", text });
  return ["https://api.openai.com/v1/responses", {
    headers:{ ...jsonHeaders, ...auth },
    body:JSON.stringify({
      model, instructions, input:[{ role:"user", content }], store:false,
      text:{ format:{ type:"json_schema", name:"studyroom_" + action, strict:true, schema:formatSchema(schema) } },
    }),
  }];
}

function requestAnthropic({ model, key, instructions, parts, schema, action }) {
  const content = parts.map(({ text, inlineData, filename }) => inlineData ?
    { type:"document", title:filename, source:{ type:"base64", media_type:inlineData.mimeType, data:inlineData.data } } :
    { type:"text", text });
  return ["https://api.anthropic.com/v1/messages", {
    headers:{ ...jsonHeaders, "x-api-key":key, "anthropic-version":"2023-06-01" },
    body:JSON.stringify({
      model, max_tokens:action === "bundle" ? 8192 : 4096, system:instructions,
      messages:[{ role:"user", content }],
      output_config:{ format:{ type:"json_schema", schema:formatSchema(schema) } },
    }),
  }];
}

const requestForProvider = { gemini:requestGemini, openai:requestOpenAI, anthropic:requestAnthropic };

export function buildProviderRequest(provider, options) {
  const [url, request] = requestForProvider[provider](options);
  return [url, { ...request, method:"POST", redirect:"error", signal:AbortSignal.timeout(90_000) }];
}

export function readProviderResult(provider, action, payload) {
  let message;
  if (provider === "gemini") {
    message = payload.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("");
  } else if (provider === "openai") {
    if (action === "transcribe") return { transcript:payload.text };
    if (payload.status === "completed") message = payload.output?.flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text").map((part) => part.text).join("");
  } else {
    if (payload.stop_reason === "end_turn") message = payload.content?.filter((part) => part.type === "text").map((part) => part.text).join("");
  }
  return JSON.parse(message || "");
}
