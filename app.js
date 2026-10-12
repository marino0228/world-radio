import { GENRES, genreLabel } from './genres.js';
import { fetchStreamTitle } from './icy.js';
import {
  PAGE_SIZE, buildRows, countryStationsPath, fetchJson, flagEmoji, nameSearchPath, reportClick, searchPath, tagSearchPath, toStations,
} from './radio.js';
import { reasonText, recommend, recordPlay, tasteProfile, topTags } from './recommend.js';
import { SleepTimer, formatRemaining } from './timer.js';
import { Pomodoro, pomodoroLabel } from './pomodoro.js';
import { playChime, unlockChime } from './chime.js';
import { stationTimeZone } from './timezone.js';
import { fetchArtwork, splitTrack } from './artwork.js';

const $ = (selector) => document.querySelector(selector);
const FAVORITES_KEY = 'world-radio-favorites';
const PREFS_KEY = 'world-radio-prefs';
const HISTORY_KEY = 'soto-oto-history';
const ROW_SIZE = 15; // ホームの段に並べる局の数
const PLAY_ICON = 'M8 5v14l11-7z';
const PAUSE_ICON = 'M7 5h4v14H7zM13 5h4v14h-4z';
const TRACK_INTERVAL_MS = 20000;
const RADIO_ICON = 'M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm1.5-1.2 11-4.3.7 1.9-6.4 2.4zM8 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm6 1v1.5h5V12zm0 3v1.5h5V15z';
// ジャンルの選択画面のアイコン（24×24 の線画）と色
const GENRE_ICONS = {
  all: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3a15 15 0 0 0-1.3-6 8 8 0 0 1 4.3 6zM12 4c.9 1.2 1.7 3.6 1.9 7h-3.8c.2-3.4 1-5.8 1.9-7zM9.4 5a15 15 0 0 0-1.3 6h-3a8 8 0 0 1 4.3-6zM5.1 13h3a15 15 0 0 0 1.3 6 8 8 0 0 1-4.3-6zm5 0h3.8c-.2 3.4-1 5.8-1.9 7-.9-1.2-1.7-3.6-1.9-7zm4.5 6a15 15 0 0 0 1.3-6h3a8 8 0 0 1-4.3 6z',
  news: 'M4 5h13v14H5a1 1 0 0 1-1-1zm15 3h2v10a1 1 0 0 1-2 0zM7 8v3h7V8zm0 5v1.5h7V13zm0 3v1.5h5V16z',
  talk: 'M4 4h16v11H9l-5 4z',
  music: 'M10 4v10.5A3.5 3.5 0 1 0 12 17.7V8h6V4z',
  classical: 'M15 3l3 3-5.5 5.5 1 1-1.4 1.4-1-1L7 17.1A2.5 2.5 0 1 1 5 15l4.1-4.1-1-1L9.5 8.5l1 1z',
  jazz: 'M9 3h8v3h-5v8a4 4 0 1 1-3-3.9z',
  healing: 'M20 4c-8 0-14 4-14 11 0 1.2.2 2.3.6 3.3L4 21l1.4 1.4 2.5-2.5c1 .5 2.2.8 3.4.8C17 20.7 20 14 20 4z',
  sports: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.2 2.4 1.8-.9 2.8h-3l-.9-2.8zM6.3 8.6l2.4.8.9 2.8-1.8 2.4-2.6-.1a7.9 7.9 0 0 1 1.1-5.9zm11.4 0a7.9 7.9 0 0 1 1.1 5.9l-2.6.1-1.8-2.4.9-2.8zM10.4 15h3.2l1.3 2.6a8 8 0 0 1-5.8 0z',
  religious: 'M11 2h2v5h5v2h-5v13h-2V9H6V7h5z',
  general: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
};
const GENRE_TONES = {
  all: 'var(--mint)', news: 'var(--salmon)', talk: 'var(--salmon)', music: 'var(--lavender)',
  classical: 'var(--butter)', jazz: 'var(--butter)', healing: 'var(--mint)', sports: 'var(--butter)',
  religious: 'var(--lavender)', general: 'var(--muted)',
};
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['ja'], { type: 'region' });
  } catch {
    return null;
  }
})();

