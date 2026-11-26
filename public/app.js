import { sampleWorkspace } from "./demo.js";
import { loadWorkspace, saveWorkspace } from "./storage.js";
import { createGazeSession } from "./gaze-math.js";
import { startGazeCamera } from "./gaze.js";
import { canListen, canSpeak, dictate, listen, pickVoice, speak } from "./voice.js";
import { createLiveTranscript, liveAttempt } from "./live-state.js";

const paths = {
  brand:"M4 16 12 4l8 12M7 16l5-7 5 7M4 20h16",
  book:"M12 6C8 3 4 4 2 5v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-2-1-6-2-10 1v14",
  grid:"M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  folder:"M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  bolt:"m13 2-9 12h7l-1 8 10-12h-7z",
  notes:"M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h8m-8 4h8m-8 4h5",
  board:"M3 5h18v14H3zM9 5v14m6-14v14M5 9h2m4 2h2m4-2h2",
  spark:"M12 2c.6 6 3.4 8.8 9 10-5.6 1.2-8.4 4-9 10-.6-6-3.4-8.8-9-10 5.6-1.2 8.4-4 9-10z",
  key:"M15.5 3a5.5 5.5 0 0 0-5 8L3 18.5V22h3.5l2-2v-2h2l3-3a5.5 5.5 0 1 0 2-12zM17 8h.01",
  settings:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.6 10l-1.1-2 1.8-3 2.3.2 1.7-1.1.9-2.1h3.6l.9 2.1 1.7 1.1 2.3-.2 1.8 3-1.1 2v3.9l1.1 2-1.8 3-2.3-.2-1.7 1.1-.9 2.1h-3.6l-.9-2.1-1.7-1.1-2.3.2-1.8-3 1.1-2z",
  mic:"M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0m-7 7v4m-4 0h8",
  pen:"m4 16-1 5 5-1L20 8l-4-4L4 16zm9-9 4 4M16 4l1-1a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-1 1",
  list:"M9 6h12M9 12h12M9 18h12M3 6h1m-1 6h1m-1 6h1",
  plus:"M12 5v14M5 12h14",
  upload:"M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  close:"m6 6 12 12M18 6 6 18",
  check:"m5 12 4 4L19 6",
  volume:"M3 9v6h4l5 4V5L7 9zm13 0a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12",
  stop:"M6 6h12v12H6z",
  clock:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-15v5l3 2",
  eye:"M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6-10-6-10-6zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0z",
  focus:"M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 8v8m-4-4h8",
  camera:"M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm12 4 5-3v10l-5-3",
  phone:"M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  micOff:"m3 3 18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.9 5M19 11a7 7 0 0 1-.6 2.8M12 18v4m-4 0h8",
  skip:"m5 4 10 8-10 8zM19 5v14",
};
const icon = (name) => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="' + paths[name] + '"/></svg>';
const main = document.querySelector("main");
const modal = document.querySelector("#modal");
const modalContent = document.querySelector("#dialog-content");
const toastElement = document.querySelector("#toast");
const modes = {
  oral: { title:"Oral exam", icon:"mic", color:"purple", description:"Talk it through with a spoken examiner, or answer one question at a time." },
  written: { title:"Written exam", icon:"pen", color:"sand", description:"Write structured answers and review rubric feedback." },
  quiz: { title:"Multiple choice", icon:"list", color:"blue", description:"Test your recall with an interactive quiz." },
};
const pages = { overview:"Overview", materials:"Materials", practice:"Practice exams", notes:"Notes", board:"Studyboard" };
const statuses = { todo:"To study", review:"Reviewing", done:"Mastered" };
const maxPdf = 10 * 1024 * 1024;
const maxText = 150_000;
const html = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;",
})[character]);
const id = () => crypto.randomUUID();
const button = (label, action, style = "outline", glyph = "") => '<button type="button" class="button ' + style + '" data-action="' + action + '">' + (glyph ? icon(glyph) : "") + label + '</button>';
const badge = (label, neutral = false) => '<span class="status' + (neutral ? ' neutral' : '') + '">' + html(label) + '</span>';
const toolIcon = (glyph, color = "") => '<span class="tool-icon ' + color + '">' + icon(glyph) + '</span>';
const formatDate = (date) => new Intl.DateTimeFormat(undefined, { month:"short", day:"numeric" }).format(new Date(date));
const connected = () => Boolean(apiKey || config.serverKey);
const activeData = () => data.pack;
const activeSources = () => data.sources.filter((source) => !source.sample);
const route = () => Object.hasOwn(pages, location.hash.slice(1)) ? location.hash.slice(1) : "overview";

let data = sampleWorkspace();
let config = { serverKey:false, model:"claude-opus-5-5", personas:[] };
let apiKey = "";
let screen = route();
let session = null;
let report = null;
let dictation = null;
let gazeCamera = null;
let toastTimer;
let pdfUrl;
let modalBusy = false;
let generateAfterConnecting = false;
let persistenceAvailable = true;
let saving = Promise.resolve();
let dragged = "";
let liveAudio = null;
let pendingRetry = null;

function notify(message) {
  toastElement.textContent = message;
  toastElement.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("show"), 3800);
}

function persist() {
  if (!persistenceAvailable) return Promise.resolve();
  const snapshot = structuredClone(data);
  saving = saving.then(() => saveWorkspace(snapshot)).catch(() => {
    persistenceAvailable = false;
    notify("Browser storage is unavailable. Changes will last until this page closes.");
  });
  return saving;
}

function ai(action, payload = {}, key = apiKey) {
  return post("/api/ai", { action, ...payload }, key);
}

async function post(path, payload, key = apiKey) {
  const headers = { "Content-Type":"application/json" };
  if (key) headers["x-studyroom-key"] = key;
  const response = await fetch(path, { method:"POST", headers, body:JSON.stringify(payload) });
  let result;
  try { result = await response.json(); }
  catch { throw new Error("Studyroom could not reach Claude. Try again."); }
  if (!response.ok) throw new Error(result.error || "Claude is temporarily unavailable.");
  return result;
}

function showDialog(title, description, body) {
  modalContent.innerHTML = '<div class="dialog-head"><div><h2 id="dialog-title">' + html(title) + '</h2>' +
    (description ? '<p>' + html(description) + '</p>' : '') + '</div><button class="icon-button" data-action="close" aria-label="Close">' + icon("close") + '</button></div>' + body;
  if (!modal.open) modal.showModal();
}

function showError(form, message) {
  const box = form.querySelector("[role=alert]");
  box.textContent = message;
  box.hidden = false;
}

function busyForm(form, busy, label = "") {
  modalBusy = busy;
  const submit = form.querySelector('[type="submit"]');
  if (busy) {
    submit.dataset.label = submit.textContent;
    submit.innerHTML = '<span class="busy"></span>' + label;
    form.querySelector("[role=alert]").hidden = true;
  } else submit.textContent = submit.dataset.label;
  for (const control of form.elements) control.disabled = busy;
  modalContent.querySelector("[data-action=close]").disabled = busy;
}

const alertBox = '<p class="notice error" role="alert" hidden></p>';
const formEnd = (label) => alertBox + '<div class="modal-actions">' + button("Cancel","close") + '<button class="button primary" type="submit">' + label + '</button></div></form>';
const settings = () => showDialog("Claude settings", "Connect a Claude API key to generate study packs, grade answers, and run spoken exams.",
  '<form data-form="key"><label class="field">Claude API key<input name="key" type="password" autocomplete="off" placeholder="sk-ant-…" required maxlength="300"></label>' +
  '<p class="subtle">Your key stays in memory until you reload or disconnect. Materials and answers are sent to Anthropic when you ask Claude to process them.</p>' +
  '<p class="subtle inline-ref">Model ' + html(config.model) + ' · <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Get an API key</a></p>' +
  (connected() ? '<p class="notice">' + (apiKey ? 'A session key is connected.' : 'A server key is configured.') + '</p>' : '') +
  (apiKey ? button("Disconnect session key","disconnect","quiet") : '') + formEnd("Connect key"));

