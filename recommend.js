// おすすめ：この端末で聴いた局とお気に入りから好みのタグを読み取り、似ている局を選ぶ。
// 記録は端末の中だけに保存し、外部には送らない。
const MAX_HISTORY = 100;
const MAX_WEIGHT_PER_STATION = 5;
const FAVORITE_WEIGHT = 3;
// どの局にも付きがちで、好みの手がかりにならないタグ
const GENERIC_TAGS = new Set([
  'music', 'radio', 'fm', 'am', 'online', 'live', 'internet', 'internet radio', 'webradio', 'web radio',
  'station', 'local', 'various', '24/7', 'free',
]);

export function recordPlay(history, station, now) {
  const previous = history[station.id];
  const next = {
    ...history,
    [station.id]: { station, count: (previous?.count || 0) + 1, lastAt: now },
  };
  const ids = Object.keys(next);
  if (ids.length <= MAX_HISTORY) return next;
  ids.sort((a, b) => next[b].lastAt - next[a].lastAt);
  return Object.fromEntries(ids.slice(0, MAX_HISTORY).map((id) => [id, next[id]]));
}

export function tasteProfile(history, favorites) {
  const tags = {};
  const languages = {};
  const add = (station, weight) => {
    for (const tag of station.tags || []) {
      if (!GENERIC_TAGS.has(tag)) tags[tag] = (tags[tag] || 0) + weight;
    }
    if (station.language) languages[station.language] = (languages[station.language] || 0) + weight;
  };
  for (const entry of Object.values(history)) add(entry.station, Math.min(entry.count, MAX_WEIGHT_PER_STATION));
  for (const station of favorites) add(station, FAVORITE_WEIGHT);
  return { tags, languages };
}

export function topTags(profile, n = 3) {
  return Object.entries(profile.tags)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([tag]) => tag);
}

const normalizeName = (name) => (name || '').toLowerCase().replace(/[\s\W_]+/g, '');

// excludeIds：聴いたことのある局・お気に入り。同じ名前の局（配信違い）は1つだけにする
export function recommend(candidates, profile, excludeIds, limit = 10) {
  const seenIds = new Set();
  const seenNames = new Set();
  const scored = [];
  for (const station of candidates) {
    if (excludeIds.has(station.id) || seenIds.has(station.id)) continue;
    seenIds.add(station.id);
    const matches = (station.tags || []).filter((tag) => profile.tags[tag]);
    if (!matches.length) continue;
    const score = matches.reduce((sum, tag) => sum + profile.tags[tag], 0)
      + (profile.languages[station.language] || 0) * 0.5;
    scored.push({ station, score, reasons: [...matches].sort((a, b) => profile.tags[b] - profile.tags[a]).slice(0, 2) });
  }
  scored.sort((a, b) => b.score - a.score);
  const result = [];
  for (const item of scored) {
    const name = normalizeName(item.station.name);
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

export const reasonText = (tags) => `${tags.join('・')} をよく聴くあなたへ`;
