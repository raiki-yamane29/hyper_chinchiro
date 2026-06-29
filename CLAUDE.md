# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**hyper-chinchiro** — チンチロ（日本の伝統的なサイコロ賭け事ゲーム）にユーザーごとの特殊能力を加えたリアルタイム対戦Webゲーム。

- プレイヤーはニックネームのみで参加（認証不要）
- 特殊能力はサーバーサイドでサイコロの確率ウェイトを変更する
- リポジトリ: `raiki-yamane29/hyper-chinchiro`

## Tech Stack

| 役割 | 技術 |
|---|---|
| フロントエンド | Next.js 16 App Router + TypeScript + Tailwind CSS |
| リアルタイム同期 | PartyKit（WebSocket + サーバーサイドゲームロジック） |
| デプロイ | Vercel（apps/web）+ PartyKit Cloud（party/） |

## Monorepo Structure

```
apps/web/   # Next.js フロントエンド
party/      # PartyKit サーバー（ゲームロジック + WebSocket）
```

## Commands

```bash
# 全ワークスペースの依存インストール
npm install

# ローカル開発（両方同時起動）
npm run dev            # concurrently で apps/web + party を起動

# 個別起動
npm run dev -w apps/web   # Next.js のみ
npm run dev -w party      # PartyKit のみ (localhost:1999)

# ビルド
npm run build          # Next.js ビルド

# デプロイ
npx partykit deploy    # party/ を PartyKit Cloud へ
# vercel deploy は Vercel CLI または GitHub連携で行う
```

## Environment Variables

```
# apps/web/.env.local
NEXT_PUBLIC_PARTYKIT_HOST=<partykit-host>   # ローカル: localhost:1999
```

## Architecture

### 責務分担

**PartyKit (`party/src/`)**: ゲーム状態の単一真実源。サイコロ確率計算（能力効果含む）、役判定、フェーズ遷移、全クライアントへのブロードキャスト。チート防止のため確率計算は必ずサーバーで行う。

**Next.js (`apps/web/src/`)**: UIレンダリング、WebSocket接続管理、ユーザーアクション送信、アニメーション。

### ゲームフェーズ

```
lobby → ability_select → banker_turn → player_turn → round_result → (次ラウンド or game_over)
```

### 役の強さ（handValue）

| 役 | handValue |
|---|---|
| 456 | 1000 |
| ゾロ目（nnn） | 100 + n |
| 目（nnm） | 10*n + m |
| 役なし | 0（振り直し） |
| 123 | -1 |

### 特殊能力

サイコロは `DiceWeights = [w1,w2,w3,w4,w5,w6]` で確率を制御。8種類の能力を定義（`party/src/gameLogic/abilities.ts`）。

### Room ID

`nanoid()` で8文字のIDを生成し `/room/[roomId]` にルーティング。PartyKitのroomIdと1対1対応。

## Key Files

- `party/src/server.ts` — PartyServerメインクラス
- `party/src/gameLogic/stateMachine.ts` — フェーズ遷移
- `party/src/gameLogic/abilities.ts` — 能力定義・確率ウェイト
- `apps/web/src/hooks/useGameState.ts` — ゲーム状態購読（全UIが依存）
- `apps/web/src/types/game.ts` — 共有型定義（party/src/types/game.ts と同一内容を維持）
