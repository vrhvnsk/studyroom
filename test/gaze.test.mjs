import assert from "node:assert/strict";
import test from "node:test";
import { createGazeSession, gazeSignal } from "../public/gaze-math.js";

function face(shift = 0, blink = false) {
  const landmarks = Array.from({ length:478 }, () => ({ x:0, y:0 }));
  function set(index, x, y) { landmarks[index] = { x:x / 400, y:y / 300 }; }
  for (const [start, left, right, top, bottom, iris] of [[100,33,133,159,145,468], [170,362,263,386,374,473]]) {
    set(left, start, 90);
    set(right, start + 30, 90);
    set(top, start + 15, blink ? 89 : 85);
    set(bottom, start + 15, blink ? 91 : 95);
    set(iris, start + 15 + shift, 90);
  }
  set(1, 150, 120);
  return landmarks;
}

test("iris motion changes the returned signal and blinks or missing faces are excluded", () => {
  const neutral = gazeSignal(face(), 400, 300);
  const shifted = gazeSignal(face(6), 400, 300);
  assert.ok(shifted.x > neutral.x + 0.35);
  assert.equal(shifted.y, neutral.y);
  assert.equal(gazeSignal(face(0, true), 400, 300), null);
  assert.equal(gazeSignal(undefined, 400, 300), null);
});

test("calibration ignores time before a stable baseline, and the report tracks usable coverage", () => {
  const signal = createGazeSession();
  const center = { x:0.12, y:0.48 };
  assert.equal(signal.sample(null, 0).status, "unavailable");
  for (let time = 150; time < 1_650; time += 150) {
    assert.equal(signal.sample(center, time).status, "calibrating");
  }
  assert.equal(signal.sample(center, 1_650).status, "near");
  assert.equal(signal.summary().nearPercent, null);
  for (let time = 1_800; time <= 4_950; time += 150) signal.sample(center, time);
  assert.deepEqual(signal.summary(), { nearPercent:100, trackedSeconds:3, coverage:100 });
  for (let time = 5_100; time <= 7_500; time += 150) signal.sample(null, time);
  assert.ok(signal.summary().coverage < 60);
  const moved = { x:0.75, y:0.9 };
  assert.equal(signal.sample(moved, 15_000).status, "away");
  assert.equal(signal.summary().trackedSeconds, 3);
  signal.recalibrate();
  assert.equal(signal.sample(moved, 16_000).status, "calibrating");
  assert.equal(signal.summary().nearPercent, 100);
});

test("a large movement during calibration restarts the stable hold", () => {
  const signal = createGazeSession();
  for (let time = 0; time <= 1_350; time += 150) signal.sample({ x:0, y:0 }, time);
  const moved = signal.sample({ x:0.6, y:0 }, 1_500);
  assert.deepEqual(moved, { status:"calibrating", progress:0 });
});

test("the allowed area is smaller and a continuous excursion triggers a red alert after two seconds", () => {
  const signal = createGazeSession();
  const center = { x:0, y:0 };
  for (let time = 0; time <= 1_500; time += 150) signal.sample(center, time);

  const outside = { x:0.25, y:0 };
  assert.equal(signal.sample(outside, 1_650).status, "near");
  assert.equal(signal.sample(outside, 1_800).status, "near");
  assert.equal(signal.sample(outside, 1_950).status, "near");
  assert.equal(signal.sample(outside, 2_100).status, "near");
  assert.equal(signal.sample(outside, 2_250).status, "near");
  assert.equal(signal.sample(outside, 2_400).status, "away");
  assert.deepEqual(signal.events(), []);
  for (let time = 2_550; time <= 4_350; time += 150) assert.equal(signal.sample(outside, time).status, "away");
  assert.equal(signal.sample(outside, 4_400).status, "away");
  assert.equal(signal.sample(outside, 4_500).status, "alert");
  assert.equal(signal.sample(center, 4_650).status, "near");

  const events = signal.events();
  assert.equal(events.length, 1);
  assert.equal(events[0].action, "Gaze out of the allowed area for more than 2 seconds");
  assert.ok(events.every(({ at }) => !Number.isNaN(Date.parse(at))));
});

test("tracking interruptions clear the alert timer instead of counting missing samples", () => {
  const signal = createGazeSession();
  const center = { x:0, y:0 };
  for (let time = 0; time <= 1_500; time += 150) signal.sample(center, time);
  const outside = { x:0.25, y:0 };
  signal.sample(outside, 1_650);
  signal.sample(outside, 1_800);
  signal.sample(outside, 2_250);
  for (let time = 2_400; time <= 4_200; time += 150) assert.equal(signal.sample(outside, time).status, "away");
  assert.deepEqual(signal.events(), []);
  assert.equal(signal.sample(outside, 4_350).status, "alert");
});
