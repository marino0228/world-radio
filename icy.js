// ラジオ配信の ICY メタデータ（StreamTitle='アーティスト - 曲名'）を、ブラウザから直接読む。
// 放送局が他サイトからの読み取りを許可している（CORS）局でだけ動く。許可がなければ null。
const MAX_META = 255 * 16;
// UTF-8 として読み、壊れていれば 1バイト1文字として読む（TextDecoder がない環境でも動くように）
function decodeUtf8(bytes) {
  try {
    return decodeURIComponent(Array.from(bytes, (b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return String.fromCharCode(...bytes);
  }
}

export function parseStreamTitle(bytes) {
  const text = decodeUtf8(bytes).replace(/\0+$/, '');
  const match = /StreamTitle='(.*?)';/s.exec(text);
  let title = match ? match[1].trim() : '';
  if (!title.includes(' ') && title.includes('+')) title = title.replace(/\+/g, ' '); // 空白を「+」で送る局がある
  title = title.slice(0, 200);
  return title || null;
}

// 受け取ったデータを順にため、最初のメタデータの塊から曲名を取り出す
export class IcyReader {
  constructor(metaint) {
    this.metaint = metaint;
    this.buffer = new Uint8Array(0);
  }

  // まだ足りなければ undefined、読み終えたら曲名（なければ null）を返す
  push(chunk) {
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;
    if (this.buffer.length <= this.metaint) return undefined;
    const length = this.buffer[this.metaint] * 16;
    if (this.buffer.length < this.metaint + 1 + length) return undefined;
    return parseStreamTitle(this.buffer.subarray(this.metaint + 1, this.metaint + 1 + length));
  }
}

export async function fetchStreamTitle(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'Icy-MetaData': '1' }, cache: 'no-store', signal: controller.signal });
    const metaint = parseInt(res.headers.get('icy-metaint') || '0', 10);
    if (!res.ok || !metaint || !res.body) return null;
    const reader = new IcyReader(metaint);
    const stream = res.body.getReader();
    let received = 0;
    while (received <= metaint + 1 + MAX_META) {
      const { value, done } = await stream.read();
      if (done) return null;
      received += value.length;
      const title = reader.push(value);
      if (title !== undefined) return title;
    }
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort(); // 音声のダウンロードを止める
  }
}