// --- 端末に保存する情報（使えなくても動くように） ---
function load(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できなくても再生は続ける
  }
}

const prefs = { country: 'JP', genre: 'all', ...load(PREFS_KEY, {}) };
const state = {
  country: prefs.country,
  genre: prefs.genre,
  pool: [], // 国を選んだときの、その国の全局
  shown: 0, // ジャンル表示で出した件数（国を選んだとき）
  nextOffset: null, // すべての国で、次に取る位置
  known: new Map(), // 画面に出した局（同じジャンルの局の一覧に使う）
  current: null,
  track: null, // 再生中の曲名（取れる局だけ）
  cover: null, // 再生中の曲のジャケット画像
  hls: null,
  token: 0,
  trackTimer: null,
  trackToken: 0,
  searchToken: 0,
};
const sleep = new SleepTimer();
const pomodoro = new Pomodoro();
let favorites = Array.isArray(load(FAVORITES_KEY, [])) ? load(FAVORITES_KEY, []) : [];
let history = (() => {
  const saved = load(HISTORY_KEY, {});
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
})();
const recCache = new Map(); // タグ → そのタグの人気局
let recToken = 0;

// --- 小さな部品 ---
const countryName = (code, fallback) => {
  try {
    return (code && regionNames?.of(code)) || fallback || code;
  } catch {
    return fallback || code;
  }
};
const hueFor = (id) => [...(id || '')].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 360, 7);
const isFavorite = (id) => favorites.some((s) => s.id === id);
const recentStations = () => Object.values(history).sort((a, b) => b.lastAt - a.lastAt).map((e) => e.station);

