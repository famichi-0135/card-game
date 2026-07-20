# チーム開発ガイド

## 目的と基本方針

この文書は、2〜3人で安全に開発を進めるための共通手順です。Git や GitHub に不慣れでも、ここにある順番で進めればよい状態を目指します。

- `main` は常に動作確認できる状態に保つ。
- `main` へ直接 push しない。すべての変更は Pull Request (PR) を通す。
- 1つの作業は、1つの Issue、1つのブランチ、1つの PR に対応させる。
- 小さく完結する変更を優先する。大きな作業は Issue を分ける。
- 不明な競合やエラーは、推測で解消しない。作業を止めてチームに共有する。

## 最初に行うこと

### GitHub とローカルの準備

リポジトリ管理者は、各メンバーを GitHub リポジトリの Collaborator として招待します。各メンバーは GitHub の招待を承諾してから、次を一度だけ実行します。

```sh
git config --global user.name "表示名"
git config --global user.email "GitHub に登録したメールアドレス"
```

初回だけリポジトリを clone します。`<repository-url>` は GitHub の `Code` ボタンからコピーした HTTPS URL に置き換えます。

```sh
git clone <repository-url>
cd DisastarCardGame
pnpm install
pnpm run check-types
```

Node.js 26 と pnpm 11 が必要です。詳細な開発コマンドと構成は [ルート README](../README.md) を参照してください。

### GitHub 側で最初に設定すること

リポジトリ管理者は `main` にルールを設定します。GitHub の画面表示は更新されるため、設定場所は `Settings` 内の `Rules` または `Branches` を確認してください。

- 対象ブランチ: `main`
- PR を必須にする。
- 作成者以外の承認を1件必須にする。
- 新しい commit が push されたら、既存の承認を無効にする。
- すべてのレビューコメントの解決を必須にする。
- force push とブランチ削除を禁止する。
- マージ方式は `Squash and merge` だけを許可する。
- Auto-merge を有効にする。
- `Automatically delete head branches` を有効にする。

