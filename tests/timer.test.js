// Run with: jsc -m tests/timer.test.js
import { SleepTimer, formatRemaining } from '../timer.js';

let failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; print(`FAIL ${label}: got ${a}, expected ${e}`); }
}

let now = 1_000_000;
const timer = new SleepTimer(() => now);
eq(timer.active, false, 'inactive at start');
eq(timer.expired(), false, 'not expired when inactive');
timer.set(30);
eq(timer.active, true, 'active after set');
eq(timer.remainingMs(), 30 * 60 * 1000, 'full remaining');
now += 29 * 60 * 1000 + 59 * 1000;
eq(formatRemaining(timer.remainingMs()), '0:01', 'one second left');
eq(timer.expired(), false, 'not yet expired');
now += 1000;
eq(timer.expired(), true, 'expired at end');
timer.cancel();
eq(timer.active, false, 'inactive after cancel');
eq(formatRemaining(90 * 60 * 1000), '90:00', 'format minutes');

print(failed ? `${failed} FAILED` : 'ALL PASSED');
