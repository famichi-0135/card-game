# Staging 環境の構築・確認手順

## 目的

本書は、production と完全に分離した staging 環境を構築し、Google OAuth と2人対戦を実ブラウザで確認するための手順である。staging は次のリソースを使用する。

- Backend Worker: `disastar-backend-staging`
- Frontend Worker: `disastar-frontend-staging`
- D1: `disastar-card-game-staging`
- Durable Object: staging Backend Worker に属する専用名前空間

Frontend は staging Backend Worker だけを Service Binding で呼び出す。staging が production の D1、Durable Object、Worker を参照してはならない。

`apps/frontend/.env.staging` は Cloudflare Vite プラグインが build 時に staging 設定を選択するための追跡対象ファイルである。`CLOUDFLARE_ENV=staging` 以外、特に Secret は追加しない。

## 作業分担

| 担当             | 作業                                                        | 共有・保存してよい情報                 |
| ---------------- | ----------------------------------------------------------- | -------------------------------------- |
| リポジトリ管理者 | Cloudflare で staging D1 を作成する                         | D1 database ID                         |
| リポジトリ管理者 | Google Cloud Console で OAuth callback を登録する           | staging の公開オリジン                 |
| リポジトリ管理者 | Cloudflare の staging Backend へ変数・Secret を設定する     | 値は共有・commit しない                |
| Codex            | Wrangler の分離設定、デプロイスクリプト、確認項目を保守する | Secret を扱わない                      |
| テスト担当2人    | 実ブラウザで2人対戦の受け入れ確認を行う                     | テスト結果だけを Issue / PR へ記録する |

`BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_SECRET`、Cloudflare API Token、Google のクライアント Secret は、チャット、Issue、PR、commit、ログへ貼り付けない。

## 初回構築

### 1. staging D1 を作成する

Cloudflare Dashboard または次のコマンドで `disastar-card-game-staging` を作成する。

```sh
pnpm --filter @disastar/backend exec wrangler d1 create disastar-card-game-staging
```

出力される **D1 database ID** を、`apps/backend/wrangler.jsonc` の staging 用 `database_id` へ設定する。この ID は Secret ではないが、設定変更は PR でレビューする。`replace-with-cloudflare-staging-d1-database-id` のままデプロイしてはならない。

### 2. Backend の schema と Durable Object を反映する

ステージング設定を含む PR を main へマージ後、リポジトリ管理者が次の順で実行する。

```sh
pnpm --filter @disastar/backend run db:migrate:staging
pnpm --filter @disastar/backend run deploy:staging
```

`deploy:staging` は `--env staging` を使うため、Backend Worker と Durable Object は staging 専用として作成される。`--keep-vars` により Cloudflare Dashboard で設定した変数・Secret を消さない。

### 3. Frontend を公開して staging origin を確定する

```sh
pnpm --filter @disastar/frontend run deploy:staging
```

カスタムドメインを使わない初回構築では、出力された `https://disastar-frontend-staging.<account-subdomain>.workers.dev` を staging origin とする。カスタムドメインを使う場合は、DNS と route の設定を完了してからその URL を使う。未管理の preview URL は OAuth callback に使用しない。

### 4. Google OAuth と Backend 変数を設定する

Google Cloud Console の OAuth 2.0 Web クライアントに、次の承認済みリダイレクト URI を完全一致で追加する。

```text
<staging-origin>/api/auth/callback/google
```

Cloudflare Dashboard の **`disastar-backend` / staging 環境** に、次の値を設定する。

| キー                          | 値                               | 種別     |
| ----------------------------- | -------------------------------- | -------- |
| `BETTER_AUTH_SECRET`          | 32文字以上のランダム値           | Secret   |
| `BETTER_AUTH_URL`             | staging origin                   | 環境変数 |
| `BETTER_AUTH_TRUSTED_ORIGINS` | staging origin                   | 環境変数 |
| `GOOGLE_CLIENT_ID`            | Google OAuth クライアント ID     | 環境変数 |
| `GOOGLE_CLIENT_SECRET`        | Google OAuth クライアント Secret | Secret   |

設定後、Backend を再デプロイする。

```sh
pnpm --filter @disastar/backend run deploy:staging
```

## デプロイ前チェック

外部リソースを変更せずに設定とビルドを確認するには、次を実行する。

```sh
pnpm --filter @disastar/backend run deploy:staging:check
pnpm --filter @disastar/frontend run deploy:staging:check
```

続けて、通常の品質検査を実行する。

```sh
pnpm run lint
pnpm run check-types
pnpm run test
```

## Staging 受け入れ確認

テスト用 Google アカウント 2 つで、次を確認する。

1. `/login` から Google OAuth でログインし、ログアウト後に再ログインできる。
2. 未ログインで開いた待機部屋・対戦画面が、ログイン後に同じ URL へ戻る。
3. それぞれ異なるロールを選び、部屋作成、招待 URL での参加、対戦開始まで到達できる。
4. 手札の攻撃カード配置・連鎖・破棄、サポート対象選択、フェーズ終了確認が正規状態へ反映される。不正なドロップではコマンドを送らない。
5. 一方のブラウザを閉じて再度開き、WebSocket のプレゼンスと HTTP 再同期が復旧する。操作責任を持つプレイヤーが制限時間を超えて戻らない場合は敗北になる。
6. 終了後24時間以内に同じ利用者で対戦 URL を開き、終了状態と公開イベントを再取得できる。

失敗時は Secret や Cookie を添付せず、再現手順、時刻、画面のエラーコード、Worker の request ID だけを記録する。

## Production への進行条件

staging の上記確認が2人分完了し、認証・ゲーム進行・再接続に P0 の不具合がないことを確認してから production の環境値とドメインを設定する。production は staging の D1 database ID、Worker、Durable Object を再利用しない。
