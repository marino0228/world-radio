// Run with: jsc -m tests/artwork.test.js   (macOS JavaScriptCore)
import { artworkTerm, bigArtwork, splitTrack } from '../artwork.js';

let failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; print(`FAIL ${label}: got ${a}, expected ${e}`); }
}

// 曲名（ICY の StreamTitle）から、ジャケット画像を探す言葉を作る
eq(artworkTerm('Mrs. GREEN APPLE - ライラック'), 'Mrs. GREEN APPLE ライラック', 'artist - title');
eq(artworkTerm('Daft Punk – Get Lucky (Radio Edit)'), 'Daft Punk Get Lucky', 'en dash, drop brackets');
eq(artworkTerm('  '), null, 'blank');
eq(artworkTerm(null), null, 'missing');
eq(artworkTerm('Morning Show'), null, 'no artist: likely a programme, not a song');
eq(artworkTerm('Advertisement - Break'), null, 'ads are skipped');

// iTunes の検索結果から大きいジャケット画像を取り出す
eq(bigArtwork({ results: [{ artworkUrl100: 'https://is1.example/x/100x100bb.jpg' }] }), 'https://is1.example/x/600x600bb.jpg', '600px artwork');
eq(bigArtwork({ results: [] }), null, 'no results');
eq(bigArtwork({ results: [{ artworkUrl100: 'http://insecure.example/100x100bb.jpg' }] }), null, 'https only');
eq(bigArtwork(null), null, 'broken response');

// 曲名を「曲」と「アーティスト」に分ける。分けられなければ全体を曲として扱う
eq(splitTrack('Mrs. GREEN APPLE - ライラック'), { song: 'ライラック', artist: 'Mrs. GREEN APPLE' }, 'split');
eq(splitTrack('Morning Show'), { song: 'Morning Show', artist: '' }, 'programme name');

print(failed ? `${failed} FAILED` : 'ALL PASSED');
