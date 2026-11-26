// Browser speech: synthesis for the examiner's voice, recognition for the learner's answers.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);
export const canSpeak = "speechSynthesis" in window;

// Each persona prefers different voice names and gets its own pace and pitch.
// The lists end with the voices Windows and macOS install by default.
const personaVoices = {
  mentor: { slot: 0, rate: 0.96, pitch: 1.05, prefer: ["Aria", "Jenny", "Sonia", "Samantha", "Google UK English Female", "Zira", "Hazel", "Female"] },
  professor: { slot: 1, rate: 0.9, pitch: 0.8, prefer: ["Ryan", "Guy", "Daniel", "Google UK English Male", "George", "David", "Male"] },
  socratic: { slot: 2, rate: 0.94, pitch: 0.95, prefer: ["Davis", "Christopher", "Thomas", "Alex", "Mark", "Male"] },
  quizmaster: { slot: 3, rate: 1.12, pitch: 1.25, prefer: ["Andrew", "Eric", "Brian", "Fred", "Google US English", "Mark"] },
  buddy: { slot: 4, rate: 1.05, pitch: 1.1, prefer: ["Ana", "Emma", "Michelle", "Libby", "Karen", "Zira", "Susan", "Female"] },
};

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => { speechSynthesis.removeEventListener("voiceschanged", done); resolve(speechSynthesis.getVoices()); };
    speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, 1_500);
  });
}

export async function pickVoice(personaId, language) {
  const style = personaVoices[personaId] || personaVoices.mentor;
  const lang = (language || navigator.language || "en-US").toLowerCase();
  if (!canSpeak) return { ...style, voice:null, lang, forLanguage:language };
  const voices = await loadVoices();
  const base = lang.split("-")[0];
  // Never read one language with another language's voice; without a match the browser picks from the lang tag.
  const candidates = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(base));
  const score = (voice) => {
    const preferred = style.prefer.findIndex((name) => voice.name.includes(name));
    return (preferred < 0 ? 0 : 100 - preferred * 10) + (/natural|online/i.test(voice.name) ? 25 : 0) +
      (voice.lang.toLowerCase().replace("_", "-") === lang ? 5 : 0);
  };
  const ranked = candidates.toSorted((first, second) => score(second) - score(first));
  // When no preferred name is installed, spread the personas across the voices that are.
  const voice = ranked.length && score(ranked[0]) < 50 ? candidates[style.slot % candidates.length] : ranked[0] || null;
  return { rate:style.rate, pitch:style.pitch, voice, lang:voice?.lang || language || lang, forLanguage:language, matchesLanguage:candidates.length > 0 };
}

function sentences(text) {
  const parts = text.match(/[^.!?…]+[.!?…]*["')\]]*\s*/g) || [text];
  const chunks = [];
  for (const part of parts) {
    if (chunks.length && (chunks.at(-1) + part).length < 180) chunks[chunks.length - 1] += part;
    else chunks.push(part);
  }
  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}

// Speaks sentence by sentence; Chrome cuts long utterances off. Resolves when done or aborted.
export function speak(text, profile, signal) {
  if (!canSpeak) return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const queue = sentences(text);
    let watchdog;
    const finish = () => { clearTimeout(watchdog); signal?.removeEventListener("abort", stop); resolve(); };
    const stop = () => { speechSynthesis.cancel(); finish(); };
    signal?.addEventListener("abort", stop, { once:true });
    const next = () => {
      clearTimeout(watchdog);
      if (signal?.aborted) return;
      const chunk = queue.shift();
      if (!chunk) { finish(); return; }
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (profile?.voice) utterance.voice = profile.voice;
      utterance.lang = profile?.lang || "";
      utterance.rate = profile?.rate || 1;
      utterance.pitch = profile?.pitch || 1;
      utterance.onend = next;
      utterance.onerror = next;
      // Some engines never fire onend; move on after a generous estimate.
      watchdog = setTimeout(next, 4_000 + chunk.length * 110 / (profile?.rate || 1));
      speechSynthesis.speak(utterance);
    };
    next();
  });
}

const recognitionErrors = {
  "not-allowed":"Microphone access was blocked. Allow it in your browser, or type your answer.",
  "service-not-allowed":"Speech recognition is turned off in this browser. Type your answer instead.",
  "audio-capture":"No microphone was found. Connect one, or type your answer.",
  network:"Speech recognition needs an internet connection. Type your answer instead.",
  "language-not-supported":"Speech recognition doesn't support this language here. Type your answer instead.",
};

function recognizer(lang) {
  const recognition = new Recognition();
  recognition.lang = lang || navigator.language || "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}

// Listens for one answer. It ends after a pause once something was said, or when finish() is called.
export function listen({ lang, onInterim, silenceMs = 2_200 }) {
  let recognition;
  let heard = "";
  let interim = "";
  let silence;
  let finishing = false;
  let settled = false;
  let restarts = 0;
  let resolve;
  let reject;
  const result = new Promise((done, fail) => { resolve = done; reject = fail; });
  const settle = (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(silence);
    if (error) reject(error);
    else resolve((heard + " " + interim).replace(/\s+/g, " ").trim());
  };
  const finish = () => {
    finishing = true;
    clearTimeout(silence);
    try { recognition.stop(); } catch { settle(); }
  };
  const start = () => {
    recognition = recognizer(lang);
    recognition.onresult = (event) => {
      interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) heard += transcript + " ";
        else interim += transcript;
      }
      onInterim?.((heard + interim).trim());
      clearTimeout(silence);
      if ((heard + interim).trim()) silence = setTimeout(finish, silenceMs);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      settled || settle(new Error(recognitionErrors[event.error] || "Speech recognition stopped unexpectedly. Type your answer instead."));
    };
    recognition.onend = () => {
      if (settled) return;
      // Chrome ends recognition on its own after a while; keep listening until the answer is finished.
      if (!finishing && restarts < 30) {
        restarts += 1;
        heard += interim ? interim + " " : "";
        interim = "";
        try { start(); return; } catch {}
      }
      settle();
    };
    recognition.start();
  };
  try { start(); } catch (error) { settle(error instanceof Error ? error : new Error("Speech recognition could not start.")); }
  return {
    result,
    finish,
    cancel() { settled = true; clearTimeout(silence); try { recognition.abort(); } catch {} resolve(""); },
  };
}

// Continuous dictation into a text box; onText receives each finished phrase.
export function dictate({ lang, onText, onInterim, onError, onEnd }) {
  let stopped = false;
  let recognition;
  const start = () => {
    recognition = recognizer(lang);
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) onText(transcript.trim());
        else interim += transcript;
      }
      onInterim?.(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      stopped = true;
      onError?.(recognitionErrors[event.error] || "Dictation stopped unexpectedly.");
    };
    recognition.onend = () => {
      if (!stopped) { try { start(); return; } catch {} }
      onEnd?.();
    };
    recognition.start();
  };
  try { start(); } catch { onError?.("Dictation could not start in this browser."); onEnd?.(); }
  return { stop() { stopped = true; try { recognition.stop(); } catch { onEnd?.(); } } };
}
