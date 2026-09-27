// Run with: jsc -m tests/pomodoro.test.js
import { FOCUS_MS, LONG_MS, Pomodoro, SHORT_MS, pomodoroLabel } from '../pomodoro.js';

let failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; print(`FAIL ${label}: got ${a}, expected ${e}`); }
}
const MIN = 60 * 1000;
let now = 1_000_000;
const p = new Pomodoro(() => now);

eq([FOCUS_MS, SHORT_MS, LONG_MS], [25 * MIN, 5 * MIN, 15 * MIN], 'lengths');
eq(p.active, false, 'inactive at first');
p.start();
eq([p.phase, p.set, p.remainingMs()], ['focus', 1, 25 * MIN], 'starts focusing');
eq(pomodoroLabel(p), '集中 25:00 · 1/4', 'focus label');
now += 25 * MIN - 1000;
eq(p.advance(), null, 'no change before the end');
now += 1000;
eq(p.advance(), 'short', 'focus -> short break');
eq([p.remainingMs(), pomodoroLabel(p)], [5 * MIN, '休憩 5:00'], 'short break length and label');
now += 5 * MIN;
eq([p.advance(), p.set], ['focus', 2], 'short break -> focus, set 2');

// sets 2,3 then the 4th focus ends in a long break
now += 25 * MIN; p.advance(); now += 5 * MIN; p.advance(); // set 3
now += 25 * MIN; p.advance(); now += 5 * MIN; p.advance(); // set 4
eq([p.phase, p.set], ['focus', 4], 'fourth focus');
now += 25 * MIN;
eq(p.advance(), 'long', 'fourth focus -> long break');
eq(pomodoroLabel(p), '長い休憩 15:00', 'long break label');
now += 15 * MIN;
eq([p.advance(), p.set, pomodoroLabel(p)], ['focus', 5, '集中 25:00 · 1/4'], 'cycle restarts');

// phone asleep: jump 31 minutes from a fresh start -> already 1 minute into set 2
const q = new Pomodoro(() => now);
q.start();
now += 31 * MIN;
eq([q.advance(), q.set, q.remainingMs()], ['focus', 2, 24 * MIN], 'catches up after sleeping');

q.stop();
eq([q.active, q.advance(), q.remainingMs()], [false, null, 0], 'stopped');

print(failed ? `${failed} FAILED` : 'ALL PASSED');
