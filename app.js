import { GENRES, genreLabel } from './genres.js';
import { fetchStreamTitle } from './icy.js';
import { PAGE_SIZE, countryStationsPath, fetchJson, flagEmoji, reportClick, searchPath, toStations } from './radio.js';
import { SleepTimer, formatRemaining } from './timer.js';

const $ = (selector) => document.querySelector(selector);
const FAVORITES_KEY = 'world-radio-favorites';
const PREFS_KEY = 'world-radio-prefs';
const RINGS = ['var(--lavender)', 'var(--butter)', 'var(--mint)', 'var(--salmon)'];
const PLAY_ICON = 'M8 5v14l11-7z';
const PAUSE_ICON = 'M7 5h4v14H7zM13 5h4v14h-4z';
const TRACK_INTERVAL_MS = 20000;
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
  shown: 0, // 国モードで表示済みの件数
  nextOffset: null, // すべての国モードで次に取る位置
  current: null,
  hls: null,
  token: 0,
  trackTimer: null,
  trackToken: 0,
};
const sleep = new SleepTimer();
let favorites = Array.isArray(load(FAVORITES_KEY, [])) ? load(FAVORITES_KEY, []) : [];

// --- 小さな部品 ---
const countryName = (code, fallback) => {
  try {
    return (code && regionNames?.of(code)) || fallback || code;
  } catch {
    return fallback || code;
  }
};
const ringFor = (id) => RINGS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % RINGS.length];
const isFavorite = (id) => favorites.some((s) => s.id === id);

