const MAX_TURN_CHARS = 4_000;
const MAX_CONVERSATION_CHARS = 20_000;
const clean = (text) => text.replace(/\s+/g, " ").trim();

// Keeps each question's conversation separately, merging consecutive lines from the same speaker.
export function createLiveTranscript(questionCount) {
  const questions = Array.from({ length:questionCount }, () => []);
  return {
    add(index, role, text) {
      const turns = questions[index];
      if (!turns || !text) return;
      const last = turns.at(-1);
      if (last?.role === role) last.text += " " + text;
      else turns.push({ role, text });
    },
    turns(index) {
      return (questions[index] || []).map(({ role, text }) => ({ role, text:clean(text).slice(0, MAX_TURN_CHARS) })).filter(({ text }) => text);
    },
    learnerText(index) {
      return this.turns(index).filter(({ role }) => role === "learner").map(({ text }) => text).join(" ");
    },
  };
}

// Builds the grading request for one question, keeping the newest turns within the request limit.
export function liveAttempt(question, turns) {
  const conversation = [];
  let total = 0;
  for (const turn of [...turns].reverse()) {
    const text = turn.text.slice(0, MAX_TURN_CHARS);
    if (total + text.length > MAX_CONVERSATION_CHARS) break;
    total += text.length;
    conversation.unshift({ role:turn.role, text });
  }
  return {
    mode:"oral-live", question:question.prompt, modelAnswer:question.answer, rubric:question.rubric || [],
    sourceExcerpt:question.reference?.excerpt || "", conversation, allowFollowUp:false,
  };
}
