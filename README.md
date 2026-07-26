# ポケ相性推理

複合タイプポケモンを使い、技タイプへの相性から相手のポケモンを当てる 1v1 推理ゲームです。

**同じ端末** と **インターネット対戦** をホームで切り替えできます。

## 遊び方（ローカル）

1. `npm install` → `npm run dev`
2. 「同じ端末」で名前・図鑑を選んで開始
3. 交互に端末を渡してプレイ

## 遊び方（オンライン）

1. `npm run dev`（Vite + PartyKit が同時起動）
2. 「インターネット」→ 部屋をつくる / 部屋コードで参加
3. 各自の端末で選出・質問・解答（相手の選出は結果まで見えない）

オンラインの同期サーバは [PartyKit](https://partykit.io) です。

### 本番向け

1. PartyKit をデプロイ: `npm run deploy:party`（要ログイン）
2. フロントの環境変数にホストを設定してビルド:

```bash
# 例: xxx.username.partykit.dev
VITE_PARTY_HOST=your-project.yourname.partykit.dev npm run build
```

3. `dist/` を GitHub Pages などに公開

## ルール要約

- 複合タイプのみ。特性が相性に入ることがある
- タイプ質問・図鑑番号比較・名指し
- 先攻が正解したら後攻に1回追い当て。両方正解で引き分け

## データ

- `src/data/pokemon-champions.json` / `pokemon-national.json`
- 選出母集団: 同系統で相性同じフォルム除外 → 最終進化中心
- `src/data/type-chart.json` / `type-abilities.json`

## コマンド

```bash
npm run dev         # Web + PartyKit
npm run dev:web     # Vite のみ
npm run dev:party   # PartyKit のみ
npm test
npm run build
npm run deploy:party
```
