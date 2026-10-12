// 再生中の曲のジャケット画像を、Apple の iTunes Search API（ブラウザから直接使える）で探す。
// 曲名は ICY の StreamTitle（「アーティスト - 曲名」）。番組名やCMのときは探さない。
const SEARCH_URL = 'https://itunes.apple.com/search';
const SKIP = /\b(advert|advertisement|commercial|jingle|station id|news)\b|コマーシャル|ＣＭ|^cm\b/i;

export function artworkTerm(streamTitle) {
  const text = (streamTitle || '').trim();
  const parts = text.split(/\s+[-–—]\s+/);
  if (parts.length < 2 || SKIP.test(text)) return null; // 「アーティスト - 曲名」の形でなければ曲ではない
  const artist = parts[0].trim();
  const title = parts.slice(1).join(' ').replace(/[([（【].*?[)\]）】]/g, '').trim();
  return artist && title ? `${artist} ${title}` : null;
}

export function bigArtwork(response) {
  const url = response?.results?.[0]?.artworkUrl100 || '';
  return url.startsWith('https://') ? url.replace('100x100bb', '600x600bb') : null;
}

const cache = new Map(); // 曲名 → 画像URL（見つからなければ null）

export async function fetchArtwork(streamTitle) {
  const term = artworkTerm(streamTitle);
  if (!term) return null;
  if (!cache.has(term)) {
    try {
      const res = await fetch(`${SEARCH_URL}?media=music&entity=song&limit=1&term=${encodeURIComponent(term)}`);
      cache.set(term, res.ok ? bigArtwork(await res.json()) : null);
    } catch {
      return null; // 通信できないときは次の曲で試し直す
    }
  }
  return cache.get(term);
}

export function splitTrack(streamTitle) {
  const text = (streamTitle || '').trim();
  const parts = text.split(/\s+[-–—]\s+/);
  if (parts.length < 2) return { song: text, artist: '' };
  return { song: parts.slice(1).join(' - ').trim(), artist: parts[0].trim() };
}
