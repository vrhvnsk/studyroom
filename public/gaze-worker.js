const packageUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32";
const modelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
let face;
let toSignal;

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const [{ FaceLandmarker, FilesetResolver }, math] = await Promise.all([
        import(packageUrl + "/vision_bundle.mjs"),
        import("./gaze-math.js"),
      ]);
      const resources = await FilesetResolver.forVisionTasks(packageUrl + "/wasm");
      face = await FaceLandmarker.createFromOptions(resources, {
        baseOptions:{ modelAssetPath:modelUrl, delegate:"CPU" },
        runningMode:"VIDEO",
        numFaces:1,
      });
      toSignal = math.gazeSignal;
      self.postMessage({ type:"ready" });
    } catch (error) {
      console.error("Eye tracking model could not load.", error);
      self.postMessage({ type:"error" });
    }
    return;
  }
  const { frame, time } = data;
  if (!frame) return;
  try {
    const result = face.detectForVideo(frame, time);
    const point = toSignal(result.faceLandmarks[0], frame.width, frame.height);
    self.postMessage({ type:"sample", point, time });
  } catch (error) {
    console.error("Eye tracking frame could not be processed.", error);
    self.postMessage({ type:"error" });
  } finally {
    frame.close();
  }
};
