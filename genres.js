// ラジオのジャンル。Radio Browser の tags（カンマ区切りの自由入力）から判定する。
// World TV（server/genres.py の RADIO_GENRES）と同じ対応表。
export const GENRES = [
  { id: 'news', label: 'ニュース', words: ['news', 'information', 'noticias', 'nachrichten', 'actualites'] },
  { id: 'talk', label: 'トーク', words: ['talk', 'speech', 'podcast', 'comedy'] },
  {
    id: 'music', label: '音楽', words: [
      'music', 'pop', 'rock', 'jazz', 'classic', 'dance', 'hits', 'top 40', 'electronic', 'hip hop',
      'country', 'oldies', '80s', '90s', 'chill', 'lounge', 'anime', 'r&b', 'soul', 'reggae', 'metal',
      'folk', 'latin', 'house', 'techno', 'ambient', 'instrumental', 'jpop', 'j-pop', 'kpop', 'k-pop',
    ],
  },
  {
    id: 'classical', label: 'クラシック', words: [
      'classical', 'opera', 'baroque', 'klassik', 'clasica', 'clásica', 'classique', 'symphon', 'orchestra',
    ],
  },
  { id: 'jazz', label: 'ジャズ', words: ['jazz', 'swing', 'bebop', 'bossa'] },
  // "spa" は "spanish"、"rain" は "ukraine" にも一致するので単独では使わない
  {
    id: 'healing', label: 'ヒーリング', words: [
      'meditation', 'yoga', 'relax', 'healing', 'nature', 'sleep', 'zen', 'new age', 'ambient',
      'mindfulness', 'binaural', 'rain sounds', 'ocean',
    ],
  },
  { id: 'sports', label: 'スポーツ', words: ['sport', 'football', 'soccer', 'baseball'] },
  {
    id: 'religious', label: '宗教', words: [
      'christian', 'religious', 'catholic', 'islam', 'quran', 'gospel', 'worship', 'church', 'bible',
    ],
  },
  { id: 'general', label: 'その他', words: [] },
];

// 「すべての国」でジャンルを選んだときに検索する代表タグ
export const SEARCH_TAGS = {
  news: 'news', talk: 'talk', music: 'music', classical: 'classical', jazz: 'jazz',
  healing: 'relax', sports: 'sports', religious: 'christian',
};

export function radioGenres(tags) {
  const parts = (tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const ids = GENRES
    .filter((g) => g.words.length && parts.some((part) => g.words.some((word) => part.includes(word))))
    .map((g) => g.id);
  return ids.length ? ids : ['general'];
}

export const genreLabel = (id) => GENRES.find((g) => g.id === id)?.label || id;
