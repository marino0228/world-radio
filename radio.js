// Radio Browser（https://www.radio-browser.info/）から局の一覧を取得する。
// このページは https で公開するので、https で配信している局だけを扱う（http の音声はブラウザが再生を止めるため）。
import { SEARCH_TAGS, radioGenres } from './genres.js';

export const PAGE_SIZE = 200;
const API_HOSTS = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info'];
const COMMON = 'hidebroken=true&is_https=true&order=clickcount&reverse=true';

export function flagEmoji(code) {
  if (!/^[A-Za-z]{2}$/.test(code || '')) return '';
  return [...code.toUpperCase()].map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)).join('');
}

export const countryStationsPath = (code) =>
  `/json/stations/bycountrycodeexact/${code.toUpperCase()}?${COMMON}&limit=500`;

export function searchPath(genre, offset) {
  const tag = SEARCH_TAGS[genre];
  return `/json/stations/search?${COMMON}&limit=${PAGE_SIZE}&offset=${offset}${tag ? `&tag=${tag}` : ''}`;
}

// Radio Browser の並び順（人気順）を保ったまま、https 以外・URLなし・重複を除く
export function toStations(raw) {
  const seen = new Set();
  const stations = [];
  for (const row of raw) {
    const url = row.url_resolved || '';
    if (!row.stationuuid || !url.startsWith('https://') || seen.has(row.stationuuid)) continue;
    seen.add(row.stationuuid);
    const code = (row.countrycode || '').toUpperCase();
    stations.push({
      id: row.stationuuid,
      name: (row.name || '').trim() || '(名称なし)',
      country: code,
      countryName: row.country || code,
      flag: flagEmoji(code),
      url,
      genres: radioGenres(row.tags),
      logo: (row.favicon || '').startsWith('https://') ? row.favicon : null,
    });
  }
  return stations;
}

// 1つのサーバーが落ちていても使えるよう、順に試す
export async function fetchJson(path) {
  let lastError;
  for (const host of API_HOSTS) {
    try {
      const res = await fetch(host + path);
      if (res.ok) return await res.json();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// Radio Browser へ「この局が再生された」と知らせる（人気順の集計に使われる。失敗しても無視）
export function reportClick(id) {
  fetch(`${API_HOSTS[0]}/json/url/${encodeURIComponent(id)}`).catch(() => {});
}
