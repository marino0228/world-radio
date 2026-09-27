// Run with: jsc -m tests/radio.test.js
import { PAGE_SIZE, countryStationsPath, searchPath, tagSearchPath, toStations } from '../radio.js';

let failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; print(`FAIL ${label}: got ${a}, expected ${e}`); }
}

const raw = [
  { stationuuid: 'u1', name: ' J-Wave ', url_resolved: 'https://r.example/jwave', countrycode: 'JP', country: 'Japan', tags: 'jpop, Music,,city pop', language: 'Japanese,english', favicon: 'https://r.example/j.png', codec: 'MP3' },
  { stationuuid: 'u2', name: 'Plain HTTP', url_resolved: 'http://r.example/plain', countrycode: 'JP', country: 'Japan', tags: '', favicon: '' },
  { stationuuid: 'u3', name: 'NHK', url_resolved: 'https://r.example/nhk.m3u8', countrycode: 'JP', country: 'Japan', tags: 'news,talk', favicon: 'http://r.example/n.png' },
  { stationuuid: 'u1', name: 'dup', url_resolved: 'https://r.example/dup', countrycode: 'JP', country: 'Japan', tags: '', favicon: '' },
  { stationuuid: 'u4', name: '', url_resolved: '', countrycode: 'JP', country: 'Japan', tags: '', favicon: '' },
];
eq(toStations(raw), [
  { id: 'u1', name: 'J-Wave', country: 'JP', countryName: 'Japan', flag: '🇯🇵', url: 'https://r.example/jwave', genres: ['music'], logo: 'https://r.example/j.png', tags: ['jpop', 'music', 'city pop'], language: 'japanese' },
  { id: 'u3', name: 'NHK', country: 'JP', countryName: 'Japan', flag: '🇯🇵', url: 'https://r.example/nhk.m3u8', genres: ['news', 'talk'], logo: null, tags: ['news', 'talk'], language: '' },
], 'https only, dedupe, genres, https logos only');

eq(countryStationsPath('jp'), '/json/stations/bycountrycodeexact/JP?hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=500', 'country path');
eq(searchPath('healing', 200), `/json/stations/search?hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=${PAGE_SIZE}&offset=200&tag=relax`, 'search with tag');
eq(searchPath('all', 0), `/json/stations/search?hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=${PAGE_SIZE}&offset=0`, 'search without tag');

eq(tagSearchPath('city pop'), '/json/stations/search?hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=60&tag=city%20pop', 'tag search path');

print(failed ? `${failed} FAILED` : 'ALL PASSED');
