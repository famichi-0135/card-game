# 開発環境構築ガイド

## 1. 目的

本書は、Disastar Card Gameをローカルで開発・検証できる状態にするための手順を定義する。
通常のローカル開発にCloudflareアカウントや本番用Secretは不要である。

GitとGitHubの作業手順は[チーム開発ガイド](./team-development.md)、D1・Drizzle・
Better Authの設計は[データベース・認証基盤](../backend/database-and-auth.md)を参照する。

## 2. リポジトリ構成

このプロジェクトはpnpm WorkspaceとTurborepoを使用するモノレポである。

| パス                         | 役割                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `apps/frontend`              | React、Vite、Cloudflare Vite Pluginを使う画面とFrontend Worker |
| `apps/backend`               | Hono、D1、Durable Objects、Better Authを使うBackend Worker     |
| `packages/game-engine`       | インフラに依存しないゲームルールと状態遷移                     |
| `packages/contracts`         | FrontendとBackend間の通信契約                                  |
| `packages/ui`                | 共有UIコンポーネント                                           |
| `packages/eslint-config`     | 共通ESLint設定                                                 |
| `packages/typescript-config` | 共通TypeScript設定                                             |

依存関係のインストールとコマンド実行は、特別な理由がない限りリポジトリルートで行う。

## 3. 必要なソフトウェア

| ソフトウェア | 必要なバージョン   | 用途                                    |
| ------------ | ------------------ | --------------------------------------- |
| Git          | サポート中の安定版 | ソースコード管理                        |
| Node.js      | 26.x               | TypeScript、Vite、テスト、各種CLIの実行 |
| pnpm         | 11.x。基準は11.8.0 | Workspaceと依存関係の管理               |

Docker、グローバル版Wrangler、ローカルSQLiteの個別インストールは不要である。Wrangler、
Drizzle Kit、VitestなどはWorkspaceの依存関係として実行する。

インストール後、ターミナルを開き直してバージョンを確認する。

```sh
node --version
pnpm --version
git --version
```

期待する結果は、Node.jsが`v26.x.x`、pnpmが`11.x.x`である。pnpmが未導入の場合は、
Node.js付属のnpmからプロジェクト基準版をインストールできる。

```sh
npm install --global pnpm@11.8.0
```

## 4. 初回セットアップ

### 4.1 リポジトリの取得

`<repository-url>`をGitHubの`Code`から取得したURLへ置き換える。

```sh
git clone <repository-url>
cd DisastarCardGame
git status
```

### 4.2 依存関係のインストール

```sh
pnpm install --frozen-lockfile
```

`pnpm-lock.yaml`と`package.json`が一致していない場合、このコマンドは失敗する。依存関係を
意図的に変更する作業でなければ、`--no-frozen-lockfile`で回避せずチームへ共有する。

### 4.3 初回検証

```sh
pnpm run format:check
pnpm run lint
pnpm run check-types
pnpm run test
pnpm run build
```

これらはTurborepoが各Workspaceへ振り分ける。初回は依存関係の解析やCloudflare Workersの
ビルドに時間がかかる場合がある。

## 5. ローカル開発の開始

リポジトリルートで次を実行する。

```sh
pnpm run dev
```

TurborepoがFrontendとBackendを同時に起動する。

| 対象                   | URL                                |
| ---------------------- | ---------------------------------- |
| Frontend               | `http://localhost:5173`            |
| Backend                | `http://127.0.0.1:8787`            |
| Frontend経由の疎通確認 | `http://localhost:5173/api/health` |

ブラウザまたは別のターミナルから疎通を確認する。

```sh
curl http://localhost:5173/api/health
```

正常時は次を返す。

```json
{ "status": "ok" }
```

開発サーバーは`Ctrl+C`で停止する。終了後に同じポートが残っている場合は、別の開発サーバー
を起動する前に、実行中のNode.js、Vite、Wranglerプロセスを確認する。

### 5.1 アプリを個別に起動する