const gazeMessages = {
  off:"Turn on your camera to get private delivery feedback during this oral exam.",
  permission:"Waiting for camera permission…",
  loading:"Loading the on-device tracking model…",
  calibrating:"Look directly into your webcam and hold still.",
  unavailable:"Keep your face in view and your eyes comfortably open.",
  near:"Estimated gaze is near your camera baseline.",
  away:"Estimated gaze has shifted from your camera baseline.",
  paused:"Camera off. Turn it back on to recalibrate and continue.",
};

function gazePanel() {
  return '<section class="gaze-panel" aria-labelledby="gaze-title" data-gaze-state="off"><div class="gaze-scope" aria-hidden="true"><i></i><b></b></div>' +
    '<div class="gaze-copy"><div class="gaze-heading"><h3 id="gaze-title">Eye tracking</h3><span class="gaze-chip">Camera off</span></div>' +
    '<p class="gaze-message">' + gazeMessages.off + '</p><div class="gaze-progress" aria-hidden="true" hidden><span></span></div>' +
    '<details class="gaze-privacy"><summary>About camera feedback</summary><p>Camera images are processed on this device and discarded. Your review saves aggregate estimates on this device. Looking away is normal and has no effect on your score.</p></details></div>' +
    '<div class="gaze-controls"><button type="button" class="button outline" data-action="toggle-gaze">' + icon("camera") + '<span>Turn on camera</span></button>' +
    '<button type="button" class="button quiet" data-action="recalibrate-gaze" hidden>' + icon("focus") + 'Recalibrate</button></div></section>';
}

function paintGaze() {
  const panel = main.querySelector(".gaze-panel");
  if (!panel || !session?.gaze) return;
  const { status, progress, x, y, error } = session.gazeView;
  const tag = { permission:"Starting", loading:"Loading", calibrating:"Calibrating", unavailable:"Low signal", near:"Camera on", away:"Camera on", error:"Unavailable" };
  panel.dataset.gazeState = status;
  const setText = (selector, value) => {
    const node = panel.querySelector(selector);
    if (node.textContent !== value) node.textContent = value;
  };
  setText(".gaze-chip", tag[status] || "Camera off");
  setText(".gaze-message", error || gazeMessages[status]);
  setText("[data-action=toggle-gaze] span", gazeCamera ? "Turn off camera" : "Turn on camera");
  panel.querySelector("[data-action=recalibrate-gaze]").hidden = !gazeCamera || status === "permission" || status === "loading";
  const calibration = panel.querySelector(".gaze-progress");
  calibration.hidden = status !== "calibrating";
  calibration.firstElementChild.style.width = (progress || 0) + "%";
  const scope = panel.querySelector(".gaze-scope");
  const offset = (value) => Math.max(-23, Math.min(23, (value || 0) * 38)) + "px";
  scope.style.setProperty("--gaze-x", offset(-x));
  scope.style.setProperty("--gaze-y", offset(y));
}

function stopGaze(update = true) {
  if (!gazeCamera) return;
  const camera = gazeCamera;
  gazeCamera = null;
  camera.stop();
  if (update && session?.gaze) {
    session.gazeView = { status:"paused" };
    paintGaze();
  }
}

function toggleGaze() {
  if (gazeCamera) { stopGaze(); return; }
  const current = session;
  if (!current?.gaze || document.hidden) return;
  current.gaze.recalibrate();
  const camera = startGazeCamera({
    onState(status) {
      if (gazeCamera !== camera) return;
      current.gazeView = { status:status === "ready" ? "calibrating" : status };
      paintGaze();
    },
    onSample(point, time) {
      if (gazeCamera !== camera) return;
      current.gazeView = current.gaze.sample(point, time);
      paintGaze();
    },
    onError(error) {
      if (gazeCamera !== camera) return;
      gazeCamera = null;
      current.gazeView = { status:"error", error };
      paintGaze();
      notify(error);
    },
  });
  gazeCamera = camera;
  paintGaze();
}

function gazeReview(summary) {
  if (!summary) return "";
  const data = summary.nearPercent === null ?
    '<p class="subtle">There were too few usable camera samples to estimate gaze for this session.</p>' :
    '<dl class="gaze-metrics"><div><dt>Near camera baseline</dt><dd>' + summary.nearPercent + '%</dd></div>' +
    '<div><dt>Usable camera time</dt><dd>' + summary.trackedSeconds + ' s</dd></div>' +
    '<div><dt>Usable sample coverage</dt><dd>' + summary.coverage + '%</dd></div></dl>';
  return '<section class="panel gaze-review"><div class="resource-name">' + toolIcon("eye","blue") +
    '<div><h2>Eye tracking feedback</h2><p class="subtle">An estimate of where you looked relative to your calibration. This has no effect on your exam score.</p></div></div>' + data + '</section>';
}

function sourceById(sourceId) { return data.sources.find((source) => source.id === sourceId); }
function sourceButton(ref) {
  if (!ref) return "";
  const source = sourceById(ref.sourceId);
  if (!source) return '<p class="subtle source-ref">Source removed from workspace</p>';
  return '<div class="source-ref"><button class="button outline" data-action="source" data-id="' + html(ref.sourceId) + '" data-page="' + html(ref.page) + '">' + icon("notes") + html(source.name) + (ref.page ? ' · p. ' + html(ref.page) : '') + '</button></div>';
}

function openSource(sourceId, page) {
  const source = sourceById(sourceId);
  if (!source) return;
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  const description = source.sample ? "Sample material" : source.type === "pdf" ? "PDF document" : "Text material";
  if (source.type === "pdf") {
    pdfUrl = URL.createObjectURL(source.file);
    const url = pdfUrl + (page ? "#page=" + page : "");
    showDialog(source.name, description, '<iframe class="pdf" title="Study material PDF" src="' + html(url) + '"></iframe><div class="modal-actions"><a class="button outline" href="' + html(url) + '" target="_blank" rel="noopener">Open PDF</a></div>');
    return;
  }
  showDialog(source.name, description, '<p class="body-text source-text">' + html(source.text) + '</p><div class="modal-actions">' +
    (source.sample ? '' : button("Edit material","edit-source:" + source.id,"outline","pen")) + '</div>');
}

function uploadDialog() {
  showDialog("Add study material", "Upload a PDF, text, or Markdown file, or paste your own notes.",
    '<form data-form="upload"><div class="upload-zone" data-drop="files">' + toolIcon("upload") +
    '<button type="button" class="button outline" data-action="choose-files">Choose files</button><input name="files" type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" multiple hidden>' +
    '<p id="file-status">Drop files here · up to 10 MB per PDF</p></div><label class="field">Title for pasted material<input name="title" placeholder="e.g. Week 1 lecture notes" maxlength="180"></label>' +
    '<label class="field">Paste text<textarea name="text" maxlength="' + maxText + '" placeholder="Paste study material here"></textarea></label>' + formEnd("Add materials"));
}

function generateDialog() {
  if (!activeSources().length) { uploadDialog(); return; }
  if (!connected()) { generateAfterConnecting = true; settings(); return; }
  const sources = activeSources();
  showDialog("Generate a study pack","Select the materials Claude should turn into notes, practice questions, and studyboard topics.",
    '<form data-form="generate"><div class="stack">' + sources.map((source, index) =>
      '<label class="choice"><input type="checkbox" name="sources" value="' + html(source.id) + '"' +
      (sources.length <= 8 || index === 0 ? ' checked' : '') + '>' + html(source.name) + '</label>').join("") + '</div>' +
    (data.pack && !data.pack.sample ? '<p class="notice warning">This replaces your current notes and question bank. Studyboard cards and past sessions stay in your workspace.</p>' : '') +
    formEnd("Generate study pack"));
}

function modeTiles() {
  return '<div class="tiles">' + Object.entries(modes).map(([key, mode]) =>
    '<button class="tile" data-action="start:' + key + '">' + toolIcon(mode.icon, mode.color) +
    '<strong>' + mode.title + '</strong><p>' + mode.description + '</p></button>').join("") + '</div>';
}

function intro(title, text, actions = "") {
  return '<section class="intro"><h1>' + title + '</h1><p>' + text + '</p>' + (actions ? '<div class="actions">' + actions + '</div>' : "") + '</section>';
}

