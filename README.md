# dungeon-rogue

ブラウザで動くターン制ローグライク。Canvas + TypeScript / JavaScript 製。

## ゲーム内容

拠点とダンジョンを往復しながら敵を倒して強くなるゲームです。

- 職業: 戦士 / 守護者 / 魔法使い / 盗賊
- ダンジョン: プロシージャル生成マップ、複数テーマ（洞窟・ゴブリンの巣・呪われた森など）
- 戦闘: FOV・A* 経路探索・20 種以上のスペル・ステータス異常（毒・スロウ・睡眠・スタン）
- 増援: 規定ターンを超えると死神が出現
- カジノ: ブラックジャック・ルーレット・チンチロ

## 起動

依存パッケージのインストールは不要です。`index.html` をそのままブラウザで開くか、ローカルサーバーを立ててください。

```bash
# 例: Python の簡易サーバー
python3 -m http.server 8080
```

## ビルド・型チェック

```bash
npm install
npm run build      # TypeScript → dist/ にコンパイル
npm run typecheck  # 型チェックのみ（出力なし）
npm run test       # Vitest でユニットテスト実行
```

## 構成

```
src/
  core/       ゲームループ（main.js）・定数・入力・ロガー
  systems/    ゲームロジック（TypeScript・strict: true）
  entities/   Player / Enemy / Actor
  world/      マップ生成・A*・WFC
  data/       職業・装備・魔法定義
  ui/         描画専用モジュール
```

## 技術スタック

- Canvas API（描画・ゲームループ）
- TypeScript 6（strict: true、ESM）
- Vitest（ユニットテスト）
- 外部ライブラリなし
