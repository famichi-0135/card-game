# ドキュメント

## Frontend

- [対戦画面 UI 要件](./frontend/game-board-ui-requirements.md): 盤面、D&D操作、公開情報、再同期の詳細要件。
- [フロントエンド要件定義](./frontend/frontend-requirements.md): 対戦画面を含む周辺画面、対応環境、品質・テスト要件。
- [フロントエンド連携の実装計画](./frontend/frontend-integration-plan.md): 実装前の契約ゲート、責務別の変更判断、PR 分割。

## Backend

- [クライアント・サーバー通信境界](./backend/client-server-protocol.md): ゲーム操作、公開状態、再接続時の通信契約。
- [データベース・認証基盤](./backend/database-and-auth.md): D1、Drizzle、Better Auth の責務、生成・移行手順。
- [Durable Object 対戦ルーム](./backend/durable-object-room.md): 対戦状態・期限・公開イベントの責務。
- [対戦待機・開始の設計](./backend/matchmaking.md): 対戦部屋、デッキ選択、開始処理の責務。

## Environment

- [開発環境構築ガイド](./environment/development-environment.md): 必要なツール、初回セットアップ、ローカル起動、D1・認証・Cloudflare の設定手順。
- [チーム開発ガイド](./environment/team-development.md): Git と GitHub を初めて使うチーム向けの開発手順、ブランチ戦略、プルリクエスト運用。
- [AI 開発運用ガイド](./environment/ai-development.md): Codex の実装・レビュー補助と、人間の承認を残す GitHub Actions 運用。

## Game

- [基本ゲームルール定義書](./game/rule-definition.md): 対戦の基本ルールと用語。
- [カード種別定義書](./game/card-type-definition.md): カード種別と記述上の規約。
- [ゲームエンジン仕様書](./game/gameEngine-definition.md): ゲーム状態、コマンド、状態遷移の仕様。

- [プロジェクト概要](../README.md): ワークスペース構成、必要な環境、開発コマンド。

このフォルダの文書は、チームの合意事項が変わった時点で更新します。実際の運用と文書が異なる場合は、先にチームで合意してから両方をそろえてください。
