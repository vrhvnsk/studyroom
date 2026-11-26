# Studyroom

Studyroom turns PDF, TXT, Markdown, and pasted materials into editable notes, studyboard cards, and oral, written, or multiple-choice practice exams.

## Run locally

Use Node.js 22 or newer. No dependencies are required.

```sh
npm run dev
```

Open [Studyroom](http://127.0.0.1:4173) and choose **Gemini settings** to connect a [Google AI Studio key](https://aistudio.google.com/api-keys). The key stays in page memory until a disconnect or reload. For a private local or hosted installation, you can set `GEMINI_API_KEY` in a local `.env` file or in the hosting environment. The default model is `gemini-3.8-flash`. An override through `GEMINI_MODEL` needs structured output, PDF and audio input, and support for the low thinking level.

The bundled sample pack works without a key. Its oral and written feedback uses simple keyword matching. Generated packs use Gemini. Oral sessions record each turn locally up to 90 seconds, send the recording to Gemini for transcription, and let the learner edit the transcript before submitting. The question can be read aloud using browser speech synthesis.

The browser stores materials, generated packs, board changes, and completed exams in IndexedDB. Live Gemini requests send selected sources, recordings, or submitted answers to Google as needed. The app has no database-backed sync. Each generation supports up to eight materials, 10 MiB of PDFs combined, and an overall request size limit. Generated PDF citations are model suggestions.

## Oral exam eye tracking

Eye tracking starts off in every oral exam. Choose **Turn on camera**, allow camera access, and hold your gaze on the webcam to calibrate. The moving dot shows approximate gaze relative to your camera baseline. The allowed area around that baseline is intentionally small; if gaze remains outside it for more than two seconds, the tracker shows a red alert. If your setup changes, choose **Recalibrate**. You can turn the camera off at any time.

The browser downloads the pinned [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker?tab=Web) and runs it locally in a dedicated worker. Studyroom discards camera frames and saves aggregate results plus a timestamped log of eye-tracking actions in the completed session's local review. Gaze is a rehearsal aid and is independent of Gemini and exam scores. Camera access requires HTTPS or localhost and a browser with the required webcam, worker, and graphics APIs.

## Verify and build

```sh
npm test
npm run build
```

The build generates the Sites Worker entry point at `dist/server/index.js`. The tests exercise the Gemini request paths with simulated upstream responses.
