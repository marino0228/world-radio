#!/bin/sh
# 公開の前に実行する：画面のファイル（app.js・style.css と app.js が読む部品）の URL に版番号を付け直す。
# iPhone の Safari が古いファイルを使い続けて、新旧が混ざらないようにするため。
set -e
cd "$(dirname "$0")/.."
V="$(date +%Y%m%d%H%M)"
perl -pi -e "s{(src=\"app\.js)(\?v=\w+)?\"}{\$1?v=$V\"}; s{(href=\"style\.css)(\?v=\w+)?\"}{\$1?v=$V\"}" index.html
perl -pi -e "s{(from\s+'\./[A-Za-z]+\.js)(\?v=\w+)?'}{\$1?v=$V'}g" app.js
echo "version $V"
