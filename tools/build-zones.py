"""macOS（IANA）の zone.tab から、国コード → [タイムゾーン, 緯度, 経度] の表（zones.js）を作る。
使い方: python3 tools/build-zones.py > zones.js"""
import json
import re
from collections import defaultdict


def degrees(text: str) -> float:
    sign = -1 if text[0] == "-" else 1
    digits = text[1:]
    if len(digits) in (4, 5):  # DDMM / DDDMM
        d, m, s = digits[:-2], digits[-2:], "0"
    else:  # DDMMSS / DDDMMSS
        d, m, s = digits[:-4], digits[-4:-2], digits[-2:]
    return round(sign * (int(d) + int(m) / 60 + int(s) / 3600), 1)


zones = defaultdict(list)
for line in open("/usr/share/zoneinfo/zone.tab", encoding="utf-8"):
    if line.startswith("#") or not line.strip():
        continue
    code, coords, tz = line.rstrip("\n").split("\t")[:3]
    lat, lon = re.match(r"([+-]\d+)([+-]\d+)", coords).groups()
    zones[code].append([tz, degrees(lat), degrees(lon)])

print("// 自動生成（tools/build-zones.py）。国コード → [タイムゾーン, 緯度, 経度] の一覧。手で書き換えないこと")
print("export const ZONES = " + json.dumps(dict(sorted(zones.items())), separators=(",", ":")) + ";")