function svgIcon(d, className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

// 正方形のアートワーク：局の色の背景にロゴ。曲のジャケットがあればそれを全面に
function artElement(station, cover = null) {
  const art = document.createElement('div');
  art.className = 'art';
  art.style.setProperty('--hue', hueFor(station.id));
  const radio = () => svgIcon(RADIO_ICON, 'radio-icon');
  if (station.logo) {
    const img = document.createElement('img');
    img.className = 'logo';
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.src = station.logo;
    img.addEventListener('error', () => img.replaceWith(radio()), { once: true });
    art.append(img);
  } else {
    art.append(radio());
  }
  if (cover) {
    const img = document.createElement('img');
    img.className = 'cover';
    img.alt = '';
    img.src = cover;
    img.addEventListener('error', () => img.remove(), { once: true });
    art.append(img);
  }
  return art;
}

function remember(stations) {
  for (const s of stations) state.known.set(s.id, s);
  return stations;
}

// 一覧のタイル：アートワークに国旗と局名を重ね、右上に ☆
function tile(station, reason = '') {
  const box = document.createElement('div');
  box.className = 'tile';
  box.dataset.id = station.id;
  box.classList.toggle('playing', state.current?.id === station.id);
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'tile-main';
  main.setAttribute('aria-label', `${station.name}（${countryName(station.country, station.countryName)}）を再生`);
  const art = artElement(station);
  const flag = document.createElement('span');
  flag.className = 'tile-flag';
  flag.textContent = station.flag;
  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = station.name;
  art.append(flag, label);
  main.append(art);
  main.addEventListener('click', () => play(station));
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'tile-star';
  star.addEventListener('click', () => toggleFavorite(station));
  paintStar(star, isFavorite(station.id));
  box.append(main, star);
  if (reason) {
    const why = document.createElement('span');
    why.className = 'tile-reason';
    why.textContent = reason;
    box.append(why);
  }
  return box;
}

function paintStar(star, on) {
  star.textContent = on ? '★' : '☆';
  star.classList.toggle('on', on);
  star.setAttribute('aria-label', on ? 'お気に入りから外す' : 'お気に入りに登録');
}

function badge(id) {
  const span = document.createElement('span');
  span.className = `badge g-${id}`;
  span.textContent = genreLabel(id);
  return span;
}

function setMessage(text) {
  $('#message').textContent = text;
}

function setStatus(text, isError = false) {
  const el = $('#now-status');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function emptyNote(text) {
  const p = document.createElement('p');
  p.className = 'message';
  p.style.gridColumn = '1 / -1';
  p.textContent = text;
  return p;
}

// --- 画面の切り替え（ホーム・検索・ライブラリ） ---
function showView(name) {
  for (const view of ['home', 'search', 'library']) $(`#view-${view}`).hidden = view !== name;
  for (const button of document.querySelectorAll('.tabbar [data-go]')) {
    button.classList.toggle('active', button.dataset.go === name);
  }
  if (name === 'library') renderLibrary();
  if (name === 'search') setTimeout(() => $('#search-input').focus(), 50);
  window.scrollTo({ top: 0 });
}
for (const button of document.querySelectorAll('[data-go]')) {
  button.addEventListener('click', () => showView(button.dataset.go));
}

// --- お気に入り・最近聴いた局 ---
function toggleFavorite(station) {
  favorites = isFavorite(station.id) ? favorites.filter((s) => s.id !== station.id) : [...favorites, station];
  save(FAVORITES_KEY, favorites);
  renderFavorites();
  refreshStars();
  renderRecommendations();
  if (!$('#view-library').hidden) renderLibrary();
}

function renderFavorites() {
  $('#fav-block').hidden = !favorites.length || state.genre !== 'all';
  $('#fav-grid').replaceChildren(...favorites.slice(0, 9).map((s) => tile(s)));
}

function renderRecent() {
  const recent = recentStations().slice(0, 12);
  $('#recent-block').hidden = !recent.length || state.genre !== 'all';
  $('#recent').replaceChildren(...recent.map((s) => tile(s)));
}

function renderLibrary() {
  $('#library-favs').replaceChildren(...(favorites.length
    ? favorites.map((s) => tile(s))
    : [emptyNote('局の ☆ を押すと、ここに並びます')]));
  const recent = recentStations();
  $('#library-recent').replaceChildren(...(recent.length
    ? recent.map((s) => tile(s))
    : [emptyNote('聴いた局がここに並びます')]));
}

function refreshStars() {
  for (const box of document.querySelectorAll('.tile')) {
    paintStar(box.querySelector('.tile-star'), isFavorite(box.dataset.id));
    box.classList.toggle('playing', state.current?.id === box.dataset.id);
  }
  const star = $('#now-star');
  const on = Boolean(state.current) && isFavorite(state.current.id);
  star.textContent = on ? '★' : '☆';
  star.classList.toggle('on', on);
  star.setAttribute('aria-label', on ? 'お気に入りから外す' : 'お気に入りに登録');
}

// --- おすすめ ---
async function tagStations(tag) {
  if (!recCache.has(tag)) {
    try {
      recCache.set(tag, toStations(await fetchJson(tagSearchPath(tag))));
    } catch {
      return []; // 取れなかったタグは次の機会に取り直す
    }
  }
  return recCache.get(tag);
}

async function renderRecommendations() {
  const token = ++recToken;
  const profile = tasteProfile(history, favorites);
  const tags = topTags(profile, 3);
  if (!tags.length) {
    $('#recs-block').hidden = true;
    return;
  }
  const lists = await Promise.all(tags.map(tagStations));
  if (token !== recToken) return;
  const exclude = new Set([...Object.keys(history), ...favorites.map((s) => s.id)]);
  const recs = recommend(lists.flat(), profile, exclude, 12);
  remember(recs.map((r) => r.station));
  $('#recs-block').hidden = !recs.length || state.genre !== 'all';
  $('#recs').replaceChildren(...recs.map(({ station, reasons }) => tile(station, reasonText(reasons))));
}

// --- ジャンル ---
function genreCounts() {
  if (state.country === 'ALL') return null;
  return Object.fromEntries(
    [['all', state.pool.length], ...GENRES.map((g) => [g.id, state.pool.filter((s) => s.genres.includes(g.id)).length])],
  );
}

function pickGenre(id) {
  state.genre = id;
  prefs.genre = id;
  save(PREFS_KEY, prefs);
  closeGenreSheet();
  showView('home');
  reload(false);
}

function renderGenres() {
  const counts = genreCounts();
  const box = $('#genres');
  const sheet = $('#sheet-genres');
  box.replaceChildren();
  sheet.replaceChildren();
  for (const genre of [{ id: 'all', label: 'すべて', en: 'ALL' }, ...GENRES]) {
    sheet.append(genreTile(genre, counts ? counts[genre.id] : null, () => pickGenre(genre.id)));
    if (counts && counts[genre.id] === 0 && genre.id !== state.genre) continue; // 0局のジャンルはチップに出さない
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', String(genre.id === state.genre));
    chip.classList.toggle('active', genre.id === state.genre);
    chip.textContent = genre.label;
    chip.addEventListener('click', () => pickGenre(genre.id));
    box.append(chip);
  }
}

// 選択画面のタイル：色付きアイコン、大きな局数、英語名と日本語名
function genreTile(genre, count, onPick) {
  const selected = genre.id === state.genre;
  const tileEl = document.createElement('button');
  tileEl.type = 'button';
  tileEl.className = 'genre-tile';
  tileEl.classList.toggle('active', selected);
  tileEl.classList.toggle('empty', count === 0);
  tileEl.style.setProperty('--tone', GENRE_TONES[genre.id]);
  const top = document.createElement('div');
  top.className = 'tile-top';
  const icon = document.createElement('span');
  icon.className = 'tile-icon';
  icon.append(svgIcon(GENRE_ICONS[genre.id]));
  top.append(icon);
  if (selected) {
    const pill = document.createElement('span');
    pill.className = 'tile-pill';
    pill.textContent = 'SELECTED';
    top.append(pill);
  }
  const number = document.createElement('p');
  number.className = 'tile-count';
  number.textContent = count === null ? '—' : count.toLocaleString();
  const en = document.createElement('p');
  en.className = 'tile-en';
  en.textContent = genre.en;
  const ja = document.createElement('p');
  ja.className = 'tile-ja';
  ja.textContent = genre.label;
  tileEl.append(top, number, en, ja);
  tileEl.addEventListener('click', onPick);
  return tileEl;
}

// --- 局の一覧 ---
// 「すべて」のとき：ジャンルごとの段を横に流して並べる
async function showRows(token) {
  const ids = GENRES.map((g) => g.id);
  let groups;
  if (state.country === 'ALL') {
    // 世界の局はジャンルごとに人気順で取る
    const lists = await Promise.all(ids.map((id) => fetchJson(searchPath(id, 0, 40)).then(toStations).catch(() => [])));
    if (token !== state.token) return;
    groups = buildRows(remember(lists.flat()), ids, ROW_SIZE);
  } else {
    groups = buildRows(state.pool, ids, ROW_SIZE);
  }
  $('#rows').replaceChildren(...groups.map(({ genre, stations }) => {
    const section = document.createElement('section');
    section.className = 'block';
    const head = document.createElement('div');
    head.className = 'block-head';
    const title = document.createElement('h2');
    title.textContent = genreLabel(genre);
    const counts = genreCounts();
    if (counts) {
      const count = document.createElement('span');
      count.className = 'row-count';
      count.textContent = counts[genre].toLocaleString();
      title.append(count);
    }
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'pill-button';
    more.textContent = 'すべて見る ›';
    more.addEventListener('click', () => pickGenre(genre));
    head.append(title, more);
    const track = document.createElement('div');
    track.className = 'row-track';
    track.append(...stations.map((s) => tile(s)));
    section.append(head, track);
    return section;
  }));
  setMessage(groups.length ? '' : 'この国の局が見つかりませんでした');
}

const matchesGenre = (station) => station.genres.includes(state.genre);

// ジャンルを選んだとき：3列のタイル
async function showMore(token) {
  const grid = $('#stations');
  $('#more').disabled = true;
  try {
    if (state.country === 'ALL') {
      const offset = state.nextOffset ?? 0;
      const raw = await fetchJson(searchPath(state.genre, offset));
      if (token !== state.token) return;
      grid.append(...remember(toStations(raw).filter(matchesGenre)).map((s) => tile(s)));
      state.nextOffset = raw.length >= PAGE_SIZE ? offset + PAGE_SIZE : null;
      $('#more').hidden = state.nextOffset === null;
    } else {
      const matched = state.pool.filter(matchesGenre);
      grid.append(...matched.slice(state.shown, state.shown + PAGE_SIZE).map((s) => tile(s)));
      state.shown += PAGE_SIZE;
      $('#more').hidden = state.shown >= matched.length;
    }
    const hint = state.country === 'ALL' ? '' : '国を「🌐 すべての国」にすると、世界の局から探せます';
    setMessage(grid.children.length ? '' : `この国には、このジャンルの局がありません。${hint}`);
  } catch (error) {
    if (token === state.token) setMessage(`局の一覧を取得できませんでした（${error.message}）。通信状態を確かめて、もう一度選んでください`);
  } finally {
    $('#more').disabled = false;
  }
}

// refetch: 国を変えたとき true（局を取り直す）、ジャンルだけ変えたとき false
async function reload(refetch) {
  const token = ++state.token;
  $('#stations').replaceChildren();
  $('#rows').replaceChildren();
  $('#more').hidden = true;
  state.shown = 0;
  state.nextOffset = null;
  setMessage('読み込み中…');
  if (refetch && state.country !== 'ALL') {
    try {
      const raw = await fetchJson(countryStationsPath(state.country));
      if (token !== state.token) return;
      state.pool = remember(toStations(raw));
    } catch (error) {
      if (token === state.token) setMessage(`局の一覧を取得できませんでした（${error.message}）。通信状態を確かめて、もう一度選んでください`);
      return;
    }
  }
  if (state.country === 'ALL') state.pool = [];
  renderGenres();
  const all = state.genre === 'all';
  $('#grid-block').hidden = all;
  $('#rows').hidden = !all;
  renderFavorites();
  renderRecent();
  renderRecommendations();
  if (all) {
    await showRows(token);
  } else {
    $('#grid-title').textContent = genreLabel(state.genre);
    $('#grid-eyebrow').textContent = (GENRES.find((g) => g.id === state.genre)?.en || 'GENRE');
    await showMore(token);
  }
}

async function loadCountries() {
  const raw = await fetchJson('/json/countries');
  const byCode = new Map();
  for (const row of raw) {
    const code = (row.iso_3166_1 || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || !row.stationcount) continue;
    byCode.set(code, (byCode.get(code) || 0) + row.stationcount);
  }
  const countries = [...byCode.keys()]
    .map((code) => ({ code, name: countryName(code, code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const select = $('#country');
  select.replaceChildren(
    new Option('🌐 すべての国', 'ALL'),
    ...countries.map((c) => new Option(`${flagEmoji(c.code)} ${c.name}`, c.code)),
  );
  if (state.country !== 'ALL' && !byCode.has(state.country)) state.country = 'ALL';
  select.value = state.country;
}

// --- 検索 ---
let searchTimer = null;
$('#search-input').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 400); // 打ち終わるのを少し待ってから探す
});
$('#search-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    clearTimeout(searchTimer);
    runSearch();
    event.target.blur(); // キーボードを閉じる
  }
});

async function runSearch() {
  const token = ++state.searchToken;
  const path = nameSearchPath($('#search-input').value);
  const results = $('#search-results');
  const message = $('#search-message');
  if (!path) {
    results.replaceChildren();
    message.textContent = '世界中のラジオ局から、名前の一部で探せます';
    return;
  }
  message.textContent = '探しています…';
  try {
    const stations = toStations(await fetchJson(path));
    if (token !== state.searchToken) return;
    results.replaceChildren(...remember(stations).map((s) => tile(s)));
    message.textContent = stations.length ? '' : '見つかりませんでした。別の書き方（英語など）で試してください';
  } catch (error) {
    if (token === state.searchToken) message.textContent = `探せませんでした（${error.message}）。通信状態を確かめてください`;
  }
}

// --- 再生 ---
function setPlayIcon(playing) {
  for (const path of document.querySelectorAll('.play-path')) path.setAttribute('d', playing ? PAUSE_ICON : PLAY_ICON);
  $('#play').setAttribute('aria-label', playing ? '一時停止' : '再生');
  $('#mini-play').setAttribute('aria-label', playing ? '一時停止' : '再生');
}

function stopStream() {
  const audio = $('#audio');
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

// 再生中の表示（小さなバーと大きな再生画面）。曲名やジャケットが分かったら呼び直す
let clockTimer = null;
function renderNowPlaying() {
  const station = state.current;
  if (!station) return;
  const place = `${station.flag} ${countryName(station.country, station.countryName)}`.trim();
  let format = null;
  try {
    const timeZone = stationTimeZone(station);
    if (timeZone) format = new Intl.DateTimeFormat('ja-JP', { timeZone, hour: '2-digit', minute: '2-digit' });
  } catch {
    format = null; // ブラウザが知らないタイムゾーン
  }
  const { song, artist } = state.track ? splitTrack(state.track) : { song: '', artist: '' };
  const tick = () => {
    const where = format ? `${place} · 🕐 現地 ${format.format(new Date())}` : place;
    $('#mini-sub').textContent = song ? `${station.name} · ${where}` : where;
    $('#player-meta').textContent = song ? `📻 ${station.name} · ${where}` : where;
  };
  $('#mini').hidden = false;
  $('#mini-name').textContent = song || station.name;
  $('#mini-art').replaceChildren(artElement(station, state.cover));
  $('#player-art').replaceChildren(artElement(station, state.cover));
  $('#player').style.setProperty('--hue', hueFor(station.id));
  $('#player-title').textContent = song || station.name;
  $('#player-sub').textContent = song ? artist : '';
  $('#player-sub').hidden = !(song && artist);
  $('#player-genres').replaceChildren(...station.genres.slice(0, 3).map(badge));
  clearInterval(clockTimer);
  tick();
  clockTimer = setInterval(tick, 30000);
}

// 同じジャンルの局（画面に出したことのある局から）
function renderQueue() {
  const station = state.current;
  const genre = station.genres[0];
  const others = [...state.pool, ...state.known.values()]
    .filter((s, i, list) => s.id !== station.id && s.genres.includes(genre) && list.findIndex((t) => t.id === s.id) === i)
    .slice(0, 12);
  $('#queue').replaceChildren(...others.map((s) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    const art = document.createElement('span');
    art.className = 'q-art';
    art.append(artElement(s));
    const text = document.createElement('span');
    text.className = 'q-text';
    const name = document.createElement('span');
    name.className = 'q-name';
    name.textContent = s.name;
    const sub = document.createElement('span');
    sub.className = 'q-sub';
    sub.textContent = `${s.flag} ${countryName(s.country, s.countryName)} · ${s.genres.map(genreLabel).slice(0, 2).join('・')}`;
    text.append(name, sub);
    button.append(art, text);
    button.addEventListener('click', () => {
      play(s);
      $('#player').scrollTo({ top: 0, behavior: 'smooth' });
    });
    li.append(button);
    return li;
  }));
  $('.up-next').hidden = !others.length;
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !state.current) return;
  const station = state.current;
  const { song, artist } = state.track ? splitTrack(state.track) : { song: '', artist: '' };
  const image = state.cover || station.logo;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song || station.name,
    artist: song ? (artist || station.name) : countryName(station.country, station.countryName),
    album: song ? station.name : 'ソトオト',
    artwork: image ? [{ src: image, sizes: '512x512' }] : [],
  });
}

