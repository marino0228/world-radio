// 局の現地時間に使うタイムゾーンを決める。
// Radio Browser の局にはタイムゾーンがないので、国・座標・州の名前から推定する。
import { ZONES } from './zones.js';

// 時差が複数ある国で、場所が分からないときに使う代表のタイムゾーン（人の多い地域）
const DEFAULTS = {
  RU: 'Europe/Moscow', BR: 'America/Sao_Paulo', MX: 'America/Mexico_City', ID: 'Asia/Jakarta',
  UA: 'Europe/Kyiv', UZ: 'Asia/Tashkent', GL: 'America/Nuuk', CL: 'America/Santiago',
  ES: 'Europe/Madrid', PT: 'Europe/Lisbon', KZ: 'Asia/Almaty', AR: 'America/Argentina/Buenos_Aires',
};
// 場所が分からないと時刻を決められない国（東西で時差が大きく、局も各地にある）
const NEEDS_LOCATION = new Set(['US', 'CA', 'AU']);

const zone = (names, tz) => names.map((n) => [n, tz]);
// 州・地域の名前 → タイムゾーン。長い名前から順に調べる（"west virginia" を "virginia" より先に）
const STATES = {
  US: [
    ...zone(['connecticut', 'delaware', 'florida', 'georgia', 'indiana', 'kentucky', 'maine', 'maryland',
      'massachusetts', 'michigan', 'new hampshire', 'new jersey', 'new york', 'north carolina', 'ohio',
      'pennsylvania', 'rhode island', 'south carolina', 'vermont', 'virginia', 'west virginia',
      'district of columbia', 'washington dc', 'washington d c'], 'America/New_York'),
    ...zone(['alabama', 'arkansas', 'illinois', 'iowa', 'kansas', 'louisiana', 'minnesota', 'mississippi',
      'missouri', 'nebraska', 'north dakota', 'oklahoma', 'south dakota', 'tennessee', 'texas', 'wisconsin'],
    'America/Chicago'),
    ...zone(['colorado', 'idaho', 'montana', 'new mexico', 'utah', 'wyoming'], 'America/Denver'),
    ...zone(['arizona'], 'America/Phoenix'),
    ...zone(['california', 'nevada', 'oregon', 'washington'], 'America/Los_Angeles'),
    ...zone(['alaska'], 'America/Anchorage'),
    ...zone(['hawaii'], 'Pacific/Honolulu'),
  ],
  CA: [
    ...zone(['newfoundland', 'labrador'], 'America/St_Johns'),
    ...zone(['nova scotia', 'new brunswick', 'prince edward island'], 'America/Halifax'),
    ...zone(['quebec', 'ontario'], 'America/Toronto'),
    ...zone(['manitoba'], 'America/Winnipeg'),
    ...zone(['saskatchewan'], 'America/Regina'),
    ...zone(['alberta'], 'America/Edmonton'),
    ...zone(['british columbia'], 'America/Vancouver'),
    ...zone(['yukon'], 'America/Whitehorse'),
    ...zone(['northwest territories'], 'America/Yellowknife'),
    ...zone(['nunavut'], 'America/Iqaluit'),
  ],
  AU: [
    ...zone(['new south wales', 'nsw', 'sydney', 'act', 'canberra'], 'Australia/Sydney'),
    ...zone(['victoria', 'vic', 'melbourne'], 'Australia/Melbourne'),
    ...zone(['queensland', 'qld', 'brisbane'], 'Australia/Brisbane'),
    ...zone(['south australia', 'sa', 'adelaide'], 'Australia/Adelaide'),
    ...zone(['western australia', 'wa', 'perth'], 'Australia/Perth'),
    ...zone(['tasmania', 'tas', 'hobart'], 'Australia/Hobart'),
    ...zone(['northern territory', 'nt', 'darwin'], 'Australia/Darwin'),
  ],
};
for (const list of Object.values(STATES)) list.sort((a, b) => b[0].length - a[0].length);

// 小文字・アクセント記号なし・記号は空白に（"Québec" → "quebec"、"D.C." → "d c"）
function simplify(text) {
  return ` ${(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()} `;
}

function fromState(code, state) {
  const text = simplify(state);
  const found = (STATES[code] || []).find(([name]) => text.includes(` ${name} `));
  return found ? found[1] : null;
}

function nearest(zones, lat, lon) {
  let best = null;
  let bestDistance = Infinity;
  for (const [tz, zLat, zLon] of zones) {
    const dLon = (lon - zLon) * Math.cos(((lat + zLat) / 2) * (Math.PI / 180));
    const distance = (lat - zLat) ** 2 + dLon ** 2;
    if (distance < bestDistance) {
      best = tz;
      bestDistance = distance;
    }
  }
  return best;
}

export function stationTimeZone(station) {
  const code = (station.country || '').toUpperCase();
  const zones = ZONES[code];
  if (!zones) return null;
  if (zones.length === 1) return zones[0][0];
  const lat = Number(station.lat);
  const lon = Number(station.lon);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)
    && station.lat != null && station.lon != null;
  if (hasCoords) return nearest(zones, lat, lon);
  const byState = fromState(code, station.state);
  if (byState) return byState;
  if (NEEDS_LOCATION.has(code)) return null;
  return DEFAULTS[code] || zones[0][0];
}
