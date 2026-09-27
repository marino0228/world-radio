// Run with: jsc -m tests/recommend.test.js
import { reasonText, recommend, recordPlay, tasteProfile, topTags } from '../recommend.js';

let failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; print(`FAIL ${label}: got ${a}, expected ${e}`); }
}
const st = (id, tags, language = 'japanese', name = id) => ({ id, name, tags, language });

// 記録：同じ局は回数が増え、新しい順に最大件数まで
let history = {};
history = recordPlay(history, st('a', ['jazz', 'lounge']), 1000);
history = recordPlay(history, st('a', ['jazz', 'lounge']), 2000);
history = recordPlay(history, st('b', ['city pop']), 3000);
eq([history.a.count, history.a.lastAt, history.b.count], [2, 2000, 1], 'counts plays');
let many = {};
for (let i = 0; i < 105; i++) many = recordPlay(many, st(`s${i}`, ['x']), i);
eq([Object.keys(many).length, 's0' in many, 's104' in many], [100, false, true], 'keeps latest 100');

// 好み：聴いた回数（1局あたり最大5）＋お気に入り（3）。あいまいなタグは使わない
const profile = tasteProfile(history, [st('f', ['jazz', 'music', 'radio'])]);
eq(profile.tags, { jazz: 5, lounge: 2, 'city pop': 1 }, 'tag weights skip generic tags');
eq(topTags(profile, 2), ['jazz', 'lounge'], 'top tags');
eq(tasteProfile({}, []).tags, {}, 'empty profile');

// おすすめ：聴いた局・お気に入りは除き、似ている順。同名の局は1つだけ
const candidates = [
  st('a', ['jazz']),                              // already heard
  st('c', ['jazz', 'lounge'], 'japanese', 'Cafe Jazz'),
  st('d', ['rock'], 'english'),                   // no overlap
  st('e', ['jazz'], 'english', 'Jazz FM'),
  st('e2', ['jazz'], 'english', 'jazz fm'),       // duplicate name
  st('f', ['jazz']),                              // favorite
];
const recs = recommend(candidates, profile, new Set(['a', 'b', 'f']), 10);
eq(recs.map((r) => r.station.id), ['c', 'e'], 'ranked, filtered, deduped');
eq(recs[0].reasons, ['jazz', 'lounge'], 'reasons are the matching tags');
eq(reasonText(['jazz', 'lounge']), 'jazz・lounge をよく聴くあなたへ', 'reason text');

print(failed ? `${failed} FAILED` : 'ALL PASSED');
