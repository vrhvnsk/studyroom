const SAMPLE_INTERVAL_MS = 145;

export function startGazeCamera({ onState, onSample, onError }) {
  let closed = false;
  let stream;
  let worker;
  let video;
  let frames;
  let loadTimeout;
  let waiting = false;
  let lastFrameTime = -1;

  function stop() {
    if (closed) return;
    closed = true;
    clearTimeout(loadTimeout);
    clearInterval(frames);
    worker?.terminate();
    stream?.getTracks().forEach((track) => track.stop());
    if (video) {
      video.pause();
      video.srcObject = null;
      video.remove();
    }
  }

  function fail(message) {
    if (closed) return;
    stop();
    onError(message);
  }

  async function capture() {
    if (closed || waiting || document.hidden || video.readyState < 2 || lastFrameTime === video.currentTime) return;
    lastFrameTime = video.currentTime;
    waiting = true;
    const time = performance.now();
    try {
      const width = Math.min(480, video.videoWidth);
      const frame = await createImageBitmap(video, { resizeWidth:width, resizeHeight:Math.round(video.videoHeight * width / video.videoWidth) });
      if (closed) { frame.close(); return; }
      worker.postMessage({ type:"frame", frame, time }, [frame]);
    } catch {
      fail("The camera frames could not be processed. Try another browser or turn on tracking again.");
    }
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) {
      fail("Eye tracking needs a supported browser with webcam access.");
      return;
    }
    onState("permission");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video:{
        width:{ ideal:640 }, height:{ ideal:480 }, frameRate:{ ideal:15, max:24 }, facingMode:"user",
      }, audio:false });
    } catch (error) {
      const message = error.name === "NotAllowedError" ? "Camera access was blocked. Allow access in your browser, then try again." :
        error.name === "NotFoundError" ? "No camera was found. Connect a webcam and try again." :
        "The camera is unavailable. Close other apps using it and try again.";
      fail(message);
      return;
    }
    if (closed) { stream.getTracks().forEach((track) => track.stop()); return; }
    onState("loading");
    stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => fail("The camera disconnected. Turn tracking on to reconnect.")));
    try {
      video = document.createElement("video");
      video.className = "camera-input";
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("aria-hidden", "true");
      video.srcObject = stream;
      document.body.append(video);
      await video.play();
      if (closed) return;

      worker = new Worker("/gaze-worker.js");
      worker.onmessage = ({ data }) => {
        if (closed) return;
        if (data.type === "ready") {
          clearTimeout(loadTimeout);
          onState("ready");
          frames = setInterval(() => void capture(), SAMPLE_INTERVAL_MS);
        } else if (data.type === "sample") {
          waiting = false;
          onSample(data.point, data.time);
        } else if (data.type === "error") {
          fail("The tracking model could not run in this browser. Try again or continue without eye tracking.");
        }
      };
      worker.onerror = () => fail("The tracking model could not start. Try again or continue without eye tracking.");
      loadTimeout = setTimeout(() => fail("The tracking model took too long to load. Check your connection and try again."), 25_000);
      worker.postMessage({ type:"init" });
    } catch {
      fail("The camera could not start. Check your browser permissions and try again.");
    }
  }

  queueMicrotask(() => { if (!closed) void start(); });
  return { stop };
}