Backendだけを起動する場合:

```sh
pnpm --filter @disastar/backend run dev
```

Frontendだけを起動する場合:

```sh
pnpm --filter @disastar/frontend run dev
```

Frontendの`/api/*`は`BACKEND` Service Bindingへ転送される。APIを含む画面を検証するときは、
基本的にルートの`pnpm run dev`で両方を起動する。

## 6. Backendのローカル初期化

Backendの`dev`コマンドは、Worker起動前に次を自動実行する。

1. `apps/backend/.dev.vars`がなければ、`.dev.vars.example`からローカル用設定を生成する。
2. Better Auth用にランダムなSecretを生成する。
3. 既存の`.dev.vars`がある場合は、読み取りも上書きもしない。
4. ローカルD1へ未適用のDrizzleマイグレーションを適用する。
5. Wranglerの開発サーバーを起動する。

`.dev.vars`、`.env`、CloudflareトークンなどはGitへ追加しない。値をIssue、PR、ログ、チャットへ
貼り付けない。ローカル用設定を本番へ流用しない。

`.dev.vars.example`で管理するキーは次のとおりである。

| キー                          | 用途                                       |
| ----------------------------- | ------------------------------------------ |
| `BETTER_AUTH_SECRET`          | Better Authの署名用Secret                  |
| `BETTER_AUTH_URL`             | クライアントから見える認証APIのオリジン    |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Cookie付き認証リクエストを許可するオリジン |
| `GOOGLE_CLIENT_ID`            | Google OAuthクライアントID                 |
| `GOOGLE_CLIENT_SECRET`        | Google OAuthクライアントSecret             |

Google OAuth をローカルで確認する場合、`BETTER_AUTH_URL`と`BETTER_AUTH_TRUSTED_ORIGINS`はともに`http://localhost:5173`とする。Google Cloud Consoleには`http://localhost:5173/api/auth/callback/google`を承認済みリダイレクトURIとして登録する。既存の`.dev.vars`は自動更新されないため、メール認証用のキーを残さず、上表のGoogle OAuth用キーへ手動で置き換える。

Wranglerローカル環境ではCloudflare Edgeの`CF-Connecting-IP`が存在しないため、Better Authが
クライアントIPを判定できない警告が出る場合がある。本番の信頼境界を弱めるため、警告を
消す目的で任意の転送ヘッダーを信頼対象へ追加しない。

## 7. D1とDrizzle

### 7.1 ローカルマイグレーション

通常はBackend起動時に自動適用される。明示的に適用する場合は次を実行する。

```sh
pnpm --filter @disastar/backend run db:migrate:local
```

ローカルD1の状態は`apps/backend/.wrangler/`に保存され、Git管理対象外である。このディレクトリ
を削除するとローカルデータが失われるため、データ破棄の意図がない限り削除しない。

### 7.2 認証スキーマを変更する

Better Authの設定やプラグインを変更した場合は、次の順で生成物を更新する。

```sh
pnpm --filter @disastar/backend run auth:schema
pnpm --filter @disastar/backend run db:generate
pnpm --filter @disastar/backend run db:check
pnpm --filter @disastar/backend run db:migrate:local
pnpm --filter @disastar/backend run test
```

`apps/backend/src/db/schema/`のTypeScriptと`apps/backend/drizzle/`のSQLをレビューし、両方を
commitする。生成されたSQLを確認せずリモートD1へ適用しない。

## 8. Cloudflare Bindingの型生成

`wrangler.jsonc`のBindingや環境変数テンプレートを変更した場合は、対象Workerの型を再生成する。

```sh
pnpm --filter @disastar/backend run cf-typegen
pnpm --filter @disastar/frontend run cf-typegen
```

生成された`worker-configuration.d.ts`の差分を確認し、Binding変更と同じcommitへ含める。

## 9. 日常的な確認コマンド

変更をPRへ送る前に、リポジトリルートでCIと同じ確認を行う。