CI の `Quality` を必須 status check にします。`Quality` は `format:check`、`lint`、`check-types`、`test`、`build` を実行します。承認・`Quality`・会話解決がそろった PR は、Squash auto-merge により GitHub がマージします。GitHub の branch protection と ruleset は、PR の承認・会話の解決・status check・force push 禁止をルール化できます。[GitHub Docs: branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## ブランチ戦略

長期間残るブランチは `main` だけにします。`develop` や個人用の常設ブランチは作りません。

| 種類     | 用途                 | 例                    |
| -------- | -------------------- | --------------------- |
| `feat/`  | 新機能               | `feat/card-draw`      |
| `fix/`   | 不具合修正           | `fix/health-response` |
| `docs/`  | 文書変更             | `docs/team-guide`     |
| `chore/` | 依存関係、設定、雑務 | `chore/update-eslint` |

ブランチ名は英小文字とハイフンを使い、何をする変更かが分かる名前にします。作業が完了して PR をマージしたら、リモートとローカルのブランチを削除します。

### ブランチのライフサイクル

作業ブランチは、Issue または明確な作業単位ごとに作成する一時的なものです。マージ済みのブランチを次の作業に使い回したり、個人用の常設ブランチを作ったりしません。

1. 最新の `main` から作業ブランチを作る。
2. 作業内容を commit し、PR を作る。
3. `Quality`、レビュー、会話解決の条件を満たし、Squash auto-merge を有効にする。
4. GitHub は `Automatically delete head branches` により、マージ済みのリモートブランチを自動削除する。
5. 各自のローカルブランチは残るため、`main` を同期してから削除する。

作業途中の未コミット変更がある場合は、ブランチを切り替えたり削除したりしません。変更を今の作業として commit するか、新しい作業ブランチを作ってから続けます。

## 作業を始める手順

作業開始前に `main` を最新にします。別の作業ブランチに未保存の変更がある場合は、先に commit するかチームへ相談してください。

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/card-draw
```

作業内容が決まっていない場合は、先に GitHub Issue を作ります。Issue には少なくとも次を記載します。

- 目的・背景
- 完了条件
- 変更しそうな場所
- 担当者

同じファイルを複数人が同時に大きく変更すると競合しやすくなります。担当するファイルや API 契約が重なる場合は、着手前に担当を調整してください。

## 作業中の Git 操作

変更状況はこまめに確認します。

```sh
git status
git diff
```

意味のある単位で commit します。生成物、依存関係、実装を無関係に混ぜないでください。

```sh
git add apps/frontend/src/App.tsx
git commit -m "feat(frontend): add card draw screen"
```

commit メッセージは次の形式を推奨します。

```text
<種類>(<対象>): <変更内容>
```

例:

```text
feat(backend): add game creation endpoint
fix(contracts): correct health response type
docs: add team development guide
chore: update dependencies
```

未追跡ファイルを含めて一括追加する `git add .` は、内容を確認できる場合だけ使います。`.env`、`.dev.vars`、秘密鍵、トークンは絶対に commit しません。

Cloudflare Binding を変更した場合は、次を実行して生成された `worker-configuration.d.ts` を commit に含めます。

```sh
pnpm --filter @disastar/frontend run cf-typegen
```

## `main` の変更を取り込む手順

他の PR が先にマージされていたら、自分のブランチへ `main` を取り込みます。初学者の通常運用では rebase や force push を使わず、merge を使います。

```sh
git fetch origin
git switch feat/card-draw
git merge origin/main
```

競合が起きた場合は次の順で対応します。

1. `git status` で競合しているファイルを確認する。
2. 競合箇所を、変更の意図を確認しながら修正する。
3. テストコマンドを実行する。
4. `git add <解決したファイル>` と `git commit` を行う。

どちらの変更を残すべきか分からない場合は、競合マーカーを消さずにチームへ相談します。`git reset --hard`、`git push --force`、他人のブランチへの push は通常作業では使いません。

## Pull Request の作り方

### 作成前の確認

PR 前に、変更に応じて次を実行します。

```sh
pnpm run format:check
pnpm run lint
pnpm run check-types
pnpm run build
```

画面変更なら開発サーバーで操作も確認します。Binding を変更した場合は `cf-typegen` の実行結果も確認します。

ブランチを GitHub へ送ります。

```sh
git push -u origin feat/card-draw
```

GitHub 上で表示される `Compare & pull request` を選ぶか、リポジトリの `Pull requests` から `New pull request` を選びます。次を確認して PR を作成します。

- base branch は `main`。
- compare branch は自分の作業ブランチ。
- タイトルは変更内容が分かる短い文。
- 本文に目的、変更内容、確認内容、未対応事項を書く。
- 関連する Issue があれば `Closes #123` の形式でリンクする。
- 少なくとも1人のチームメンバーを reviewer に指定する。

PR 作成時は自動表示されるテンプレートを埋めます。`pnpm run test` も確認項目に含めます。

### Codex による実装補助

Codex に実装を依頼する場合は、Issue の内容を人間が確認した後に GitHub Actions を手動起動します。Codex は差分生成、確認、Draft PR 作成、PR コメントによるレビューを補助しますが、承認はしません。詳細は [AI 開発運用ガイド](./ai-development.md) を参照してください。

## レビューとマージ

### レビュアー

レビュアーは、動作だけでなく次を確認します。

- PR の目的と変更内容が一致しているか。
- 型、エラー処理、API 契約に問題がないか。
- 無関係な変更、秘密情報、不要な生成物が混ざっていないか。
- 確認コマンドの結果が記載されているか。

不明点はコメントで質問します。修正が必要なら `Request changes`、問題がなければ `Approve` を選びます。承認は「変更内容を理解し、`main` に入れてよい」という意思表示です。

### 作成者

レビューコメントには、対応した commit を push して返信します。内容を変える commit を追加した後は、再レビューを依頼します。承認済みでも、追加変更後に自分だけでマージしません。

必要な承認、コメント解決、`Quality` の完了後に、GitHub が有効化済みの Squash auto-merge を実行します。Codex が作成した PR は Codex review 成功後に auto-merge が有効になります。通常の PR では、作成者が GitHub 上で `Enable auto-merge` を選びます。マージ後、GitHub 上の作業ブランチは自動削除されます。各自のローカルブランチは、次の手順で整理します。

```sh
git switch main
git pull --ff-only origin main
git branch -d feat/card-draw
git fetch --prune
```

`git branch -d` が失敗した場合は、マージ状況を確認します。`-D` で強制削除せず、未マージの作業や未コミット変更がないことをチームで確認してから対応します。

## 困ったときの対応

| 状況                            | 最初にすること                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------- |
| 変更を間違えた                  | `git status` と `git diff` を確認し、まだ commit していなければチームへ相談する。 |
| `main` に問題のある変更を入れた | 新しい PR で `git revert <commit-id>` を使って取り消す。履歴を消さない。          |
| push 先を間違えた               | 追加の push をせず、すぐにチームへ共有する。                                      |
| 競合を解決できない              | 競合しているファイル名と作業ブランチを共有して、一緒に確認する。                  |
| GitHub の操作が分からない       | PR を作成する前に画面のスクリーンショットと状況をチームへ共有する。               |

Git の問題は隠さず早く共有するほど直しやすくなります。特に `main`、秘密情報、デプロイ設定に関わる操作は、実行前にもう1人へ確認を求めてください。
