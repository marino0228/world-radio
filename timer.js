// おやすみタイマー。終了時刻で判定するので、画面ロック中に時計の処理が止まっても、再開時に正しく判定できる。
export class SleepTimer {
  constructor(clock = () => Date.now()) {
    this.clock = clock;
    this.endAt = null;
  }

  get active() {
    return this.endAt !== null;
  }

  set(minutes) {
    this.endAt = this.clock() + minutes * 60 * 1000;
  }

  cancel() {
    this.endAt = null;
  }

  remainingMs() {
    return this.active ? Math.max(0, this.endAt - this.clock()) : 0;
  }

  expired() {
    return this.active && this.remainingMs() === 0;
  }
}

export function formatRemaining(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