function overview() {
  const own = activeSources();
  const pack = activeData();
  const spotlight = own.at(-1) || data.sources[0];
  const counts = pack ? pack.oral.length + pack.written.length + pack.quiz.length : 0;
  return '<section class="hero"><div class="hero-copy"><span class="hero-label">' + icon("spark") + (pack?.sample ? 'Sample pack loaded' : pack ? 'Study pack ready' : 'Claude study workspace') + '</span>' +
    '<h1>Study to <em>remember.</em></h1><p>Turn your study materials into clear notes, interactive practice exams, and a plan for what to review next.</p><div class="actions">' +
    button("Add study material","upload","primary","plus") + (own.length ? button("Generate study pack","generate","outline","spark") : button(pack?.sample ? "Try a sample exam" : "Start practice","start:quiz","outline","bolt")) +
    '</div></div><div class="hero-art" aria-hidden="true"><div class="hero-grid"></div><div class="orbit"></div><div class="orbit inner"></div><div class="orbit outer"></div>' +
    '<div class="orbit-axis"></div><div class="orbit-axis vertical"></div><div class="art-core">' + icon("brand") + '</div>' +
    '<div class="orbital-node node-source">' + icon("notes") + '</div><div class="orbital-node node-practice">' + icon("bolt") + '</div><div class="orbital-node node-notes">' + icon("board") + '</div></div></section>' +
    '<section class="section" aria-labelledby="practice-heading"><div class="section-head"><div><h2 id="practice-heading">Practice exams</h2><p>Choose how you want to test your knowledge.</p></div>' +
    '<button class="text-link" data-nav="practice">View all</button></div>' + modeTiles() + '</section>' +
    '<section class="section"><div class="section-head"><h2>Your workspace</h2></div><div class="dashboard-grid">' +
    '<section class="panel"><div class="split-head"><h2>Materials</h2><button class="text-link" data-nav="materials">Open materials</button></div>' +
    (spotlight ? '<div class="row"><div class="resource-name">' + toolIcon("notes") + '<div><strong>' + html(spotlight.name) + '</strong><p class="subtle">' + (spotlight.sample ? "Sample material" : spotlight.type === "pdf" ? "PDF document" : "Text material") + '</p></div></div>' +
      '<button class="icon-button" data-action="source" data-id="' + html(spotlight.id) + '" aria-label="Preview material">' + icon("notes") + '</button></div>' : '<p class="subtle">Add a source to get started.</p>') + '</section>' +
    '<section class="panel"><div class="split-head"><h2>Study pack</h2><button class="text-link" data-nav="notes">Open notes</button></div><div class="row"><div class="resource-name">' + toolIcon("spark","purple") +
    '<div><strong>' + (pack ? (pack.sample ? "Sample study pack" : "Your study pack") : "Ready when you are") + '</strong><p class="subtle">' +
    (pack ? pack.notes.length + ' notes · ' + counts + ' questions' : 'Generate notes and exams from your material') + '</p></div></div></div></section></div></section>';
}

function materials() {
  return intro("Materials","Manage the source documents Claude uses to build your study pack.",
    button("Add study material","upload","primary","plus") + button("Generate study pack","generate","outline","spark")) +
    '<div class="stack">' + data.sources.map((source) => '<article class="resource row"><div class="resource-name">' +
      toolIcon(source.type === "pdf" ? "notes" : "book", source.sample ? "purple" : "") + '<div><strong>' + html(source.name) + '</strong><p class="subtle">' +
      (source.sample ? 'Sample material' : source.type === "pdf" ? 'PDF document · ' + Math.max(1, Math.round(source.file.size / 1024)) + ' KB' : 'Text material · ' + source.text.length.toLocaleString() + ' characters') +
      '</p></div></div><div class="actions"><button class="button outline" data-action="source" data-id="' + html(source.id) + '">Preview</button>' +
      (source.sample ? '' : button("Remove","remove-source:" + source.id,"quiet danger")) + '</div></article>').join("") + '</div>';
}

function notes() {
  const pack = activeData();
  return intro("Notes","Review and edit the study summaries grounded in your source material.",
    button("Generate study pack","generate","primary","spark")) +
    (pack ? (pack.sample ? '<p class="notice">You’re viewing a sample pack. Add material to generate your own.</p>' : '') +
    '<div class="grid-2">' + pack.notes.map((note) =>
      '<article class="panel note"><div class="row"><h2>' + html(note.title) + '</h2><button class="icon-button" data-action="edit-note:' + html(note.id) + '" aria-label="Edit note">' +
      icon("pen") + '</button></div><p class="body-text">' + html(note.body) + '</p>' + excerpt(note.reference) + sourceButton(note.reference) + '</article>').join("") + '</div>' :
      '<div class="empty panel">' + toolIcon("notes") + '<h2>Your notes will appear here</h2><p>Generate a pack from your study materials.</p></div>');
}

function excerpt(ref) {
  if (!ref?.excerpt || !sourceById(ref.sourceId)) return "";
  const label = sourceById(ref.sourceId).type === "pdf" ? "Suggested PDF excerpt" : "Source excerpt";
  return '<details class="review"><summary>' + label + '</summary><p class="subtle body-text">' + html(ref.excerpt) + '</p></details>';
}

function board() {
  return intro("Studyboard","Move topics as you review them and add your own study tasks.", button("Add topic","add-topic","primary","plus")) +
    '<div class="board">' + Object.entries(statuses).map(([key, label]) => {
      const cards = data.board.filter((card) => card.status === key);
      return '<section class="board-col" data-column="' + key + '"><h2>' + label + ' <span class="subtle">(' + cards.length + ')</span></h2>' +
        (cards.length ? cards.map((card) => '<article class="board-card" draggable="true" data-card="' + html(card.id) + '"><div class="row"><h3>' + html(card.title) +
          '</h3><button class="icon-button" data-action="edit-topic:' + html(card.id) + '" aria-label="Edit study topic">' + icon("pen") + '</button></div>' +
          '<p class="body-text">' + html(card.body) + '</p>' + sourceButton(card.reference) +
          '<label class="field">Status<select data-status="' + html(card.id) + '">' + Object.entries(statuses).map(([state, name]) => '<option value="' + state + '"' +
            (key === state ? ' selected' : '') + '>' + name + '</option>').join("") + '</select></label></article>').join("") :
          '<p class="board-empty subtle">No topics here yet.</p>') + '</section>';
    }).join("") + '</div>';
}

function navigate(page) {
  if (!Object.hasOwn(pages, page)) return;
  if (screen === page) { render(); return; }
  if (screen === "practice") {
    stopDictation();
    pauseLive("Paused while you were away. Resume the call to continue.");
    stopGaze();
    window.speechSynthesis?.cancel();
  }
  screen = page;
  if (location.hash !== "#" + page) history.pushState(null, "", "#" + page);
  render();
  main.focus();
  window.scrollTo(0, 0);
}

function render() {
  document.querySelector("#crumb").textContent = pages[screen];
  document.querySelector("#connection-status").textContent = connected() ? "Connected" : "Connect your API key";
  document.documentElement.dataset.ai = connected() ? "connected" : "disconnected";
  for (const element of document.querySelectorAll(".nav-item[data-nav]")) {
    const current = element.dataset.nav === screen;
    element.classList.toggle("active", current);
    if (current) element.setAttribute("aria-current", "page");
    else element.removeAttribute("aria-current");
  }
  main.innerHTML = ({ overview, materials, notes, board, practice })[screen]();
  paintGaze();
  paintLive();
}

function practice() {
  if (report) return reviewSession();
  if (session) return exam();
  const pack = activeData();
  return intro("Practice exams","Choose an exam format and practice with questions from your study pack.",
    button("Question bank","questions","outline","notes") + button("Generate study pack","generate","primary","spark")) +
    (pack?.sample ? '<p class="notice">Try the sample exams while you connect Claude or add your own material.</p>' : '') +
    modeTiles() + (data.history.length ? '<section class="section"><div class="section-head"><h2>Recent sessions</h2></div><div class="stack">' +
      data.history.slice(0, 8).map((result) => '<article class="resource row"><div class="resource-name">' +
      toolIcon(modes[result.mode].icon, modes[result.mode].color) + '<div><strong>' + modes[result.mode].title + (result.live ? ' · ' + html(result.live.name) : '') + '</strong><p class="subtle">' +
      formatDate(result.completed) + ' · ' + result.answers.length + ' questions</p></div></div><div class="actions">' +
      badge(scoreLabel(result.score)) + button("Review","review:" + result.id) + '</div></article>').join("") + '</div></section>' : '');
}

