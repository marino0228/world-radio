// Run with: jsc -m tests/timezone.test.js   (macOS JavaScriptCore)
import { stationTimeZone } from '../timezone.js';

let failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; print(`FAIL ${label}: got ${a}, expected ${e}`); }
}

// 時差が1つの国は国だけで決まる
eq(stationTimeZone({ country: 'FR' }), 'Europe/Paris', 'single-zone country');
eq(stationTimeZone({ country: 'JP' }), 'Asia/Tokyo', 'japan');
eq(stationTimeZone({ country: 'XX' }), null, 'unknown country');
eq(stationTimeZone({}), null, 'no country');

// 時差が複数ある国：座標があれば一番近い都市のタイムゾーン
eq(stationTimeZone({ country: 'US', lat: 34.05, lon: -118.24 }), 'America/Los_Angeles', 'coords in Los Angeles');
eq(stationTimeZone({ country: 'RU', lat: 55.0, lon: 82.9 }), 'Asia/Novosibirsk', 'coords in Novosibirsk');
eq(stationTimeZone({ country: 'US', lat: 0, lon: 0, state: 'Texas' }), 'America/Chicago', '0,0 is not a real location');

// 座標がなければ州の名前
eq(stationTimeZone({ country: 'US', state: 'California' }), 'America/Los_Angeles', 'US state');
eq(stationTimeZone({ country: 'US', state: 'West Virginia' }), 'America/New_York', 'west virginia is not virginia… both eastern');
eq(stationTimeZone({ country: 'US', state: 'Arkansas' }), 'America/Chicago', 'arkansas is not kansas');
eq(stationTimeZone({ country: 'US', state: 'Washington D.C.' }), 'America/New_York', 'DC is not Washington state');
eq(stationTimeZone({ country: 'US', state: 'Washington' }), 'America/Los_Angeles', 'Washington state');
eq(stationTimeZone({ country: 'US', state: 'Arizona' }), 'America/Phoenix', 'arizona');
eq(stationTimeZone({ country: 'CA', state: 'Québec' }), 'America/Toronto', 'accents ignored');
eq(stationTimeZone({ country: 'AU', state: 'Perth WA' }), 'Australia/Perth', 'AU abbreviation');
eq(stationTimeZone({ country: 'AU', state: 'Sydney NSW' }), 'Australia/Sydney', 'AU city');

// 場所が分からないとき：アメリカ・カナダ・オーストラリアは決められないので出さない。他は代表のタイムゾーン
eq(stationTimeZone({ country: 'US' }), null, 'US without location');
eq(stationTimeZone({ country: 'AU', state: 'Somewhere' }), null, 'AU unknown state');
eq(stationTimeZone({ country: 'RU' }), 'Europe/Moscow', 'russia defaults to Moscow');
eq(stationTimeZone({ country: 'BR' }), 'America/Sao_Paulo', 'brazil defaults to Sao Paulo');
eq(stationTimeZone({ country: 'ES' }), 'Europe/Madrid', 'spain defaults to Madrid');

print(failed ? `${failed} FAILED` : 'ALL PASSED');
