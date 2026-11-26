# Studyroom

Studyroom turns PDF, TXT, Markdown, and pasted materials into editable notes, studyboard cards, and oral, written, or multiple-choice practice exams.

## Run locally

Use Node.js 22 or newer. No dependencies are required.

```sh
npm run dev
```

Open [Studyroom](http://127.0.0.1:4173) and choose **AI settings**. Pick a provider, enter its API key, and click **Connect key**. Keys entered in the app stay in page memory until you disconnect or reload.

| Provider | Default model | Server key | Model override |
| --- | --- | --- | --- |
| [Google Gemini](https://aistudio.google.com/api-keys) | `gemini-3.8-flash` | `GEMINI_API_KEY` | `GEMINI_MODEL` |
| [OpenAI](https://platform.openai.com/api-keys) | `gpt-6-luna` | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| [Anthropic Claude](https://platform.claude.com/settings/keys) | `claude-haiku-5-5` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |

For a private local installation, copy `.env.example` to `.env` and set the keys you want the server to use. Use `AI_PROVIDER=gemini`, `openai`, or `anthropic` to set the startup choice. Model overrides need PDF input and structured output. Gemini also uses its low thinking level and handles its own audio. OpenAI uses `gpt-transcribe` for audio, configurable with `OPENAI_TRANSCRIPTION_MODEL`.

The sample pack works without a key. Its oral and written feedback uses simple keyword matching. All three providers handle generation, written grading, and oral follow-ups. Gemini and OpenAI can transcribe recordings up to 90 seconds per answer. With Claude, type the answer or transcript. The browser can read questions aloud with any provider.

The browser stores materials, generated packs, board changes, and completed exams in IndexedDB. Live AI requests send the relevant data to the selected provider. Each generation supports up to eight materials, 10 MiB of PDFs combined, and an overall request size limit. Generated PDF citations are model suggestions.

## Oral exam eye tracking

Eye tracking starts off in every oral exam. Choose **Turn on camera**, allow camera access, and hold your gaze on the webcam to calibrate. The moving dot shows approximate gaze relative to your camera baseline. The allowed area around that baseline is intentionally small; if gaze remains outside it for more than two seconds, the tracker shows a red alert. If your setup changes, choose **Recalibrate**. You can turn the camera off at any time.

The browser downloads the pinned [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker?tab=Web) and runs it locally in a dedicated worker. Studyroom discards camera frames and shows timestamped off-track alerts as they occur. These alerts are saved in the completed session's local review. Gaze is a rehearsal aid and is independent of the AI provider and exam scores. Camera access requires HTTPS or localhost and a browser with the required webcam, worker, and graphics APIs.

## Verify and build

```sh
npm test
npm run build
```

The build generates the Sites Worker entry point at `dist/server/index.js`. The tests exercise provider requests with simulated upstream responses.