const personaMark = (persona) => persona.name.split(" ").at(-1).slice(0, 1).toUpperCase();
const scoreLabel = (score) => score === null || score === undefined ? "Not graded" : score + "%";

function begin(mode, retry, style) {
  const pack = activeData();
  const questions = retry ? retry.answers.filter((item) => item.score === null || item.score < 75).map((item) => item.question) : pack?.[mode];
  if (!questions?.length) { generateDialog(); return; }
  if (session) {
    navigate("practice");
    notify("Your current practice session is ready to resume.");
    return;
  }
  if (mode === "oral" && !style) { oralDialog(retry); return; }
  report = null;
  session = { mode, questions:structuredClone(questions), sample:retry ? retry.sample : pack.sample, index:0, answers:[], draft:"", interim:"", choice:null, followUp:"", firstAnswer:"", pending:false, error:"" };
  if (mode === "oral") {
    session.gaze = createGazeSession();
    session.gazeView = { status:"off" };
    const persona = config.personas.find((entry) => entry.id === style);
    if (persona && connected()) {
      session.live = { persona, status:"thinking", message:"", index:0, run:0, transcript:createLiveTranscript(questions.length),
        results:new Array(questions.length).fill(null), grading:0, finished:false, language:"", voice:null, interim:"", typing:!canListen, lastSaid:"", retry:"" };
    }
  }
  navigate("practice");
  if (session.live) void liveStep(session, "start");
}

function oralDialog(retry) {
  pendingRetry = retry || null;
  const live = connected() && config.personas.length;
  let preferred = retry?.live?.persona;
  try { preferred ||= localStorage.getItem("studyroom-persona"); } catch {}
  if (!config.personas.some((persona) => persona.id === preferred)) preferred = config.personas[0]?.id;
  showDialog("Oral exam", "Talk with an examiner who speaks, listens, and reacts to your answers, or answer one question at a time.",
    '<form data-form="oral-setup"><fieldset class="persona-list"><legend>Spoken conversation</legend>' +
    (live ? config.personas.map((persona) => '<label class="choice persona"><input type="radio" name="style" value="' + html(persona.id) + '"' +
      (persona.id === preferred ? ' checked' : '') + ' required><span class="persona-mark" aria-hidden="true">' + html(personaMark(persona)) + '</span><span><strong>' + html(persona.name) + '</strong><span class="subtle">' + html(persona.description) + '</span></span></label>').join("") :
      '<p class="notice">Connect a Claude API key in Settings to talk with an examiner.</p>') +
    '</fieldset><fieldset class="persona-list"><legend>Classic</legend><label class="choice persona"><input type="radio" name="style" value="classic"' + (live ? '' : ' checked') +
    ' required><span class="persona-mark" aria-hidden="true">' + icon("pen") + '</span><span><strong>One question at a time</strong><span class="subtle">Dictate or type each answer and edit it before you submit.</span></span></label></fieldset>' +
    '<p class="subtle">' + (canListen ? 'Your browser turns your speech into text, which in Chrome uses Google’s speech service. ' : 'This browser can’t recognize speech, so you’ll type your answers while the examiner speaks. ') +
    'Claude writes the examiner’s replies, and your browser reads them aloud. Your score never depends on the examiner’s personality.</p>' + formEnd("Start exam"));
}

function startOral(form) {
  const style = new FormData(form).get("style");
  if (!style) return;
  const retry = pendingRetry;
  modal.close();
  if (style !== "classic") {
    try { localStorage.setItem("studyroom-persona", style); } catch {}
  }
  begin("oral", retry, style);
}

function liveStatusText(live) {
  const name = live.persona.name;
  return ({
    thinking:name + " is thinking…",
    speaking:name + " is speaking",
    listening:live.typing ? "Your turn · type your answer below" : live.interim ? "Listening…" : "Your turn · speak whenever you’re ready",
    paused:live.message || "Paused. Resume when you’re ready.",
    error:live.message || "Something went wrong. Resume to try again.",
    ended:live.grading ? "Exam finished · grading your answers…" : "Exam finished",
  })[live.status] || "Starting…";
}

function conversationHtml(turns, examiner) {
  return turns.map(({ role, text }) => '<p class="live-line ' + role + '"><strong>' + (role === "learner" ? "You" : html(examiner)) + '</strong>' + html(text) + '</p>').join("");
}

function liveExam() {
  const current = session;
  const live = current.live;
  return '<section class="panel practice-box live-box"><div class="row"><div class="resource-name">' + toolIcon("mic","purple") +
    '<div><h3>Spoken oral exam</h3><p class="subtle">' + html(live.persona.name) + ' · ' + (current.sample ? "Sample study pack" : "Your study pack") + '</p></div></div>' +
    button("Hang up","hang-up","quiet danger","phone") + '</div><div class="live-progress"></div>' +
    '<div class="live-stage" data-status=""><div class="live-orb" aria-hidden="true"><i></i><i></i><span>' + html(personaMark(live.persona)) + '</span></div>' +
    '<p class="live-status" role="status"></p><p class="live-voice"></p></div>' +
    '<details class="review live-question"><summary>Show question text</summary><p class="body-text"></p></details>' +
    '<div class="live-log" role="log" aria-label="Conversation transcript"></div>' +
    '<form data-form="live-answer" class="live-type"><label class="field">' + (canListen ? 'Or type your answer' : 'Your answer') +
    '<textarea name="answer" rows="2" maxlength="4000" placeholder="Type your answer…"></textarea></label><button type="submit" class="button outline">' + icon("check") + 'Send</button></form>' +
    '<div class="actions live-controls">' + button("Done speaking","live-done","primary","check") + button("Interrupt","live-interrupt","outline","stop") +
    button("Repeat","live-repeat","quiet","volume") + button("Skip question","live-skip","outline","skip") + button("Pause","live-pause","quiet","clock") +
    button("Resume","live-resume","primary","mic") + '</div>' +
    '<p class="subtle live-note">Each answer is graded from the transcript when you move on. The examiner’s personality never changes your score.</p></section>' + gazePanel();
}

function paintLive() {
  const live = session?.live;
  const box = main.querySelector(".live-box");
  if (!live || !box) return;
  const total = session.questions.length;
  const index = Math.min(live.index, total - 1);
  const setHtml = (node, value) => { if (node.innerHTML !== value) node.innerHTML = value; };
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  setHtml(box.querySelector(".live-progress"), '<div class="row draft"><p class="subtle">Question ' + (index + 1) + ' of ' + total + '</p>' +
    (live.grading ? badge("Grading " + live.grading + "…", true) : '') + '</div><div class="meter" role="progressbar" aria-label="Questions completed" aria-valuemin="0" aria-valuemax="' + total +
    '" aria-valuenow="' + live.index + '"><span style="width:' + (100 * live.index / total) + '%"></span></div>');
  box.querySelector(".live-stage").dataset.status = live.status === "listening" && live.interim ? "hearing" : live.status;
  setText(box.querySelector(".live-status"), liveStatusText(live));
  const voice = live.voice?.voice;
  setText(box.querySelector(".live-voice"), !canSpeak ? "This browser can’t speak, so read the examiner’s lines below." :
    voice ? "Voice: " + voice.name + (live.voice.matchesLanguage ? "" : " · no voice installed for this language") : "");
  setText(box.querySelector(".live-question p"), session.questions[index].prompt);
  const log = box.querySelector(".live-log");
  const turns = live.transcript.turns(index).slice(-8);
  const before = log.innerHTML;
  setHtml(log, (turns.length ? conversationHtml(turns, live.persona.name) : '<p class="subtle">The conversation appears here.</p>') +
    (live.interim ? '<p class="live-line learner interim"><strong>You</strong>' + html(live.interim) + '</p>' : ''));
  if (log.innerHTML !== before) log.scrollTop = log.scrollHeight;
  const show = (action, visible) => { box.querySelector("[data-action=" + action + "]").hidden = !visible; };
  const listening = live.status === "listening";
  show("live-done", listening && !live.typing);
  show("live-interrupt", live.status === "speaking");
  show("live-repeat", listening && Boolean(live.lastSaid));
  show("live-skip", (listening || live.status === "speaking") && !live.finished);
  show("live-pause", ["listening", "speaking", "thinking"].includes(live.status) && !live.finished);
  show("live-resume", live.status === "paused" || live.status === "error");
  show("hang-up", live.status !== "ended");
  box.querySelector(".live-type").hidden = !listening;
}