// --- 曲名とジャケット（放送局が許可している場合だけ） ---
function stopTrack() {
  clearInterval(state.trackTimer);
  state.trackTimer = null;
  state.trackToken += 1;
}

function startTrack(station) {
  stopTrack();
  if (station.url.includes('.m3u8')) return;
  const token = state.trackToken;
  const refresh = async () => {
    let title = null;
    try {
      title = await fetchStreamTitle(station.url);
    } catch {
      if (token === state.trackToken) stopTrack(); // 許可されていない局：以後は問い合わせない
      return;
    }
    if (token !== state.trackToken || title === state.track) return;
    state.track = title;
    state.cover = null;
    renderNowPlaying();
    updateMediaSession();
    const cover = title ? await fetchArtwork(title) : null;
    if (token !== state.trackToken || !cover || state.track !== title) return;
    state.cover = cover;
    renderNowPlaying();
    updateMediaSession();
  };
  refresh();
  state.trackTimer = setInterval(refresh, TRACK_INTERVAL_MS);
}

function play(station, { quiet = false } = {}) {
  const audio = $('#audio');
  stopStream();
  state.current = station;
  state.track = null;
  state.cover = null;
  state.recorded = quiet; // ポモドーロの再開などは、聴いた回数に数えない
  renderNowPlaying();
  renderQueue();
  setStatus('接続中…');
  refreshStars();

  const isHls = station.url.includes('.m3u8');
  if (isHls && window.Hls && Hls.isSupported()) {
    state.hls = new Hls();
    state.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) failed();
    });
    state.hls.loadSource(station.url);
    state.hls.attachMedia(audio);
  } else {
    audio.src = station.url; // Safari は .m3u8 もそのまま再生できる
  }
  audio.play().catch(() => setStatus('▶ を押すと再生します'));
  startTrack(station);
  if (!quiet) reportClick(station.id);
  updateMediaSession();
}

