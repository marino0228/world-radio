// Run with: jsc -m tests/genres.test.js   (macOS JavaScriptCore)
import { GENRES, SEARCH_TAGS, radioGenres } from '../genres.js';

let failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; print(`FAIL ${label}: got ${a}, expected ${e}`); }
}

eq(GENRES.map((g) => g.id), ['news', 'talk', 'music', 'classical', 'jazz', 'healing', 'sports', 'religious', 'general'], 'genre order');
eq(radioGenres('news,talk'), ['news', 'talk'], 'news talk');
eq(radioGenres('J-Pop, Anime'), ['music'], 'jpop');
eq(radioGenres('Classical, Baroque'), ['music', 'classical'], 'classical');
eq(radioGenres('classic rock'), ['music'], 'classic rock is not classical');
eq(radioGenres('Smooth Jazz'), ['music', 'jazz'], 'jazz');
eq(radioGenres('meditation,yoga'), ['healing'], 'healing');
eq(radioGenres('Spanish'), ['general'], 'spa must not match spanish');
eq(radioGenres('Ukraine'), ['general'], 'rain must not match ukraine');
eq(radioGenres(''), ['general'], 'empty');
eq(radioGenres(null), ['general'], 'null');
eq(SEARCH_TAGS.healing, 'relax', 'healing search tag');

print(failed ? `${failed} FAILED` : 'ALL PASSED');