const liveStale = (current, run) => session !== current || current.live.run !== run;

function stopLiveAudio() {
  const audio = liveAudio;
  liveAudio = null;
  audio?.stop();
}

async function liveStep(current, event) {
  const live = current.live;
  if (session !== current || live.finished) return;
  const run = ++live.run;
  stopLiveAudio();
  live.status = "thinking";
  live.message = "";
  live.interim = "";
  live.retry = "";
  paintLive();
  let reply;
  try {
    reply = await ai("examine", { persona:live.persona.id, event, index:live.index,
      questions:current.questions.map(({ topic, prompt, answer, rubric }) => ({ topic, prompt, answer, rubric })),
      turns:live.transcript.turns(live.index).slice(-40) });
  } catch (error) {
    if (liveStale(current, run)) return;
    live.status = "error";
    live.message = error.message + " Choose Resume to try again.";
    live.retry = event;
    paintLive();
    return;
  }
  if (liveStale(current, run)) return;
  live.language = reply.language || live.language;
  const total = current.questions.length;
  if (reply.advance) {
    gradeLive(current, live.index, event === "skip" && !live.transcript.learnerText(live.index));
    live.index += 1;
    live.finished = live.index >= total;
  }
  live.transcript.add(Math.min(live.index, total - 1), "examiner", reply.say);
  live.lastSaid = reply.say;
  await speakLive(current, run, reply.say);
  if (liveStale(current, run)) return;
  if (live.finished) hangUpLive(current);
  else listenLive(current, run);
}

async function speakLive(current, run, text) {
  const live = current.live;
  if (!live.voice || live.voice.forLanguage !== live.language) live.voice = await pickVoice(live.persona.id, live.language);
  if (liveStale(current, run)) return;
  live.status = "speaking";
  paintLive();
  const controller = new AbortController();
  const audio = { stop:() => controller.abort() };
  liveAudio = audio;
  await speak(text, live.voice, controller.signal);
  if (liveAudio === audio) liveAudio = null;
}

function listenLive(current, run) {
  const live = current.live;
  live.status = "listening";
  live.interim = "";
  paintLive();
  if (live.typing) { main.querySelector(".live-type textarea")?.focus(); return; }
  const started = Date.now();
  const listener = listen({ lang:live.voice?.lang || live.language, onInterim:(text) => {
    if (liveStale(current, run)) return;
    live.interim = text;
    paintLive();
  } });
  const audio = { stop:() => listener.cancel(), finish:() => listener.finish() };
  liveAudio = audio;
  listener.result.then((said) => {
    if (liveStale(current, run) || liveAudio !== audio) return;
    liveAudio = null;
    if (said) { submitLiveAnswer(current, said); return; }
    if (Date.now() - started < 1_500) {
      live.typing = true;
      notify("Speech recognition stopped right away, so type your answer instead.");
    }
    listenLive(current, run);
  }, (error) => {
    if (liveStale(current, run) || liveAudio !== audio) return;
    liveAudio = null;
    live.typing = true;
    notify(error.message);
    listenLive(current, run);
  });
}

function submitLiveAnswer(current, text) {
  const live = current.live;
  if (session !== current || live.finished || !text.trim()) return;
  live.transcript.add(live.index, "learner", text.trim());
  live.interim = "";
  void liveStep(current, "reply");
}

function resumeLive() {
  const current = session;
  const live = current?.live;
  if (!live || live.finished) return;
  if (live.retry) { void liveStep(current, live.retry); return; }
  void liveStep(current, live.index || live.transcript.turns(0).length ? "resume" : "start");
}

function pauseLive(message) {
  const live = session?.live;
  if (!live || ["ended", "paused"].includes(live.status)) return;
  live.run += 1;
  stopLiveAudio();
  live.status = "paused";
  live.message = message;
  live.interim = "";
  paintLive();
}

function gradeLive(current, index, skipped) {
  const live = current.live;
  const question = current.questions[index];
  const conversation = live.transcript.turns(index);
  const answer = live.transcript.learnerText(index);
  const base = { question, answer, firstAnswer:"", followUpQuestion:"", conversation };
  if (skipped || !answer) {
    live.results[index] = { ...base, score:0, strength:"", gap:"Answer this question aloud next time.",
      feedback:skipped ? "Skipped during the spoken exam." : "No answer was captured for this question." };
    return;
  }
  live.grading += 1;
  ai("grade", { attempt:liveAttempt(question, conversation) })
    .then(({ score, strength, gap, feedback }) => { live.results[index] = { ...base, score, strength, gap, feedback }; })
    .catch((error) => { live.results[index] = { ...base, score:null, strength:"", gap:"", feedback:"This answer could not be graded: " + error.message }; })
    .finally(() => {
      live.grading -= 1;
      paintLive();
      finishLive(current);
    });
}

function hangUpLive(current = session) {
  const live = current?.live;
  if (!live) return;
  live.run += 1;
  stopLiveAudio();
  if (!live.finished) {
    live.finished = true;
    if (live.index < current.questions.length && live.transcript.learnerText(live.index)) gradeLive(current, live.index, false);
  }
  live.status = "ended";
  live.interim = "";
  paintLive();
  finishLive(current);
}

function finishLive(current) {
  const live = current.live;
  if (session !== current || live.status !== "ended" || live.grading) return;
  const answers = live.results.filter(Boolean);
  stopGaze(false);
  session = null;
  if (!answers.length) {
    if (screen === "practice") render();
    notify("The exam ended before any question was answered.");
    return;
  }
  const scored = answers.filter((item) => item.score !== null);
  report = { id:id(), mode:"oral", sample:current.sample, completed:new Date().toISOString(), answers,
    score:scored.length ? Math.round(scored.reduce((total, item) => total + item.score, 0) / scored.length) : null,
    live:{ persona:live.persona.id, name:live.persona.name } };
  if (current.gaze && current.gazeView.status !== "off") report.gaze = current.gaze.summary();
  data.history.unshift(report);
  data.history = data.history.slice(0, 40);
  void persist();
  if (screen === "practice") { render(); window.scrollTo(0, 0); }
}

function exam() {
  const current = session;
  if (current.live) return liveExam();
  const question = current.questions[current.index];
  const mode = modes[current.mode];
  const oral = current.mode === "oral";
  const draftDisabled = current.pending || Boolean(dictation);
  const step = current.index + 1;
  return '<section class="panel practice-box"><div class="row"><div class="resource-name">' + toolIcon(mode.icon, mode.color) +
    '<div><h3>' + mode.title + '</h3><p class="subtle">' + (current.sample ? "Sample study pack" : "Your study pack") +
    '</p></div></div>' + button("End session","end-session","quiet") + '</div><div class="row draft"><p class="subtle">Question ' +
    step + ' of ' + current.questions.length + '</p>' + (current.followUp ? badge("Follow-up") : "") +
    '</div><div class="meter" role="progressbar" aria-label="Questions completed" aria-valuemin="0" aria-valuemax="' +
    current.questions.length + '" aria-valuenow="' + current.index + '"><span style="width:' + (100 * current.index / current.questions.length) +
    '%"></span></div><h2 tabindex="-1" id="exam-question">' + html(current.followUp || question.prompt) + '</h2>' +
    (current.followUp ? '<details class="review"><summary>Original question and answer</summary><p>' + html(question.prompt) +
      '</p><p class="subtle body-text">' + html(current.firstAnswer) + '</p></details>' : '') +
    (oral ? '<div class="actions">' + (canSpeak ? button("Read question","speak","outline","volume") : "") +
      (canListen && !current.pending ? (dictation ? button("Stop dictation","dictate","recording","stop") : button("Dictate answer","dictate","outline","mic")) : "") + '</div>' +
      (dictation ? '<p class="subtle draft dictation-interim" aria-live="polite"></p>' : '') : '') +
    '<form data-form="answer">' +
    (current.mode === "quiz" ? '<div class="choices">' + question.options.map((option, index) =>
      '<label class="choice"><input type="radio" name="choice" value="' + index + '"' + (current.choice === index ? " checked" : "") +
      ' required><span>' + html(option) + '</span></label>').join("") + '</div>' :
      '<label class="field draft">' + (oral ? "Your answer or transcript" : "Your answer") + '<textarea name="answer" placeholder="' +
      (oral ? "Record or type your answer…" : "Write your answer here…") + '" maxlength="8000" required' +
      (draftDisabled ? " disabled" : "") + '>' + html(current.draft) + '</textarea></label>') +
    (current.error ? '<p class="notice error" role="alert">' + html(current.error) + '</p>' : '') +
    '<div class="actions"><button type="submit" class="button primary"' + (draftDisabled ? " disabled" : "") + '>' +
    (current.pending ? '<span class="busy"></span> Reviewing…' : current.mode === "quiz" ? (step === current.questions.length ? "Finish exam" : "Next question") : "Submit answer") +
    '</button></div></form>' + (oral ? gazePanel() : '') + '</section>';
}