function failed() {
  setStatus('この局は再生できませんでした。別の局を選んでください', true);
  setPlayIcon(false);
}

const audio = $('#audio');
audio.addEventListener('playing', () => {
  if (state.current && !state.recorded) {
    // 実際に音が出た局だけを、おすすめ用の記録に残す
    state.recorded = true;
    history = recordPlay(history, state.current, Date.now());
    save(HISTORY_KEY, history);
    renderRecent();
    renderRecommendations();
  }
  setStatus('');
  setPlayIcon(true);
});
audio.addEventListener('pause', () => setPlayIcon(false));
audio.addEventListener('timeupdate', () => {
  checkSleep(); // 画面ロック中でも再生中はこの合図が届く
  checkPomodoro();
});
audio.addEventListener('waiting', () => setStatus('読み込み中…'));
audio.addEventListener('error', () => {
  if (audio.getAttribute('src')) failed();
});

function togglePlay() {
  if (!state.current) return;
  if (audio.paused) {
    if (!audio.getAttribute('src') && !state.hls) play(state.current);
    else audio.play().catch(() => failed());
  } else {
    audio.pause();
  }
}
$('#play').addEventListener('click', togglePlay);
$('#mini-play').addEventListener('click', togglePlay);

// 大きな再生画面
function openPlayer() {
  $('#player').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#player-close').focus();
}
function closePlayer() {
  $('#player').hidden = true;
  document.body.style.overflow = '';
}
$('#mini-open').addEventListener('click', openPlayer);
$('#player-close').addEventListener('click', closePlayer);
$('#now-star').addEventListener('click', () => {
  if (state.current) toggleFavorite(state.current);
});

