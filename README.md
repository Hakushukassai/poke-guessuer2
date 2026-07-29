# ポケ相性推理

複合タイプポケモンを使い、技タイプへの相性から相手のポケモンを当てる 1v1 推理ゲームです。

ホームで **チャンピオンズ／全国** を正面に選び、お題パックやバン・質問上限は格納した味変として任意で付けられます。
**同じ端末** と **インターネット対戦** も切り替えできます。

## 遊び方（GitHub Pages）

公開 URL（初回は Actions 成功後）:

https://hakushukassai.github.io/poke-guessuer2/

「同じ端末」でも「インターネット」（WebRTC）でも遊べます。インターネットは部屋主のタブが開いている必要があります。

リポジトリの **Settings → Pages → Source** を **GitHub Actions** にしてください（初回のみ）。`main` へ push すると自動デプロイされます。

## 遊び方（ローカル）

1. `npm install` → `npm run dev`
2. 「同じ端末」で名前・図鑑を選んで開始
3. 交互に端末を渡してプレイ

## 遊び方（オンライン）

1. `npm run dev`（または GitHub Pages）
2. 「インターネット」→ 片方「部屋をつくる」、もう片方はコードで「参加」
3. 通話は Discord / LINE など別アプリでOK

同期は端末同士の WebRTC（PeerJS）です。独自サーバやドメインは不要です。部屋主がページを閉じると切断されます。

## ルール要約

- 複合タイプのみ。特性が相性に入ることがある
- タイプ質問・図鑑番号比較・名指し
- 先攻が正解したら後攻に1回追い当て。両方正解で引き分け

## データ

- `src/data/pokemon-champions.json` / `pokemon-national.json`
- お題パック: `pokemon-legendary.json` / `pokemon-starters.json` / `pokemon-spooky.json`（`node scripts/build-theme-packs.mjs` で再生成）
- 選出母集団: 同系統で相性同じフォルム除外 → 最終進化中心
- `src/data/type-chart.json` / `type-abilities.json`
- 対戦推理の使用率: `src/data/champions-usage.json`（Smogon Champions OU）

```bash
curl -sL https://www.smogon.com/stats/2026-04/chaos/gen9championsou-1500.json.gz \
  | gzip -dc > /tmp/champ_ou.json
node scripts/build-champions-usage.mjs
```


## コマンド

```bash
npm run dev         # Vite
npm run build
npm test
```

（旧 PartyKit 用の `dev:party` / `deploy:party` は残してありますが、オンライン対戦には使いません）