function logoElement(station) {
  const initials = () => {
    const div = document.createElement('div');
    div.className = 'logo initials';
    div.textContent = station.name.trim().slice(0, 2).toUpperCase();
    div.style.setProperty('--ring', ringFor(station.id));
    return div;
  };
  if (!station.logo) return initials();
  const img = document.createElement('img');
  img.className = 'logo';
  img.alt = '';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.src = station.logo;
  img.style.setProperty('--ring', ringFor(station.id));
  img.addEventListener('error', () => img.replaceWith(initials()), { once: true });
  return img;
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

// --- お気に入り ---
function toggleFavorite(station) {
  favorites = isFavorite(station.id) ? favorites.filter((s) => s.id !== station.id) : [...favorites, station];
  save(FAVORITES_KEY, favorites);
  renderFavorites();
  refreshStars();
}

function renderFavorites() {
  const box = $('#favorites');
  box.replaceChildren();
  if (!favorites.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '局の ☆ を押すと、ここに並びます';
    box.append(p);
    return;
  }
  for (const station of favorites) {
    const button = document.createElement('button');
    button.className = 'fav';
    button.classList.toggle('playing', state.current?.id === station.id);
    button.title = station.name; // アイコンだけなので、局名は長押し・マウスを重ねたときに出す
    button.setAttribute('aria-label', station.name);
    button.append(logoElement(station));
    button.addEventListener('click', () => play(station));
    box.append(button);
  }
}

function refreshStars() {
  for (const li of $('#stations').children) {
    const on = isFavorite(li.dataset.id);
    const star = li.querySelector('.star');
    star.textContent = on ? '★' : '☆';
    star.classList.toggle('on', on);
    star.setAttribute('aria-label', on ? 'お気に入りから外す' : 'お気に入りに登録');
    li.classList.toggle('playing', state.current?.id === li.dataset.id);
  }
  const star = $('#now-star');
  const on = Boolean(state.current) && isFavorite(state.current.id);
  star.disabled = !state.current;
  star.textContent = on ? '★' : '☆';
  star.classList.toggle('on', on);
  star.setAttribute('aria-label', on ? 'お気に入りから外す' : 'お気に入りに登録');
}

// --- 局の一覧 ---
function stationRow(station) {
  const li = document.createElement('li');
  li.className = 'station';
  li.dataset.id = station.id;
  const main = document.createElement('button');
  main.className = 'station-main';
  const info = document.createElement('span');
  info.className = 'info';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = station.name;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `${station.flag} ${countryName(station.country, station.countryName)}`.trim();
  info.append(name, meta);
  main.append(logoElement(station), info, ...station.genres.slice(0, 2).map(badge));
  main.addEventListener('click', () => play(station));
  const star = document.createElement('button');
  star.className = 'star';
  star.addEventListener('click', () => toggleFavorite(station));
  li.append(main, star);
  return li;
}

function renderGenres() {
  const counts = state.country === 'ALL' ? null : Object.fromEntries(
    [['all', state.pool.length], ...GENRES.map((g) => [g.id, state.pool.filter((s) => s.genres.includes(g.id)).length])],
  );
  const box = $('#genres');
  const sheet = $('#sheet-genres');
  box.replaceChildren();
  sheet.replaceChildren();
  for (const genre of [{ id: 'all', label: 'すべて', en: 'ALL' }, ...GENRES]) {
    if (counts && counts[genre.id] === 0 && genre.id !== state.genre) continue;
    const pick = (fromSheet) => {
      state.genre = genre.id;
      prefs.genre = genre.id;
      save(PREFS_KEY, prefs);
      if (fromSheet) {
        closeGenreSheet();
        $('#stations-section').scrollIntoView();
      }
      reload(false);
    };
    const chip = document.createElement('button');
    chip.className = 'genre';
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', String(genre.id === state.genre));
    chip.classList.toggle('active', genre.id === state.genre);
    chip.textContent = counts ? `${genre.label} ${counts[genre.id]}` : genre.label;
    chip.addEventListener('click', () => pick(false));
    box.append(chip);

    sheet.append(genreTile(genre, counts ? counts[genre.id] : null, () => pick(true)));
  }
}

// 選択画面のタイル：色付きアイコン、大きな局数、英語名と日本語名
function genreTile(genre, count, onPick) {
  const selected = genre.id === state.genre;
  const tile = document.createElement('button');
  tile.className = 'genre-tile';
  tile.classList.toggle('active', selected);
  tile.style.setProperty('--tone', GENRE_TONES[genre.id]);
  const top = document.createElement('div');
  top.className = 'tile-top';
  const icon = document.createElement('span');
  icon.className = 'tile-icon';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', GENRE_ICONS[genre.id]);
  svg.append(path);
  icon.append(svg);
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
  tile.append(top, number, en, ja);
  tile.addEventListener('click', onPick);
  return tile;
}

const matchesGenre = (station) => state.genre === 'all' || station.genres.includes(state.genre);

async function showMore(token) {
  const list = $('#stations');
  $('#more').disabled = true;
  try {
    if (state.country === 'ALL') {
      const offset = state.nextOffset ?? 0;
      const raw = await fetchJson(searchPath(state.genre, offset));
      if (token !== state.token) return;
      const stations = toStations(raw).filter(matchesGenre);
      list.append(...stations.map(stationRow));
      state.nextOffset = raw.length >= PAGE_SIZE ? offset + PAGE_SIZE : null;
      $('#more').hidden = state.nextOffset === null;
    } else {
      const matched = state.pool.filter(matchesGenre);
      list.append(...matched.slice(state.shown, state.shown + PAGE_SIZE).map(stationRow));
      state.shown += PAGE_SIZE;
      $('#more').hidden = state.shown >= matched.length;
    }
    refreshStars();
    setMessage(list.children.length ? '' : 'この条件の局は見つかりません');
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
  $('#more').hidden = true;
  state.shown = 0;
  state.nextOffset = null;
  setMessage('読み込み中…');
  if (refetch && state.country !== 'ALL') {
    try {
      const raw = await fetchJson(countryStationsPath(state.country));
      if (token !== state.token) return;
      state.pool = toStations(raw);
    } catch (error) {
      if (token === state.token) setMessage(`局の一覧を取得できませんでした（${error.message}）。通信状態を確かめて、もう一度選んでください`);
      return;
    }
  }
  if (state.country === 'ALL') state.pool = [];
  $('#count-number').textContent = state.country === 'ALL' ? '∞' : state.pool.length.toLocaleString();
  renderGenres();
  await showMore(token);
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
    new Option('🌐 すべての国（人気順）', 'ALL'),
    ...countries.map((c) => new Option(`${flagEmoji(c.code)} ${c.name}`, c.code)),
  );
  if (state.country !== 'ALL' && !byCode.has(state.country)) state.country = 'ALL';
  select.value = state.country;
}

// --- 再生 ---
function setPlayIcon(playing) {
  $('#play-icon').setAttribute('d', playing ? PAUSE_ICON : PLAY_ICON);
  $('#play').setAttribute('aria-label', playing ? '一時停止' : '再生');
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

// --- 曲名（放送局が許可している場合だけ） ---
function stopTrack() {
  clearInterval(state.trackTimer);
  state.trackTimer = null;
  state.trackToken += 1;
  $('#now-track').hidden = true;
  $('#now-track').textContent = '';
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
    if (token !== state.trackToken) return;
    $('#now-track').textContent = title ? `🎵 ${title}` : '';
    $('#now-track').hidden = !title;
    if (title && 'mediaSession' in navigator && navigator.mediaSession.metadata) {
      navigator.mediaSession.metadata.title = title;
      navigator.mediaSession.metadata.artist = station.name;
    }
  };
  refresh();
  state.trackTimer = setInterval(refresh, TRACK_INTERVAL_MS);
}

// --- おやすみタイマー ---
function renderSleep() {
  const toggle = $('#sleep-toggle');
  toggle.classList.toggle('on', sleep.active);
  $('#sleep-label').textContent = sleep.active ? `残り ${formatRemaining(sleep.remainingMs())}` : 'おやすみタイマー';
}

function checkSleep() {
  if (!sleep.expired()) return;
  sleep.cancel();
  $('#audio').pause();
  stopTrack();
  setStatus('おやすみタイマーで停止しました');
  for (const b of $('#sleep-options').children) b.classList.toggle('selected', b.dataset.minutes === '0');
  renderSleep();
}

function play(station) {
  const audio = $('#audio');
  stopStream();
  state.current = station;
  $('#now-label').textContent = 'NOW PLAYING';
  $('#live-pill').hidden = false;
  $('#now-name').textContent = station.name;
  $('#now-meta').textContent = `${station.flag} ${countryName(station.country, station.countryName)}`.trim();
  $('#now-genres').replaceChildren(...station.genres.slice(0, 3).map(badge));
  $('#play').disabled = false;
  setStatus('接続中…');
  renderFavorites();
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
  reportClick(station.id);
  startTrack(station);
  window.scrollTo({ top: 0 }); // 再生中のカードを見えるようにする
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: countryName(station.country, station.countryName),
      album: 'World Radio',
      artwork: station.logo ? [{ src: station.logo, sizes: '256x256' }] : [],
    });
  }
}