// --- おやすみタイマー ---
function renderSleep() {
  $('#sleep-toggle').classList.toggle('on', sleep.active);
  $('#sleep-label').classList.toggle('on', sleep.active);
  $('#sleep-label').textContent = sleep.active ? `🌙 残り ${formatRemaining(sleep.remainingMs())}` : 'おやすみタイマー';
}

function checkSleep() {
  if (!sleep.expired()) return;
  sleep.cancel();
  audio.pause();
  stopTrack();
  setStatus('おやすみタイマーで停止しました');
  for (const b of $('#sleep-options').children) b.classList.toggle('selected', b.dataset.minutes === '0');
  renderSleep();
}

function toggleSleepOptions() {
  const options = $('#sleep-options');
  options.hidden = !options.hidden;
  $('#sleep-toggle').setAttribute('aria-expanded', String(!options.hidden));
}
$('#sleep-toggle').addEventListener('click', toggleSleepOptions);
$('#sleep-label').addEventListener('click', toggleSleepOptions);
for (const button of $('#sleep-options').children) {
  button.addEventListener('click', () => {
    const minutes = Number(button.dataset.minutes);
    if (minutes) sleep.set(minutes);
    else sleep.cancel();
    for (const b of $('#sleep-options').children) b.classList.toggle('selected', b === button);
    $('#sleep-options').hidden = true;
    $('#sleep-toggle').setAttribute('aria-expanded', 'false');
    renderSleep();
  });
}

