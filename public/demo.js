const sections = [
  ["Encoding", "Encoding converts experiences into a form that can be stored. Connecting new ideas to existing knowledge through elaboration creates more ways to recall them.", "How can elaboration improve encoding?", "Connect a new idea to something familiar so there are more cues for recalling it.", ["It creates additional retrieval cues", "It clears all older memories", "It eliminates the need to practice", "It prevents any forgetting"]],
  ["Retrieval practice", "Retrieval practice means bringing information to mind without looking at the answer. Attempting to recall an idea and then checking it strengthens later retrieval.", "Why is recalling an idea before checking the answer helpful?", "Trying to recall information exercises retrieval, and checking afterwards gives feedback that can correct mistakes.", ["It increases familiarity only", "It works like copying a definition", "It exercises recall and gives a chance to correct errors", "It makes feedback unnecessary"]],
  ["Spaced repetition", "Spacing distributes practice across separate sessions. Revisiting material after an interval makes recall more effortful and can improve long-term retention compared with cramming.", "How would you use spacing to study for an exam next week?", "Schedule several short sessions on different days and retrieve key ideas after each interval.", ["Practice exclusively just before the exam", "Read the chapter repeatedly in one sitting", "Replace all retrieval with highlighting", "Revisit the ideas in several sessions on different days"]],
];
const name = "Learning & memory";
const sourceId = "sample-learning";
const referenceFor = (excerpt) => ({ sourceId, page: 0, excerpt });
const actions = ["Connect a new term to a familiar example.", "Close your notes and explain one concept from memory.", "Schedule two short reviews on different days."];
const correctIndices = [0, 2, 3];

export function sampleWorkspace() {
  const notes = sections.map(([title, body], index) => ({ id: "sample-note-" + index, title, body, reference: referenceFor(body) }));
  const board = notes.map((note, index) => ({
    id: "sample-topic-" + index, title: note.title, body: actions[index], reference: note.reference,
    status: ["todo", "review", "done"][index],
  }));
  const oral = sections.map(([topic, body, prompt, answer], index) => ({
    id: "sample-oral-" + index, topic, prompt, answer, reference: referenceFor(body),
    rubric: ["State the main concept", "Explain how or why it works", "Use a clear example or application"],
  }));
  const writtenPrompts = [
    "A student memorizes a definition word for word. Describe another way they could encode it and explain why it might help.",
    "Compare rereading with retrieval practice. Explain how a student could use feedback after a recall attempt.",
    "Compare a three-hour cram session with three one-hour sessions spread over a week. Explain the likely effect on long-term retention.",
  ];
  const written = oral.map((q, index) => ({ ...q, id: "sample-written-" + index, prompt: writtenPrompts[index] }));
  const quiz = sections.map(([topic, body, prompt, answer, options], index) => ({
    id: "sample-quiz-" + index, topic, prompt, answer, options, correct: correctIndices[index], reference: referenceFor(body),
  }));
  return {
    sources: [{ id: sourceId, name, type: "text", text: sections.map(([title, body]) => title + "\n" + body).join("\n\n"), sample: true }],
    pack: { sample: true, notes, oral, written, quiz, sourceIds: [sourceId] },
    board,
    history: [],
  };
}
