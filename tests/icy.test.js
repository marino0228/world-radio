// Run with: jsc -m tests/icy.test.js
import { IcyReader, parseStreamTitle } from '../icy.js';

let failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; print(`FAIL ${label}: got ${a}, expected ${e}`); }
}
const enc = (s) => Uint8Array.from(unescape(encodeURIComponent(s)), (ch) => ch.charCodeAt(0));

eq(parseStreamTitle(enc("StreamTitle='ClariS - Reunion';StreamUrl='x';\0\0")), 'ClariS - Reunion', 'parse title');
eq(parseStreamTitle(enc("StreamTitle='';\0")), null, 'empty title');
eq(parseStreamTitle(enc('nothing')), null, 'no title');
eq(parseStreamTitle(enc("StreamTitle='" + 'x'.repeat(300) + "';")), 'x'.repeat(200), 'truncate');

eq(parseStreamTitle(enc("StreamTitle='Avicii+-+Hey+Brother';")), 'Avicii - Hey Brother', 'plus-encoded spaces');
eq(parseStreamTitle(enc("StreamTitle='Songs + Stories';")), 'Songs + Stories', 'real plus kept when spaces exist');

// metaint=4: 4 audio bytes, 1 length byte (blocks of 16), metadata, more audio — split into small chunks
const meta = enc("StreamTitle='日本語 - タイトル';");
const blocks = Math.ceil(meta.length / 16);
const body = new Uint8Array(4 + 1 + blocks * 16 + 10);
body.set([1, 2, 3, 4], 0);
body[4] = blocks;
body.set(meta, 5);
const reader = new IcyReader(4);
let title;
for (let i = 0; i < body.length && title === undefined; i += 3) title = reader.push(body.subarray(i, i + 3));
eq(title, '日本語 - タイトル', 'title reassembled across chunks');

const tooLong = new IcyReader(4);
eq(tooLong.push(new Uint8Array(4 + 1 + 255 * 16 + 1)), null, 'metadata block present but no title gives null');

print(failed ? `${failed} FAILED` : 'ALL PASSED');