// --- ポモドーロ ---
function renderPomodoro() {
  const toggle = $('#pomodoro-toggle');
  toggle.classList.toggle('on', pomodoro.active);
  toggle.setAttribute('aria-pressed', String(pomodoro.active));
  $('#pomodoro-label').textContent = pomodoroLabel(pomodoro);
}

// 休憩に入るとラジオを止め、集中に戻ると（休憩前に流れていれば）再開する
function checkPomodoro() {
  const phase = pomodoro.advance();
  if (phase === 'short' || phase === 'long') {
    state.resumeAfterBreak = !audio.paused;
    audio.pause();
    playChime('rest');
    setStatus(phase === 'long' ? '長い休憩（15分）です。ラジオを止めました' : '休憩（5分）です。ラジオを止めました');
  } else if (phase === 'focus') {
    playChime('focus');
    if (state.current && state.resumeAfterBreak) {
      setTimeout(() => play(state.current, { quiet: true }), 1200); // ベルが聞こえてから再開する
    }
    setStatus('集中を再開しました');
  }
  renderPomodoro();
}

$('#pomodoro-toggle').addEventListener('click', () => {
  if (pomodoro.active) {
    pomodoro.stop();
    state.resumeAfterBreak = false;
    setStatus('ポモドーロを終了しました');
  } else {
    unlockChime(); // iPhone ではこの操作のときに音の準備をしておく
    pomodoro.start();
    playChime('focus');
    if (state.current && audio.paused) play(state.current, { quiet: true });
    setStatus('集中スタート（25分）');
  }
  renderPomodoro();
});

