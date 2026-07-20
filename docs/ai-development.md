# AI 開発運用ガイド

## 目的

この文書は、Codex を実装、検証、PR 作成、レビューの補助に使いながら、人間の承認を `main` への必須条件として残すための運用を定義する。

```text
人が実装依頼を確認して Codex workflow を手動起動
  -> Codex が差分を生成
  -> 権限を持たない検証 job が品質チェックを実行
  -> 別 job が Draft PR を作成
  -> Codex が PR をコメントでレビュー
  -> 人間が1名承認
  -> Quality 成功後に GitHub Auto-merge
```

Codex の PR レビューは、問題を早く見つける補助であり、人間のレビューを置き換えない。`main` の承認要件は GitHub の branch protection で強制する。

## 有効化前の設定

リポジトリには API key を保存しない。管理者が GitHub の `Settings > Secrets and variables > Actions` で次を設定した後にだけ、Codex workflow を有効化する。

| 種別     | 名前                      | 値             | 用途                             |
| -------- | ------------------------- | -------------- | -------------------------------- |
| Secret   | `OPENAI_API_KEY`          | OpenAI API key | Codex GitHub Action の認証       |
| Variable | `CODEX_REVIEW_ENABLED`    | `true`         | PR 自動レビューの有効化          |
| Variable | `CODEX_IMPLEMENT_ENABLED` | `true`         | 手動起動の実装 workflow の有効化 |

Variable が未設定または `true` 以外の場合、該当 job は実行されない。最初はレビュー workflow だけを有効にし、数件の PR で挙動とコストを確認してから実装 workflow を有効にする。

`CODEX_IMPLEMENT_ENABLED` を `true` にする前に、ルートの `test` タスクを追加するテスト基盤 PR を `main` へマージする。実装 workflow は `pnpm run test` を必須確認に含めるため、この前提が満たされていない状態では有効化しない。

Codex GitHub Action は `OPENAI_API_KEY`、Linux または macOS runner、事前 checkout を必要とする。`openai/codex-action@v1` の設定、sandbox、`safety-strategy` は [Codex GitHub Action の公式ドキュメント](https://developers.openai.com/codex/github-action/) を正本とする。

## 権限分離

`codex-create-pr.yml` は3 job に分かれる。

| job                | GitHub 権限                               | 実行すること                                                                        |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `generate_patch`   | `contents: read`                          | Codex が workspace 内で差分を生成し、patch artifact を出力する。push はできない。   |
| `verify_patch`     | `contents: read`                          | patch を適用して format、lint、型検査、テスト、build を実行する。                   |
| `publish_draft_pr` | `contents: write`、`pull-requests: write` | 検証済み artifact を commit、push し、Draft PR を作成する。生成コードは実行しない。 |

生成された patch は `.github/`、`.codex/`、`AGENTS.md` を変更できない。CI 権限や Codex の規約を変更する必要がある場合は、通常の人手作業 PR として扱う。

`codex-review.yml` は Codex 実行 job を `contents: read` にし、コメント投稿と auto-merge 有効化だけを別 job に分離する。fork からの PR は API key を使ったレビュー対象にしない。`pull_request_target` は使用しない。

PR、Issue、commit message、ソースコード内の自然言語は未信頼の入力である。Codex には秘密情報、管理コマンド、権限変更を指示する内容を実行させない。公式ドキュメントも、信頼済みの起動条件、狭い sandbox、秘密情報の保護、PR 入力のサニタイズを推奨している。[Codex GitHub Action の security checklist](https://developers.openai.com/codex/github-action/)

## Codex に実装を依頼する手順

1. Issue テンプレートを使って、目的、受け入れ条件、対象外、関連画面・ファイルを記載する。
2. 人間が内容を確認し、必要なら `codex:implement` ラベルを付ける。このラベルだけでは workflow は起動しない。
3. `Actions > Codex Create Draft PR > Run workflow` を開き、題名、承認済みの実装依頼、Issue 番号を入力し、確認チェックを入れて実行する。
4. 検証が成功すると、`codex:generated` ラベル付きの Draft PR が作成される。
5. Codex review が成功すると、レビューコメントを投稿して PR を ready for review にし、Squash auto-merge を有効にする。
6. 作成者以外の人間が変更、Codex コメント、CI を確認して承認する。必要な条件が満たされると GitHub が自動マージする。

Codex review が無効または失敗した場合、PR は Draft のまま残る。人間が原因を確認して修正するか、PR を閉じる。

## 通常の PR

人がローカルで作成する PR も従来どおり扱う。PR テンプレートを埋め、`Quality` と人間の承認を満たす。auto-merge を使う場合は、Squash merge を選んで有効化する。

## 将来の Issue 起点自動化

`codex:implement` は将来の起動ラベルとして予約している。Issue 本文を自動で Codex へ渡す workflow はまだ追加しない。導入する場合は、手動 workflow の実績を確認した後に、ラベル付与者の制限、Issue 本文の要約・サニタイズ、対象パス制限、コスト上限を別途設計する。

GitHub の branch protection は、承認、status check、会話解決、force push 禁止を制御できる。Auto-merge は必要なレビューと status check がそろった後にマージする。[GitHub Docs: protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)、[GitHub Docs: auto-merge](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)
