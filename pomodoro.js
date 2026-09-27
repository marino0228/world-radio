// ポモドーロタイマー：25分集中＋5分休憩をくり返し、4回目の集中のあとは15分休憩。
// 終了時刻で判定するので、画面ロック中に処理が止まっても、再開時に正しい段階へ追いつける。
import { formatRemaining } from './timer.js';

export const FOCUS_MS = 25 * 60 * 1000;
export const SHORT_MS = 5 * 60 * 1000;
export const LONG_MS = 15 * 60 * 1000;
export const SETS = 4;

export class Pomodoro {
  constructor(clock = () => Date.now()) {
    this.clock = clock;
    this.stop();
  }

  get active() {
    return this.phase !== null;
  }

  start() {
    this.phase = 'focus';
    this.set = 1;
    this.endAt = this.clock() + FOCUS_MS;
  }

  stop() {
    this.phase = null; // 'focus' | 'short' | 'long'
    this.set = 0;
    this.endAt = null;
  }

  remainingMs() {
    return this.active ? Math.max(0, this.endAt - this.clock()) : 0;
  }

  // 終了時刻を過ぎていれば次の段階へ進め、新しい段階を返す（変化がなければ null）
  advance() {
    if (!this.active) return null;
    let changed = null;
    while (this.clock() >= this.endAt) {
      if (this.phase === 'focus') {
        const long = this.set % SETS === 0;
        this.phase = long ? 'long' : 'short';
        this.endAt += long ? LONG_MS : SHORT_MS;
      } else {
        this.phase = 'focus';
        this.set += 1;
        this.endAt += FOCUS_MS;
      }
      changed = this.phase;
    }
    return changed;
  }
}

export function pomodoroLabel(pomodoro) {
  const left = formatRemaining(pomodoro.remainingMs());
  if (pomodoro.phase === 'focus') return `集中 ${left} · ${((pomodoro.set - 1) % SETS) + 1}/${SETS}`;
  if (pomodoro.phase === 'short') return `休憩 ${left}`;
  if (pomodoro.phase === 'long') return `長い休憩 ${left}`;
  return 'ポモドーロ';
}
