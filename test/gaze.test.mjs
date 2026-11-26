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

test("gaze feedback distinguishes in-range, boundary, and out-of-bounds zones", () => {
  function zoneAt(x) {
    const signal = createGazeSession();
    for (let time = 0; time <= 1_500; time += 150) signal.sample({ x:0, y:0 }, time);
    let sample;
    for (let time = 1_650; time <= 4_500; time += 150) sample = signal.sample({ x, y:0 }, time);
    return sample.zone;
  }
  assert.equal(zoneAt(0.20), "inside");
  assert.equal(zoneAt(0.25), "edge");
  assert.equal(zoneAt(0.31), "outside");
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
  assert.deepEqual(signal.summary(), {
    nearPercent:100, trackedSeconds:3, coverage:100, awaySeconds:0, longestAwaySeconds:0, awayEpisodes:0,
  });
  for (let time = 5_100; time <= 7_500; time += 150) signal.sample(null, time);
  assert.ok(signal.summary().coverage < 60);
  const moved = { x:0.75, y:0.9 };
  assert.equal(signal.sample(moved, 15_000).status, "away");
  assert.equal(signal.summary().trackedSeconds, 3);
  signal.recalibrate();
  assert.equal(signal.sample(moved, 16_000).status, "calibrating");
  assert.equal(signal.summary().nearPercent, 100);
});

test("only continuous gaze shifts of eight seconds or more create a review signal", () => {
  const signal = createGazeSession();
  for (let time = 0; time <= 1_500; time += 150) signal.sample({ x:0, y:0 }, time);
  for (let time = 1_650; time < 9_450; time += 150) signal.sample({ x:0.8, y:0.8 }, time);
  assert.equal(signal.summary().awayEpisodes, 0, "a shift shorter than eight seconds is not flagged");
  signal.sample({ x:0.8, y:0.8 }, 9_450);
  assert.equal(signal.summary().awayEpisodes, 0);
  signal.sample({ x:0.8, y:0.8 }, 9_600);
  assert.equal(signal.summary().awayEpisodes, 1);
  assert.equal(signal.summary().longestAwaySeconds, 8);
  assert.equal(signal.summary().nearPercent, 0);
});

test("untracked gaps break continuity rather than extending a gaze-shift signal", () => {
  const signal = createGazeSession();
  for (let time = 0; time <= 1_500; time += 150) signal.sample({ x:0, y:0 }, time);
  for (let time = 1_650; time < 9_000; time += 150) signal.sample({ x:0.8, y:0.8 }, time);
  signal.sample(null, 9_150);
  for (let time = 9_300; time < 16_650; time += 150) signal.sample({ x:0.8, y:0.8 }, time);
  assert.equal(signal.summary().awayEpisodes, 0);
});

test("a large movement during calibration restarts the stable hold", () => {
  const signal = createGazeSession();
  for (let time = 0; time <= 1_350; time += 150) signal.sample({ x:0, y:0 }, time);
  const moved = signal.sample({ x:0.6, y:0 }, 1_500);
  assert.deepEqual(moved, { status:"calibrating", progress:0 });
});
