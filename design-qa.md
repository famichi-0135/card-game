# Application UI Design QA

## 対象

- Visual source of truth: トップページ（`/`）
- 確認対象: `/learn`、`/rule`、`/login`、認証エラー時の`/mypage`・`/rooms/:matchId`
- 除外対象: `/games/:gameId` の対戦画面

## 確認結果

- 共通: 近黒の背景、青黒のグラデーションサーフェス、薄い技術ボーダー、金の主操作、青の副操作、白〜青灰の文字階層を確認。
- `/learn`: 記事一覧、カテゴリ選択、記事導線、タグ、注意書きが暗色アプリケーションUIで表示されることを確認。
- `/rule`: ページ見出し、基本値、目次、各解説、図解準備中状態が同じ視覚言語で表示されることを確認。
- `/login`: 認証アクションが金の主操作・青の副操作として表示されることを確認。
- 認証が必要なルート: ローカルでBackend Workerを起動していないため認証済み状態の実レンダリングは未実施。ただし、エラー状態は共通の暗色Empty Stateで確認。

## 対戦画面の保護

- 今回の実装では`apps/frontend/src/features/game-board/`を変更していない。
- 既存の未コミット変更である`apps/frontend/src/features/game-board/game-route.tsx`は今回の作業対象外として保持した。

## Final result

passed（認証済み状態の手動確認のみ、Backend Workerを伴う別途確認が必要）

## ヘッダー共通化・ヒーロー背景の追補確認

- 要件: トップページを正とし、ゲーム画面以外の共通ヘッダーの余白・スクロール退避を統一する。トップのヒーローには既存のR2都市俯瞰画像を周辺で暗色背景へ溶け込ませて表示する。
- 実装画面: ローカルの`/`、`/learn`、`/rule`、`/login`。
- 確認 viewport: 1265 x 720 CSS px（device scale factor 1）。
- 比較: `AppHeader`は全対象ページで1つだけ描画され、同じ`max-w-[1596px] px-4 sm:px-7`のページフレームを使用することをDOMで確認した。本文とヘッダーのアイランド内側は同じ左右基準線に揃う。
- 操作確認: `/rule`で下スクロール時はヘッダーが画面外まで退避し、上スクロール時は復帰するスクリーンショットを確認した。
- 背景確認: トップのヒーローが`/game-assets/backgrounds/board/night-city-aerial.037226cbe99ad877f83b09ad99e8ce9fbb7822f92e608058b914a8921008500b.png`を優先参照し、放射状マスクで周囲へフェードするcomputed styleを確認した。
- 付随修正: ルート読込中の画面ではアカウントメニューを描画しないようにし、QueryClient未設定の回帰を防いだ。

### 追補結果

passed