setInterval(() => {
  if (sleep.active) {
    renderSleep();
    checkSleep();
  }
  if (pomodoro.active) checkPomodoro();
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkPomodoro(); // 画面を開き直したときに追いつく
});

// --- 国・ジャンルの選択 ---
$('#country').addEventListener('change', (event) => {
  state.country = event.target.value;
  prefs.country = state.country;
  save(PREFS_KEY, prefs);
  showView('home');
  reload(true);
});
$('#more').addEventListener('click', () => showMore(state.token));
$('#grid-back').addEventListener('click', () => pickGenre('all'));

function openGenreSheet() {
  $('#genre-sheet').hidden = false;
  $('#genre-sheet-close').focus();
}
function closeGenreSheet() {
  $('#genre-sheet').hidden = true;
}
$('#genre-nav').addEventListener('click', openGenreSheet);
$('#genre-sheet-close').addEventListener('click', closeGenreSheet);
$('#genre-sheet').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) closeGenreSheet(); // 暗い部分を押しても閉じる
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!$('#genre-sheet').hidden) closeGenreSheet();
  else if (!$('#player').hidden) closePlayer();
});

renderFavorites();
renderRecent();
renderRecommendations();
(async () => {
  try {
    await loadCountries();
  } catch (error) {
    setMessage(`国の一覧を取得できませんでした（${error.message}）。通信状態を確かめて、ページを開き直してください`);
    return;
  }
  await reload(true);
})();