```sh
pnpm run format:check
pnpm run lint
pnpm run check-types
pnpm run test
pnpm run build
```

開発中に対象を絞る場合は`--filter`を使用する。

```sh
pnpm --filter @disastar/game-engine run test
pnpm --filter @disastar/backend run test
pnpm --filter @disastar/backend run check-types
pnpm --filter @disastar/frontend run check-types
```

整形が必要な場合は、差分を確認してから実行する。

```sh
pnpm run format
git diff
```

## 10. Cloudflareのリモート環境を扱う場合

ローカル開発だけなら、この節の設定は不要である。デプロイ、既存D1の取得、リモート
マイグレーション、Google OAuthの設定は、リポジトリ管理者が内容を確認して実行する。

1. Cloudflareアカウントへログインする。
2. `apps/backend/wrangler.jsonc`のD1 `database_id`プレースホルダーを実環境に合わせる。
3. Better AuthとGoogle OAuthに必要な変数・SecretをCloudflare側へ設定する。
4. Google Cloud Consoleで、各公開オリジンの`/api/auth/callback/google`を承認済みリダイレクトURIとして登録する。
5. Backendを先にデプロイし、その後Frontendをデプロイする。

既存D1の取得にDrizzle Kitを使用する場合だけ、次をローカル環境変数として設定する。

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_TOKEN`

値はリポジトリへ保存しない。既存D1に対して最初から`db:migrate:remote`を実行せず、先に
[データベース・認証基盤](../backend/database-and-auth.md)の取り込み手順を確認する。

## 11. トラブルシューティング

### Node.jsまたはpnpmのバージョンが合わない

```sh
node --version
pnpm --version
```

Node.js 26.x、pnpm 11.xへ合わせ、ターミナルを開き直してから`pnpm install --frozen-lockfile`
を再実行する。異なるNode.jsメジャーバージョンで作られた`node_modules`を使い続けない。

### `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`が発生する

異なるpnpmやNode.jsで作成された`node_modules`を、CIやIDEなどの非対話シェルから再作成
しようとした場合に発生する。開発サーバーを停止し、Node.jsとpnpmのバージョンを確認した
うえで、通常の対話ターミナルから次を実行する。

```sh
pnpm install --force
```

これは依存関係を再作成するため、完了まで待つ。エラー回避のためにpnpmのグローバル設定を
変更したり、複数のpnpmバージョンを混在させたりしない。

### `BETTER_AUTH_* must not be empty`でAPIが500になる

`pnpm --filter @disastar/backend run dev`から起動し、ローカル設定の自動生成を完了させる。
`.dev.vars`の内容を画面共有やログへ出さず、必要なキー名だけを`.dev.vars.example`と比較する。

### D1のテーブルが見つからない

```sh
pnpm --filter @disastar/backend run db:migrate:local
pnpm --filter @disastar/backend run db:check
```

それでも解消しない場合は、適用対象がローカルD1かリモートD1かを確認する。調査目的で
リモートマイグレーションを実行しない。

### Workerの型が古いと表示される

```sh
pnpm --filter @disastar/backend run cf-typegen
pnpm --filter @disastar/frontend run cf-typegen
pnpm run check-types
```

### ポート5173または8787を使用できない

同じプロジェクトの開発サーバーが別ターミナルで動いていないか確認し、不要なプロセスを
正常終了する。既存プロセスの正体を確認せず、Node.jsプロセスを一括終了しない。

## 12. セットアップ完了条件

次をすべて満たせば、通常の開発を開始できる。

- Node.js 26.xとpnpm 11.xを使用している。
- `pnpm install --frozen-lockfile`が成功する。
- `pnpm run dev`でFrontendとBackendが起動する。
- `http://localhost:5173/api/health`が`{"status":"ok"}`を返す。
- `pnpm run lint`、`pnpm run check-types`、`pnpm run test`、`pnpm run build`が成功する。
- `.dev.vars`やトークンがGitの変更一覧へ含まれていない。