function demoFeedback(question, answer, allowFollowUp) {
  const terms = {
    "Encoding": ["familiar", "connect", "cue", "elaborat", "knowledge"],
    "Retrieval practice": ["recall", "feedback", "correct", "check", "memory"],
    "Spaced repetition": ["interval", "days", "space", "session", "spread"],
  };
  const followUps = {
    "Encoding":"Can you give an example of connecting a new idea to something you already know?",
    "Retrieval practice":"What would you do after trying to recall the information?",
    "Spaced repetition":"How would you spread your sessions across the week?",
  };
  const matches = (terms[question.topic] || []).filter((word) => answer.toLowerCase().includes(word)).length;
  return {
    score: Math.min(100, 25 + matches * 20),
    strength: matches ? "You included relevant terminology." : "You attempted the question.",
    gap: "Compare your explanation with the model answer and rubric.",
    feedback: "Sample feedback uses keyword matching.",
    followUp: allowFollowUp && matches < 3 ? followUps[question.topic] || "Can you give a concrete example?" : "",
  };
}

async function submitAnswer(form) {
  const current = session;
  if (!current || current.pending || dictation) return;
  const fields = new FormData(form);
  const question = current.questions[current.index];
  const quiz = current.mode === "quiz";
  const selected = fields.get("choice");
  const answer = quiz ? question.options[Number(selected)] : fields.get("answer")?.trim();
  if (!answer || (quiz && selected === null)) return;
  let feedback;
  if (quiz) {
    const correct = Number(selected) === question.correct;
    feedback = { score:correct ? 100 : 0, strength:"", gap:"", feedback:correct ? "Correct choice." : "The correct answer is " + question.options[question.correct] + ".", followUp:"" };
  } else {
    current.draft = answer;
    current.pending = true;
    current.error = "";
    render();
    const allowFollowUp = current.mode === "oral" && !current.followUp;
    try {
      if (!connected() && !current.sample) throw new Error("Connect Claude in Settings to evaluate this answer.");
      feedback = connected() ? await ai("grade", { attempt:{
        mode:current.mode, question:question.prompt, modelAnswer:question.answer, rubric:question.rubric,
        sourceExcerpt:question.reference?.excerpt || "", answer:current.followUp ? current.firstAnswer : answer,
        followUpQuestion:current.followUp, followUpAnswer:current.followUp ? answer : "", allowFollowUp,
      } }) : demoFeedback(question, [current.firstAnswer, answer].join(" "), allowFollowUp);
      if (session !== current) return;
      if (allowFollowUp && feedback.followUp.trim()) {
        current.firstAnswer = answer;
        current.followUp = feedback.followUp.trim();
        current.draft = "";
        if (screen === "practice") window.speechSynthesis?.cancel();
        return;
      }
    } catch (error) {
      if (session === current) current.error = error.message;
      return;
    } finally {
      current.pending = false;
      if (session === current && screen === "practice") { render(); document.querySelector("#exam-question")?.focus(); }
    }
  }
  current.answers.push({ question, answer, firstAnswer:current.firstAnswer, ...feedback, followUpQuestion:current.followUp });
  current.index += 1;
  current.draft = "";
  current.followUp = "";
  current.firstAnswer = "";
  current.choice = null;
  current.error = "";
  if (current.index === current.questions.length) {
    const score = Math.round(current.answers.reduce((total, item) => total + item.score, 0) / current.answers.length);
    report = { id:id(), mode:current.mode, sample:current.sample, completed:new Date().toISOString(), answers:current.answers, score };
    if (current.gaze && current.gazeView.status !== "off") report.gaze = current.gaze.summary();
    stopGaze(false);
    data.history.unshift(report);
    data.history = data.history.slice(0, 40);
    session = null;
    void persist();
  }
  if (screen === "practice") { render(); document.querySelector("#exam-question")?.focus(); }
}

function reviewSession() {
  const weak = report.answers.filter((item) => item.score === null || item.score < 75);
  return intro("Session review",modes[report.mode].title + (report.live ? " with " + html(report.live.name) : "") + " · " + report.answers.length + " questions · " +
    (report.score === null ? "not graded" : report.score + "% overall"),
    button("All practice exams","practice-home","outline") + (weak.length ? button("Add review topics","review-topics","primary","plus") + button("Retry missed topics","retry","outline","bolt") : button("Practice again","start:" + report.mode,"primary","bolt"))) +
    gazeReview(report.gaze) + '<div class="stack">' + report.answers.map((item, index) => '<article class="panel"><div class="row"><h2>' +
      html(item.question.topic) + '</h2>' + badge(scoreLabel(item.score), item.score === null || item.score < 75) + '</div>' +
      '<details class="review"' + (index === 0 ? " open" : "") + '><summary>' + html(item.question.prompt) + '</summary>' +
      (item.conversation ? (item.conversation.length ? '<div class="live-log review-log">' + conversationHtml(item.conversation, report.live?.name || "Examiner") + '</div>' : '') :
        '<p class="body-text"><strong>Your answer</strong> ' + html(item.firstAnswer || item.answer) + '</p>') +
      (item.followUpQuestion ? '<p class="body-text"><strong>Follow-up</strong> ' + html(item.followUpQuestion) + '</p><p class="body-text">' + html(item.answer) + '</p>' : '') +
      (item.feedback ? '<p class="body-text">' + html(item.feedback) + '</p>' : '') +
      (item.strength ? '<p class="body-text"><strong>Strength</strong> ' + html(item.strength) + '</p>' : '') +
      (item.gap ? '<p class="body-text"><strong>Next step</strong> ' + html(item.gap) + '</p>' : '') +
      '<p class="body-text"><strong>Model answer</strong> ' + html(item.question.answer) + '</p>' +
      (item.question.rubric ? '<p class="body-text"><strong>Rubric</strong> ' + html(item.question.rubric.join(" · ")) + '</p>' : '') +
      excerpt(item.question.reference) + sourceButton(item.question.reference) + '</details></article>').join("") + '</div>';
}

function questionBank() {
  const pack = activeData();
  if (!pack) { generateDialog(); return; }
  showDialog("Question bank","Edit prompts, answer keys, and scoring criteria before starting a session.",
    '<div class="stack">' + Object.entries(modes).map(([mode, details]) => '<section><h3>' + details.title + '</h3>' +
      pack[mode].map((question) => '<div class="resource row draft"><p>' + html(question.prompt) + '</p>' +
        '<button class="icon-button" data-action="edit-question:' + mode + ':' + html(question.id) + '" aria-label="Edit question">' + icon("pen") + '</button></div>').join("") + '</section>').join("") + '</div>');
}

