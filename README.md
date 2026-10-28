# INCIDENT ARCHIVE v0.2.9.5 — LEAK / SAVE修正版

## LEAK
- 色の強度は維持したまま、面積や輪郭がわかる図形・バンド型のマスクを廃止。
- 低周波の連続濃度変化と、元写真の明暗を利用した染色に変更。ベタ塗りではなく画像の細部・階調が残る。
- 白色露光を円形スポットで作らず、写真の明るい部分に追従するハレーションとして生成。
- MUTATEのたびに赤、青、緑、紫、シアン、アンバー、マゼンタ、黄緑のLEAK専用色系統が変わる仕様を維持。

## SAVE（Safari / ブラウザ）
- 従来の「PNG生成後にnavigator.shareを自動呼び出しする」処理を廃止。
- SAVEでPNGを生成した後、DOWNLOAD PNG / SHARE / SAVE TO PHOTOSを表示する。
- iPhone Safariで写真アプリへ保存する場合は、SHARE / SAVE TO PHOTOSをタップ→iOS共有シートの「画像を保存」を選択する。DOWNLOAD PNGはファイルとして保存する。
- Mac/Windowsのブラウザは自動ダウンロードを試みるが、拒否された場合もDOWNLOAD PNGから直接保存できる。
- WebGL描画後、await前に2Dキャンバスへ確実に固定してPNG化する処理を維持。
- MUTATE / パラメータ変更 / BACK / モード変更 / 画像変更 / 出力サイズ変更時、前のPNGリンクを消去。

## 変更しない箇所
SOLAR、CHEMICAL、REGISTER、既存画面構成、MUTATE、EDIT、BACK、元写真比率、出力解像度（1800/2600/3200）、p5.js 1.11.13。

## 配置
ZIP内のindex.html、style.css、sketch.js、sw.js、manifest.webmanifestをGitHub Pagesのリポジトリ直下へ上書き。元からあるicons/は残してください。ヘッダーの版数が0.2.9.5であることを確認。Safariで古い版が出る場合は再読込、ホーム画面PWAなら再起動してください。

## 検証
JavaScript構文検査、Chromiumを用いたPNG生成からダウンロードリンク操作までの模擬動作確認を実施。実機iPhone Safariおよび実際のWebGLシェーダー描画は未検証。