function failed() {
  setStatus('この局は再生できませんでした。別の局を選んでください', true);
  setPlayIcon(false);
}

const audio = $('#audio');
audio.addEventListener('playing', () => {
  setStatus('');
  setPlayIcon(true);
});
audio.addEventListener('pause', () => setPlayIcon(false));
audio.addEventListener('timeupdate', checkSleep); // 画面ロック中でも再生中はこの合図が届く
audio.addEventListener('waiting', () => setStatus('読み込み中…'));
audio.addEventListener('error', () => {
  if (audio.getAttribute('src')) failed();
});

$('#play').addEventListener('click', () => {
  if (!state.current) return;
  if (audio.paused) {
    if (!audio.getAttribute('src') && !state.hls) play(state.current);
    else audio.play().catch(() => failed());
  } else {
    audio.pause();
  }
});
$('#sleep-toggle').addEventListener('click', () => {
  const options = $('#sleep-options');
  options.hidden = !options.hidden;
  $('#sleep-toggle').setAttribute('aria-expanded', String(!options.hidden));
});
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
setInterval(() => {
  if (sleep.active) {
    renderSleep();
    checkSleep();
  }
}, 1000);

$('#now-star').addEventListener('click', () => {
  if (state.current) toggleFavorite(state.current);
});
$('#country').addEventListener('change', (event) => {
  state.country = event.target.value;
  prefs.country = state.country;
  save(PREFS_KEY, prefs);
  reload(true);
});
$('#more').addEventListener('click', () => showMore(state.token));

// 見出しのラベル：あいさつと日付
(() => {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 11 ? 'GOOD MORNING' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  $('#today').textContent = `${greeting} · ${date}`;
})();

// ジャンルの選択画面
function openGenreSheet() {
  $('#genre-sheet').hidden = false;
  $('#genre-nav').classList.add('active');
  $('#genre-sheet-close').focus();
}
function closeGenreSheet() {
  $('#genre-sheet').hidden = true;
  $('#genre-nav').classList.remove('active');
  highlightNav();
}
$('#genre-nav').addEventListener('click', openGenreSheet);
$('#genre-sheet-close').addEventListener('click', closeGenreSheet);
$('#genre-sheet').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) closeGenreSheet(); // 暗い部分を押しても閉じる
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#genre-sheet').hidden) closeGenreSheet();
});

// 画面下のナビ：見えている場所の項目を強調する
const navLinks = [...document.querySelectorAll('.bottom-nav a')];
// タイマーは再生中カードの中にあるので、場所での判定には使わない（押したときだけ強調）
const sections = navLinks
  .filter((a) => a.dataset.target !== 'timer')
  .map((a) => document.getElementById(a.dataset.target))
  .filter(Boolean);
for (const a of navLinks) {
  a.addEventListener('click', () => {
    for (const other of navLinks) other.classList.toggle('active', other === a);
  });
}
function highlightNav() {
  const line = window.innerHeight * 0.35;
  let current = sections[0];
  let best = -Infinity;
  for (const section of sections) {
    const top = section.getBoundingClientRect().top;
    if (top <= line && top > best) {
      best = top;
      current = section;
    }
  }
  if (!$('#genre-sheet').hidden) return;
  for (const a of navLinks) a.classList.toggle('active', a.dataset.target === current.id);
}
window.addEventListener('scroll', highlightNav, { passive: true });
highlightNav();

renderFavorites();
refreshStars();
(async () => {
  try {
    await loadCountries();
  } catch (error) {
    setMessage(`国の一覧を取得できませんでした（${error.message}）。通信状態を確かめて、ページを開き直してください`);
    return;
  }
  await reload(true);
})();