function editQuestion(mode, questionId) {
  const question = data.pack?.[mode]?.find((item) => item.id === questionId);
  if (!question) return;
  const field = (label, name, value) => '<label class="field">' + label + '<input name="' + name + '" maxlength="250" required value="' + html(value) + '"></label>';
  const textField = (label, name, value) => '<label class="field">' + label + '<textarea name="' + name + '" maxlength="5000" required>' + html(value) + '</textarea></label>';
  showDialog("Edit question",modes[mode].title,
    '<form data-form="question" data-mode="' + mode + '" data-id="' + html(questionId) + '">' +
    field("Topic","topic",question.topic) + textField("Question","prompt",question.prompt) +
    textField("Model answer or explanation","answer",question.answer) +
    (mode === "quiz" ? question.options.map((option, index) => field("Option " + (index + 1),"option" + index,option)).join("") +
      '<label class="field">Correct option<select name="correct">' + question.options.map((_, index) => '<option value="' + index + '"' +
      (index === question.correct ? " selected" : "") + '>Option ' + (index + 1) + '</option>').join("") + '</select></label>' :
      textField("Rubric (one criterion per line)","rubric",question.rubric.join("\n"))) + formEnd("Save question"));
}

function editResource(kind, itemId = "") {
  const item = kind === "note" ? data.pack?.notes.find((note) => note.id === itemId) :
    kind === "topic" ? data.board.find((card) => card.id === itemId) : sourceById(itemId);
  if (itemId && !item) return;
  const word = kind === "source" ? "material" : kind;
  showDialog((item ? "Edit " : "Add ") + word, "",
    '<form data-form="' + kind + '" data-id="' + html(itemId) + '"><label class="field">Title<input name="title" required maxlength="180" value="' +
    html(item?.title ?? item?.name ?? "") + '"></label><label class="field">' + (kind === "topic" ? "Study task" : "Text") +
    '<textarea class="long" name="body" required maxlength="' + (kind === "source" ? maxText : 12000) + '">' +
    html(item?.body ?? item?.text ?? "") + '</textarea></label>' + formEnd(item ? "Save changes" : "Add topic"));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Studyroom could not read the file."));
    reader.readAsDataURL(blob);
  });
}

function paintDictation() {
  const area = main.querySelector('form[data-form="answer"] [name="answer"]');
  if (area && session && area.value !== session.draft) area.value = session.draft;
  const interim = main.querySelector(".dictation-interim");
  if (interim) interim.textContent = session?.interim || "";
}

function stopDictation() {
  dictation?.stop();
}

function toggleDictation() {
  if (dictation) { stopDictation(); return; }
  const current = session;
  if (!current || current.pending || !canListen) return;
  window.speechSynthesis?.cancel();
  current.error = "";
  current.interim = "";
  const active = dictate({
    lang:navigator.language,
    onText:(text) => {
      if (session !== current || !text) return;
      current.draft = [current.draft, text].filter(Boolean).join(" ").slice(0, 8000);
      paintDictation();
    },
    onInterim:(text) => { if (session === current) { current.interim = text; paintDictation(); } },
    onError:(message) => { if (session === current) current.error = message; },
    onEnd:() => {
      if (dictation !== active) return;
      dictation = null;
      current.interim = "";
      if (session === current && screen === "practice") { render(); main.querySelector('[name="answer"]')?.focus(); }
    },
  });
  dictation = active;
  render();
}

async function submitUpload(form, fields) {
  const files = [...form.elements.files.files];
  const pasted = fields.get("text").trim();
  const title = fields.get("title").trim();
  if (!files.length && !pasted) throw new Error("Choose a file or paste some study material.");
  if (title && !pasted) throw new Error("Add text for the pasted material title or clear the title.");
  if (files.length > 20) throw new Error("Upload up to 20 files at a time.");
  const sources = [];
  for (const file of files) {
    const name = file.name.slice(0, 250);
    if (/\.pdf$/i.test(file.name)) {
      if (file.size < 5 || file.size > maxPdf) throw new Error(file.name + " exceeds the PDF size limit or is empty.");
      if (await file.slice(0, 5).text() !== "%PDF-") throw new Error(file.name + " is not a valid PDF.");
      sources.push({ id:id(), type:"pdf", name, file:new Blob([file], { type:"application/pdf" }) });
    } else if (/\.(txt|md)$/i.test(file.name)) {
      if (file.size > maxText * 4) throw new Error(file.name + " exceeds the text size limit.");
      const text = (await file.text()).trim();
      if (!text || text.length > maxText) throw new Error(file.name + " is empty or exceeds 150,000 characters.");
      sources.push({ id:id(), type:"text", name, text });
    } else throw new Error("Choose PDF, TXT, or Markdown files.");
  }
  if (pasted) sources.push({ id:id(), type:"text", name:title || "Pasted study material", text:pasted });
  data.sources.push(...sources);
  await persist();
  return sources.length === 1 ? "Material added." : sources.length + " materials added.";
}

async function generatePack(fields) {
  const selected = fields.getAll("sources");
  if (!selected.length || selected.length > 8) throw new Error("Select between one and eight sources.");
  const sources = selected.map(sourceById);
  const pdfBytes = sources.reduce((size, source) => size + (source.file?.size || 0), 0);
  if (pdfBytes > maxPdf) throw new Error("Select up to 10 MB of PDFs per study pack.");
  const payload = await Promise.all(sources.map(async ({ id, name, type, file, text }) =>
    type === "pdf" ? { id, name, type, data:await blobToBase64(file) } : { id, name, type, text }));
  if (new Blob([JSON.stringify(payload)]).size > 14_900_000) throw new Error("This selection is too large. Choose fewer materials.");
  const result = await ai("bundle", { sources:payload });
  const withIds = (entries) => entries.map((item) => ({ ...item, id:id() }));
  const pack = {
    sample:false, sourceIds:selected, notes:withIds(result.notes), oral:withIds(result.oral),
    written:withIds(result.written), quiz:withIds(result.quiz),
  };
  data.pack = pack;
  const keys = new Set(data.board.map((item) => (item.reference?.sourceId || "") + "|" + item.title.toLowerCase()));
  for (const item of withIds(result.topics)) {
    const key = item.reference.sourceId + "|" + item.title.toLowerCase();
    if (!keys.has(key)) { data.board.push({ ...item, status:"todo" }); keys.add(key); }
  }
  await persist();
  return "Your study pack is ready.";
}

function saveQuestion(form, fields) {
  const { mode, id:questionId } = form.dataset;
  const question = data.pack[mode].find((item) => item.id === questionId);
  const updated = { topic:fields.get("topic").trim(), prompt:fields.get("prompt").trim(), answer:fields.get("answer").trim() };
  if (Object.values(updated).some((value) => !value)) throw new Error("Complete each question field.");
  if (mode === "quiz") {
    updated.options = Array.from({ length:4 }, (_, index) => fields.get("option" + index).trim());
    if (updated.options.some((option) => !option) || new Set(updated.options.map((option) => option.toLowerCase())).size !== 4) throw new Error("Enter four distinct answer options.");
    updated.correct = Number(fields.get("correct"));
  } else {
    updated.rubric = fields.get("rubric").split("\n").map((line) => line.trim()).filter(Boolean);
    if (!updated.rubric.length) throw new Error("Add at least one scoring criterion.");
  }
  Object.assign(question, updated);
}

async function submitModal(form) {
  if (modalBusy) return;
  const kind = form.dataset.form;
  const fields = new FormData(form);
  const labels = { key:"Connecting…", generate:"Generating…", upload:"Adding materials…" };
  let message = "Changes saved.";
  let destination;
  busyForm(form, true, labels[kind] || "Saving…");
  try {
    if (kind === "key") {
      const key = fields.get("key").trim();
      if (!key) throw new Error("Enter a Claude API key.");
      const result = await ai("connect", {}, key);
      if (result.status !== "ready") throw new Error("Claude could not confirm the connection.");
      apiKey = key;
      message = "Claude is connected.";
    } else if (kind === "upload") {
      message = await submitUpload(form, fields);
      destination = "materials";
    } else if (kind === "generate") {
      message = await generatePack(fields);
      destination = "notes";
    } else if (kind === "question") {
      saveQuestion(form, fields);
      await persist();
    } else if (kind === "remove-source") {
      data.sources = data.sources.filter((source) => source.id !== form.dataset.id);
      await persist();
      message = "Material removed.";
    } else if (kind === "end-session") {
      stopDictation();
      pauseLive("");
      stopGaze(false);
      window.speechSynthesis?.cancel();
      session = null;
      message = "Practice session ended.";
    } else {
      const title = fields.get("title").trim();
      const body = fields.get("body").trim();
      if (!title || !body) throw new Error("Enter a title and text.");
      if (kind === "source") {
        const item = sourceById(form.dataset.id);
        item.name = title;
        item.text = body;
        for (const entry of [...(data.pack?.notes || []), ...(data.pack?.oral || []), ...(data.pack?.written || []), ...(data.pack?.quiz || []), ...data.board]) {
          if (entry.reference?.sourceId === item.id) entry.reference.excerpt = "";
        }
      } else if (kind === "note") {
        Object.assign(data.pack.notes.find((note) => note.id === form.dataset.id), { title, body });
      } else {
        const card = data.board.find((entry) => entry.id === form.dataset.id);
        if (card) Object.assign(card, { title, body });
        else data.board.push({ id:id(), title, body, status:"todo" });
      }
      await persist();
    }
    if (kind === "key" && generateAfterConnecting) {
      generateAfterConnecting = false;
      generateDialog();
    } else if (kind === "question") questionBank();
    else modal.close();
    if (destination) navigate(destination);
    else render();
    notify(message);
  } catch (error) { showError(form, error.message || "Something went wrong. Try again."); }
  finally {
    modalBusy = false;
    if (form.isConnected) busyForm(form, false);
  }
}

