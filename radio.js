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

export const tagSearchPath = (tag) =>
  `/json/stations/search?${COMMON}&limit=60&tag=${encodeURIComponent(tag)}`;

// 局名で探す（名前の一部でよい）。人気順
export function nameSearchPath(query) {
  const q = (query || '').trim();
  return q ? `/json/stations/search?${COMMON}&limit=60&name=${encodeURIComponent(q)}` : null;
}

export function searchPath(genre, offset, limit = PAGE_SIZE) {
  const tag = SEARCH_TAGS[genre];
  return `/json/stations/search?${COMMON}&limit=${limit}&offset=${offset}${tag ? `&tag=${tag}` : ''}`;
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
      // おすすめ用：タグ（小文字・最大8個）と主な言語
      tags: [...new Set((row.tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8),
      language: (row.language || '').split(',')[0].trim().toLowerCase(),
      // 現地時間用：局の場所（分かる局だけ）
      lat: typeof row.geo_lat === 'number' ? row.geo_lat : null,
      lon: typeof row.geo_long === 'number' ? row.geo_long : null,
      state: (row.state || '').trim(),
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

// ジャンルごとの段（ホーム）。複数のジャンルを持つ局は上の段に一度だけ出し、局のない段は出さない
export function buildRows(stations, genreIds, size) {
  const seen = new Set();
  const rows = [];
  for (const genre of genreIds) {
    const picked = stations.filter((s) => s.genres.includes(genre) && !seen.has(s.id)).slice(0, size);
    for (const s of picked) seen.add(s.id);
    if (picked.length) rows.push({ genre, stations: picked });
  }
  return rows;
}
