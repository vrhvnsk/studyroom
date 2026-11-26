const MIN_CALIBRATION_MS = 1_450;
const MAX_CALIBRATION_SPREAD = 0.15;
const MIN_VIEW_MS = 3_000;
const MAX_FRAME_GAP_MS = 400;
const OUT_OF_RANGE_MS = 2_000;
const CAMERA_RADIUS = 0.20;
const CAMERA_HYSTERESIS = 0.03;
const EYES = [
  { corners:[33, 133], lids:[159, 145], iris:468 },
  { corners:[362, 263], lids:[386, 374], iris:473 },
];

function eyePosition(points, eye) {
  const [left, right] = eye.corners.map((index) => points[index]);
  const [top, bottom] = eye.lids.map((index) => points[index]);
  const iris = points[eye.iris];
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const width = Math.hypot(dx, dy);
  if (width < 8) return null;
  const vertical = (from, to) => ((to.y - from.y) * dx - (to.x - from.x) * dy) / width;
  const openness = vertical(top, bottom) / width;
  if (openness < 0.10 || openness > 0.65) return null;
  return {
    x: ((iris.x - left.x) * dx + (iris.y - left.y) * dy) / (width * width) - 0.5,
    y: (vertical(top, iris) / width) - openness / 2,
  };
}

export function gazeSignal(landmarks, frameWidth, frameHeight) {
  if (!Array.isArray(landmarks) || landmarks.length < 478) return null;
  const indices = [1, ...EYES.flatMap(({ corners, lids, iris }) => [...corners, ...lids, iris])];
  const points = Object.fromEntries(indices.map((index) => [index, {
    x: landmarks[index]?.x * frameWidth,
    y: landmarks[index]?.y * frameHeight,
  }]));
  if (Object.values(points).some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return null;
  const [first, second] = EYES.map((eye) => eyePosition(points, eye));
  if (!first || !second) return null;
  const outerLeft = points[33];
  const outerRight = points[263];
  const nose = points[1];
  const width = Math.hypot(outerRight.x - outerLeft.x, outerRight.y - outerLeft.y);
  if (width < frameWidth * 0.12 || width > frameWidth * 0.85) return null;
  const headX = (nose.x - (outerRight.x + outerLeft.x) / 2) / width;
  const headY = (nose.y - (outerRight.y + outerLeft.y) / 2) / width;
  if (Math.abs(headX) > 0.30 || headY < 0.03 || headY > 0.70 || Math.abs(first.x - second.x) > 0.25) return null;
  return {
    x: 2.1 * (first.x + second.x) / 2 + 1.55 * headX,
    y: 3.7 * (first.y + second.y) / 2 + 1.65 * headY,
  };
}

const mean = (samples, axis) => samples.reduce((sum, sample) => sum + sample[axis], 0) / samples.length;

export function createGazeSession() {
  let baseline;
  let samples = [];
  let calibrationStarted;
  let previousTime;
  let smoothed;
  let current;
  let trackedMs = 0;
  let nearMs = 0;
  let untrackedMs = 0;
  let awaySince;
  let alertActive = false;
  const actionLog = [];

  function logAction(action) {
    actionLog.push({ action, at:new Date().toISOString() });
  }

  function clearAlert(action) {
    if (!alertActive) return;
    alertActive = false;
    logAction(action);
  }

  return {
    logAction,
    events() {
      return actionLog.map(({ action, at }) => ({ action, at }));
    },
    recalibrate(action = "Recalibration started") {
      clearAlert("Out-of-range alert cleared by recalibration");
      logAction(action);
      baseline = undefined;
      samples = [];
      calibrationStarted = undefined;
      previousTime = undefined;
      smoothed = undefined;
      current = undefined;
      awaySince = undefined;
    },
    sample(point, time) {
      if (!baseline) {
        if (!point || (previousTime !== undefined && time - previousTime > MAX_FRAME_GAP_MS)) {
          samples = [];
          calibrationStarted = undefined;
        }
        previousTime = time;
        if (!point) return { status:"unavailable", progress:0 };
        calibrationStarted ??= time;
        if (samples.length > 2 && Math.hypot(point.x - mean(samples, "x"), point.y - mean(samples, "y")) > MAX_CALIBRATION_SPREAD) {
          calibrationStarted = time;
          samples = [];
        }
        samples.push(point);
        const progress = Math.min(100, (100 * (time - calibrationStarted)) / MIN_CALIBRATION_MS);
        if (progress < 100 || samples.length < 5) return { status:"calibrating", progress };
        baseline = { x:mean(samples, "x"), y:mean(samples, "y") };
        samples = [];
        previousTime = undefined;
        logAction("Calibration completed");
      }
      const gap = previousTime === undefined ? 0 : time - previousTime;
      previousTime = time;
      const continuous = gap > 0 && gap <= MAX_FRAME_GAP_MS;
      const elapsed = continuous ? gap : 0;
      if (!continuous) {
        smoothed = undefined;
        awaySince = undefined;
        clearAlert("Out-of-range alert cleared because tracking was interrupted");
      }
      if (!point) {
        smoothed = undefined;
        current = undefined;
        awaySince = undefined;
        untrackedMs += elapsed;
        clearAlert("Out-of-range alert cleared because gaze became unavailable");
        return { status:"unavailable", progress:100 };
      }
      const offset = { x:point.x - baseline.x, y:point.y - baseline.y };
      smoothed = smoothed ? { x:0.35 * offset.x + 0.65 * smoothed.x, y:0.35 * offset.y + 0.65 * smoothed.y } : offset;
      const distance = Math.hypot(smoothed.x, smoothed.y);
      const threshold = current === "near" ? CAMERA_RADIUS + CAMERA_HYSTERESIS : CAMERA_RADIUS;
      current = distance <= threshold ? "near" : "away";
      trackedMs += elapsed;
      if (current === "near") {
        nearMs += elapsed;
        awaySince = undefined;
        clearAlert("Out-of-range alert cleared");
      } else {
        if (!continuous || awaySince === undefined) awaySince = time;
        if (!alertActive && time - awaySince > OUT_OF_RANGE_MS) {
          alertActive = true;
          logAction("Red alert activated: gaze remained outside the allowed area for more than 2 seconds");
        }
      }
      return { status:alertActive ? "alert" : current, progress:100, x:smoothed.x, y:smoothed.y };
    },
    summary() {
      const total = trackedMs + untrackedMs;
      return {
        trackedSeconds: Math.round(trackedMs / 1_000),
        coverage: total ? Math.round(100 * trackedMs / total) : 0,
        nearPercent: trackedMs >= MIN_VIEW_MS ? Math.round(100 * nearMs / trackedMs) : null,
      };
    },
  };
}