function updateFiles(input) {
  const files = [...input.files];
  document.querySelector("#file-status").textContent = files.length ? files.map((file) => file.name).join(", ") : "Drop files here · up to 10 MB per PDF";
}

function moveCard(cardId, status) {
  const card = data.board.find((item) => item.id === cardId);
  if (!card || !Object.hasOwn(statuses, status) || card.status === status) return;
  card.status = status;
  void persist();
  render();
  const selected = document.querySelector('[data-status="' + CSS.escape(cardId) + '"]');
  selected?.focus();
  notify("Moved to " + statuses[status] + ".");
}

function reviewTopics() {
  const weak = report.answers.filter((item) => item.score < 75);
  for (const item of weak) {
    const found = data.board.find((card) => card.title.toLowerCase() === item.question.topic.toLowerCase() && card.reference?.sourceId === item.question.reference?.sourceId);
    if (found) {
      found.status = "review";
    } else data.board.push({ id:id(), title:item.question.topic, body:item.gap || "Review the source and practice this question again.", status:"review", reference:item.question.reference });
  }
  void persist();
  navigate("board");
  notify("Review topics added to your studyboard.");
}

function dispatch(element) {
  if (element.dataset.nav) { navigate(element.dataset.nav); return; }
  const [action, value, extra] = element.dataset.action.split(":");
  switch (action) {
    case "close": if (!modalBusy) modal.close(); break;
    case "settings": settings(); break;
    case "disconnect": apiKey = ""; modal.close(); render(); notify("Session key disconnected."); break;
    case "upload": uploadDialog(); break;
    case "generate": generateDialog(); break;
    case "choose-files": modalContent.querySelector('[name="files"]').click(); break;
    case "source": openSource(element.dataset.id, Number(element.dataset.page) || 0); break;
    case "edit-source": editResource("source", value); break;
    case "remove-source": {
      const source = sourceById(value);
      if (source) showDialog("Remove material?", "This deletes " + source.name + " from this browser’s workspace.", '<form data-form="remove-source" data-id="' + html(value) + '">' + formEnd("Remove material"));
      break;
    }
    case "edit-note": editResource("note", value); break;
    case "add-topic": editResource("topic"); break;
    case "edit-topic": editResource("topic", value); break;
    case "questions": questionBank(); break;
    case "edit-question": editQuestion(value, extra); break;
    case "start": begin(value); break;
    case "end-session":
      showDialog("End this practice session?", "Your answers from this unfinished session will be discarded.", '<form data-form="end-session">' + formEnd("End session")); break;
    case "practice-home": report = null; render(); break;
    case "review": report = data.history.find((item) => item.id === value); render(); window.scrollTo(0, 0); break;
    case "review-topics": reviewTopics(); break;
    case "retry": begin(report.mode, report); break;
    case "speak": {
      const phrase = new SpeechSynthesisUtterance(session.followUp || session.questions[session.index].prompt);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(phrase);
      break;
    }
    case "dictate": toggleDictation(); break;
    case "hang-up": hangUpLive(); break;
    case "live-resume": resumeLive(); break;
    case "live-pause": pauseLive("Paused. Resume when you’re ready."); break;
    case "live-done": liveAudio?.finish?.(); break;
    case "live-interrupt": if (session?.live?.status === "speaking") stopLiveAudio(); break;
    case "live-skip": if (session?.live && !session.live.finished) void liveStep(session, "skip"); break;
    case "live-repeat":
      if (session?.live?.lastSaid && session.live.status === "listening") {
        const current = session;
        const run = ++current.live.run;
        stopLiveAudio();
        void speakLive(current, run, current.live.lastSaid).then(() => { if (!liveStale(current, run)) listenLive(current, run); });
      }
      break;
    case "toggle-gaze": toggleGaze(); break;
    case "recalibrate-gaze":
      if (gazeCamera && session?.gaze) {
        session.gaze.recalibrate();
        session.gazeView = { status:"calibrating" };
        paintGaze();
      }
      break;
  }
}

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action],[data-nav]");
  if (control && !control.disabled) dispatch(control);
});
document.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === "answer") void submitAnswer(form);
  else if (form.dataset.form === "oral-setup") startOral(form);
  else if (form.dataset.form === "live-answer") {
    const answer = form.elements.answer.value.trim();
    if (answer && session?.live?.status === "listening") { form.reset(); submitLiveAnswer(session, answer); }
  }
  else void submitModal(form);
});
document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.name === "files") updateFiles(target);
  if (target.dataset.status) moveCard(target.dataset.status, target.value);
  if (target.name === "choice" && session) session.choice = Number(target.value);
});
document.addEventListener("input", (event) => {
  if (event.target.name === "answer" && event.target.form?.dataset.form === "answer" && session) session.draft = event.target.value;
});
document.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-card]");
  if (!card) return;
  dragged = card.dataset.card;
  event.dataTransfer.setData("text/plain", dragged);
  event.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragover", (event) => {
  const target = event.target.closest("[data-column],[data-drop]");
  if (!target || (target.dataset.column && !dragged) || (target.dataset.drop && !event.dataTransfer.types.includes("Files"))) return;
  event.preventDefault();
  target.classList.add("hovering");
  event.dataTransfer.dropEffect = target.dataset.column ? "move" : "copy";
});
document.addEventListener("dragleave", (event) => {
  const target = event.target.closest("[data-column],[data-drop]");
  if (target && !target.contains(event.relatedTarget)) target.classList.remove("hovering");
});
document.addEventListener("dragend", () => {
  dragged = "";
  document.querySelectorAll(".hovering").forEach((element) => element.classList.remove("hovering"));
});
document.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-column],[data-drop]");
  if (!target) return;
  event.preventDefault();
  target.classList.remove("hovering");
  if (target.dataset.column && dragged) moveCard(dragged, target.dataset.column);
  if (target.dataset.drop && event.dataTransfer.files.length) {
    const input = modalContent.querySelector('[name="files"]');
    input.files = event.dataTransfer.files;
    updateFiles(input);
  }
});
modal.addEventListener("cancel", (event) => { if (modalBusy) event.preventDefault(); });
modal.addEventListener("close", () => {
  generateAfterConnecting = false;
  pendingRetry = null;
  if (pdfUrl) { URL.revokeObjectURL(pdfUrl); pdfUrl = null; }
});
window.addEventListener("popstate", () => navigate(route()));
window.addEventListener("hashchange", () => { if (route() !== screen) navigate(route()); });
window.addEventListener("pagehide", () => { stopDictation(); pauseLive("Paused while the page was hidden. Resume to continue."); stopGaze(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) stopGaze(); });
document.querySelectorAll("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });

const stored = await loadWorkspace().catch(() => { persistenceAvailable = false; return null; });
if (stored) data = stored;
render();
if (!persistenceAvailable) notify("Browser storage is unavailable. Changes will last until this page closes.");
fetch("/api/config").then((response) => response.json()).then((settings) => {
  config = settings;
  document.querySelector("#connection-status").textContent = connected() ? "Connected" : "Connect your API key";
  document.documentElement.dataset.ai = connected() ? "connected" : "disconnected";
}).catch(() => {});
