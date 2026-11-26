# Studyroom

Studyroom turns PDF, TXT, Markdown, and pasted materials into editable notes, studyboard cards, and oral, written, or multiple-choice practice exams.

## Run locally

Use Node.js 22 or newer. No dependencies are required.

```sh
npm run dev
```

Open [Studyroom](http://127.0.0.1:4173) and choose **Gemini settings** to connect an [Anthropic API key](https://console.anthropic.com/settings/keys). The key stays in page memory until a disconnect or reload. For a private local or hosted installation, you can set `ANTHROPIC_API_KEY` in a local `.env` file or in the hosting environment. The default model is `claude-opus-5-5`; override it with `CLAUDE_MODEL`. Requests opt into Anthropic's server-side refusal fallback, and an overloaded API is retried once.

To check a key against every Anthropic API path the app uses, run `npm run check`. It asks for the key, or reads `ANTHROPIC_API_KEY`, and never prints it.

The bundled sample pack works without a key. Its oral and written feedback uses simple keyword matching. Anthropic powers generated packs, grading, and spoken examiners. In the classic oral exam you can dictate each answer with your browser's speech recognition, edit it, and submit it. The question can be read aloud using browser speech synthesis.

The browser stores materials, generated packs, board changes, and completed exams in IndexedDB. Studyroom sends selected sources or submitted answers to Anthropic as needed. The app has no database-backed sync. Each generation supports up to eight materials, 10 MiB of PDFs combined, and an overall request size limit. Generated PDF citations are model suggestions.

## Spoken oral exams

When your API key is connected, starting an oral exam lets you pick a spoken examiner or the classic one-question-at-a-time flow. In a spoken exam the examiner asks each question in character, listens to your answer, and asks up to two follow-ups before moving on.

| Examiner | Style | Voice style |
| --- | --- | --- |
| Warm mentor | Patient and encouraging | Gentle, slightly slower |
| Strict professor | Formal, presses for precise terms | Low and measured |
| Socratic coach | Answers with probing questions | Calm and even |
| Game-show host | High energy and playful | Fast and bright |
| Study buddy | A relaxed classmate | Casual and quick |

Each turn goes through `/api/ai` (`examine`) to Anthropic. The route returns the examiner's next line, whether to move on, and the language being spoken. The server keeps the persona prompts, so the browser only names the examiner. Your browser reads each line aloud with an installed voice chosen for that examiner, preferring natural or online voices, and then listens with its speech recognition until you pause. You can say **Done speaking**, type instead, interrupt, repeat the last line, skip, or pause and resume. Speech recognition works best in Chrome or Edge, which send the audio to their own speech service. In a browser without it, you type your answers while the examiner still speaks.

When the examiner moves on, Studyroom grades that question from its transcript. The grader scores only what you said, so the examiner's personality and hints never change your score. The session review shows each conversation alongside the feedback.

## Oral exam eye tracking

Eye tracking starts off in every oral exam. Choose **Turn on camera**, allow camera access, and hold your gaze on the webcam to calibrate. The moving dot shows approximate gaze relative to your camera baseline. If your setup changes, choose **Recalibrate**. You can turn the camera off at any time.

The browser downloads the pinned [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker?tab=Web) and runs it locally in a dedicated worker. Studyroom discards frames and saves only aggregate results in the completed session's local review. The review may note gaze shifts sustained for at least eight seconds; this is a limited observation, not cheating detection or evidence of misconduct. Gaze shifts can happen for many ordinary reasons, and these observations never affect exam scores. Camera access requires HTTPS or localhost and a browser with the required webcam, worker, and graphics APIs.

## Verify and build

```sh
npm test
npm run build
```

The build generates the Sites Worker entry point at `dist/server/index.js`. The tests exercise the Anthropic request paths with simulated upstream responses.
