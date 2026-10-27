# INCIDENT ARCHIVE v0.2.9.4 — LEAK strong color flood

## LEAKを原点に戻した再設計
- 添付の赤い作例のような、写真の広い部分を強い色で覆う染色処理に修正。
- 前版の淡い透明色フィルターを廃止。画面の約半分以上を濃く染める大きな色面を基本にする。
- LEAK専用に高彩度8系統（赤、コバルト、緑、紫、シアン、アンバー、マゼンタ、黄緑）を追加。MUTATEのたびに直前とは異なる色系統に切り替わる。
- 白～淡色の広い露光と元写真の透けは維持。ただし不自然な尖った光線、強い直線境界、三角形状マスクは用いない。
- AMOUNTは染色の強さ、CHANCEは露光・透けに反映。PRESERVEも維持。

## 変更対象
- sketch.js のLEAKシェーダー、LEAK専用パレットとレシピの色選択のみ。
- SOLAR/CHEMICAL/REGISTER、GUI、入力、履歴、PNG保存、画像比率、p5.js 1.11.13は変更なし。
- index.html、sw.js、manifest.webmanifest のバージョンは0.2.9.4へ更新。

## GitHub Pages導入
1. ZIP内のindex.html / style.css / sketch.js / sw.js / manifest.webmanifestをリポジトリ直下へ上書き。
2. 既存のicons/フォルダーは削除しない（ZIPには含めない）。
3. GitHub Pages公開後、Safariで開きバージョン0.2.9.4を確認。ホーム画面PWAが古い場合はアプリを閉じて再起動し、必要なら再追加。

## 検証範囲
JavaScript構文検証・ソース構成の検証を実施。iPhone Safari実機での表示・エクスポートは未検証。
