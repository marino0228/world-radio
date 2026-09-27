// ポモドーロの切り替わりに鳴らすベル（音声ファイルは使わず、ブラウザ内で合成する）
let ctx = null;

// iPhone では、ボタンを押したときに音の準備をしておかないと、あとから鳴らせない
export function unlockChime() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq, at, dur, gain) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// 整数倍でない倍音を重ねて、金属のベルらしい響きにする
function bell(freq, at) {
  for (const [ratio, gain, dur] of [[1, 0.3, 2.2], [2.76, 0.12, 1.4], [5.4, 0.06, 0.8], [8.93, 0.03, 0.5]]) {
    tone(freq * ratio, at, dur, gain);
  }
}

// kind: 'focus'（集中スタート：1回）/ 'rest'（休憩スタート：2回）
export function playChime(kind) {
  unlockChime();
  if (!ctx) return;
  if (kind === 'focus') {
    bell(1319, 0);
  } else {
    bell(988, 0);
    bell(988, 0.45);
  }
}
