# hyper-chinchiro 実装計画

チンチロ（日本の伝統的なサイコロ賭け事ゲーム）にユーザーごとの特殊能力を加えたリアルタイム対戦Webゲーム。

---

## 現在の状態（Phase 0 完了済み）

以下はセットアップ済み・手を加えないこと：

```
hyper-chinchiro/
├── package.json              # npm workspaces モノレポ（concurrently で両方起動）
├── apps/web/                 # Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
│   ├── package.json          # partysocket, nanoid インストール済み
│   └── src/app/              # デフォルトページのみ（これから実装）
└── party/                    # PartyKit サーバー
    ├── partykit.json
    └── src/server.ts         # スタブのみ（これから実装）
```

ローカル起動コマンド：
```bash
npm run dev         # apps/web (localhost:3000) + party (localhost:1999) を同時起動
```

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド | Next.js 16 App Router + TypeScript + Tailwind CSS v4 |
| リアルタイム同期 | PartyKit（WebSocket + サーバーサイドゲームロジック） |
| デプロイ | Vercel（apps/web）+ Cloudflare Workers（party/） |

---

## ゲーム仕様

### チンチロのルール
- サイコロ3個を振る。最大3回まで振り直し可（役なしの場合）
- 親（バンカー）と子（プレイヤー）が順番に振り、役の強さで勝敗を決める
- スコアはポイント制（親が勝った場合：子から各-1pt、親+n pt / 子が勝った場合：子+2pt、親-1pt）

### 役の強さ（handValue で数値化）

| 役 | 条件 | handValue | 精算倍率 |
|---|---|---|---|
| ピンゾロ | [1,1,1] | 2000（最強） | 5倍 |
| ゾロ目 | [n,n,n] n≧2 | 1000 + n | 3倍 |
| 456 | [4,5,6] | 500 | 2倍 |
| 目（ひふみ以外） | [n,n,m] ペア+1個 | m（余った1個が「目」。ペアの数字は無関係） | 1倍 |
| 役なし | 上記以外 | 0（振り直し） | - |
| 123 | [1,2,3] | -1（強制負け） | 相手が2倍獲得 |

倍率は乗算する（ゾロ目勝ち×相手ヒフミ = 6倍、ピンゾロ勝ち×相手ヒフミ = 10倍）。

### ゲームフェーズ

```
lobby → ability_select → banker_turn → player_turn → round_result → (次ラウンド or game_over)
```

- **lobby**: プレイヤーがニックネームを入力してルームに参加
- **ability_select**: 各プレイヤーが特殊能力を1つ選択し `ready` を送信
- **banker_turn**: 親がサイコロを振る（最大3回）
- **player_turn**: 子が順番にサイコロを振る（最大3回、`currentPlayerIndex` で管理）
- **round_result**: 勝敗判定・スコア更新・次ラウンドまたはゲーム終了
- **game_over**: 最大5ラウンド終了

---

## 共有型定義（`party/src/types/game.ts` と `apps/web/src/types/game.ts` は同一内容）

```typescript
export type GamePhase =
  | 'lobby'
  | 'ability_select'
  | 'banker_turn'
  | 'player_turn'
  | 'round_result'
  | 'game_over';

export type HandType = '456' | 'trips' | 'pair' | '123' | 'nothing';

export interface RollResult {
  dice: [number, number, number];
  hand: HandType;
  handValue: number;
  isValid: boolean; // false = 役なし = 振り直し必要
}

export interface Player {
  id: string;
  nickname: string;
  abilityId: string;
  abilityUsedThisRound: boolean;
  isReady: boolean;
}

export interface GameState {
  phase: GamePhase;
  roomId: string;
  players: Player[];
  bankerIndex: number;
  currentPlayerIndex: number;
  bankerRoll: RollResult | null;
  playerRolls: Record<string, RollResult>;
  scores: Record<string, number>;
  round: number;
  maxRounds: number; // 5
  rollCountMap: Record<string, number>;
}

// Client → Server
export type ClientMessage =
  | { type: 'join'; nickname: string; abilityId: string }
  | { type: 'ready' }
  | { type: 'roll' }
  | { type: 'use_active_ability'; payload: { pinnedValue: number } }
  | { type: 'next_round' };

// Server → Client
export type ServerMessage =
  | { type: 'state_update'; state: GameState }
  | { type: 'roll_result'; playerId: string; result: RollResult }
  | { type: 'error'; message: string };
```

---

## 特殊能力仕様

サイコロの確率は `DiceWeights = [w1,w2,w3,w4,w5,w6]`（各目1〜6のウェイト）で制御。
正規化して確率に変換する。**確率計算は必ず PartyKit サーバー側で行うこと（チート防止）。**

```typescript
// party/src/gameLogic/abilities.ts
export type DiceWeights = [number, number, number, number, number, number];

export interface Ability {
  id: string;
  name: string;
  description: string;
  isActive: boolean; // true = 手動発動
  applyWeights: (base: DiceWeights, ctx: AbilityContext) => DiceWeights;
}

export interface AbilityContext {
  previousDice?: [number, number, number]; // ミラーロール用
  rollCount: number;
  abilityUsedThisRound: boolean;
  pinnedDiceValue?: number; // 神の一手用
}
```

| id | 名前 | 効果 | isActive |
|---|---|---|---|
| `trickster` | イカサマ師 | 2のウェイトを3倍 | false |
| `lucky_six` | ラッキーシックス | 6のウェイトを3倍 | false |
| `all_high` | オールフォア | 4・5・6のウェイトを各2倍 | false |
| `no_one` | ピンゾロ封じ | 1のウェイトを0.2倍 | false |
| `chaos` | カオスダイス | 毎回ランダムなウェイトを生成 | false |
| `mirror` | ミラーロール | 直前の相手の出目のウェイトを+2 | false |
| `godhand` | 神の一手 | 1ラウンド1回、サイコロ1個を任意の目に固定 | **true** |
| `double_chance` | ダブルチャンス | 役なし時の振り直し上限+1回 | false |

ウェイト付きサイコロの実装例：
```typescript
function rollWithWeights(weights: DiceWeights): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < 6; i++) {
    rand -= weights[i];
    if (rand <= 0) return i + 1;
  }
  return 6;
}
```

---

## 実装タスク（未着手）

### Phase 1: PartyKit ゲームロジック

実装順：

1. **`party/src/types/game.ts`** — 上記の型定義をそのまま実装

2. **`party/src/gameLogic/handEvaluator.ts`** — 役判定の純粋関数
   - `evaluateHand(dice: [number, number, number]): RollResult`

3. **`party/src/gameLogic/diceRoller.ts`** — ウェイト付きサイコロ
   - `rollWithWeights(weights: DiceWeights): number`
   - `rollThreeDice(weights: DiceWeights): [number, number, number]`

4. **`party/src/gameLogic/abilities.ts`** — 能力定義8種 + ウェイト適用関数

5. **`party/src/gameLogic/stateMachine.ts`** — フェーズ遷移ロジック
   - `applyMessage(state: GameState, msg: ClientMessage, senderId: string): GameState`

6. **`party/src/server.ts`** — PartyServer 本実装（既存スタブを置き換え）
   - `onConnect`: 現在のstateを新規接続に送信
   - `onMessage`: `ClientMessage` をパースして `stateMachine.applyMessage` に渡し、結果を全員にブロードキャスト
   - `onClose`: プレイヤー除去

### Phase 2: Next.js フロントエンド基盤

1. **`apps/web/src/types/game.ts`** — `party/src/types/game.ts` と同一内容をコピー

2. **`apps/web/src/hooks/usePartySocket.ts`** — `partysocket` を使った WebSocket 接続
   - 環境変数 `NEXT_PUBLIC_PARTYKIT_HOST` を参照（ローカル: `localhost:1999`）

3. **`apps/web/src/hooks/useGameState.ts`** — `ServerMessage` を受信してReact stateに反映

4. **`apps/web/src/app/page.tsx`** — ロビー画面
   - ニックネーム入力
   - 新規ルーム作成（`nanoid(8)` でroomId生成 → `/room/[roomId]` にリダイレクト）
   - 既存ルーム参加（roomId入力）

5. **`apps/web/src/app/room/[roomId]/page.tsx`** — ゲームルーム（フェーズに応じてコンポーネント切り替え）

### Phase 3: ゲームUI コンポーネント

- `apps/web/src/components/lobby/AbilitySelector.tsx` — 能力選択（8種のカード表示）
- `apps/web/src/components/game/DiceDisplay.tsx` — サイコロ表示（CSSアニメーション付き）
- `apps/web/src/components/game/PlayerList.tsx` — プレイヤー一覧・スコア
- `apps/web/src/components/game/HandResult.tsx` — 役名・勝敗表示
- `apps/web/src/components/game/GameBoard.tsx` — フェーズ別のメイン画面

### Phase 4: ポリッシュ

- 神の一手の発動UI（目を選ぶモーダル）
- サイコロのアニメーション（`roll_result` メッセージ受信時にトリガー）
- モバイル対応レイアウト
- プレイヤー切断時の処理

---

## 環境変数

```bash
# apps/web/.env.local
NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999   # ローカル開発時
# 本番は wrangler deploy 後に表示される workers.dev のホスト名を設定
```

---

## デプロイ

> 旧 `partykit` CLI はデプロイ不可（PartyKit Cloud のドメイン上限＋無料プランの
> `new_sqlite_classes` 要件に未対応）。サーバーは `partyserver` + `wrangler` で運用する。

```bash
# ゲームサーバー（Cloudflare Workers、party/ から実行）
npx wrangler deploy   # Cloudflareアカウントへのログインが必要（npx wrangler login）

# Next.js（Vercel）
# GitHub（raiki-yamane29/hyper_chinchiro）連携で自動デプロイ
# Vercel の環境変数 NEXT_PUBLIC_PARTYKIT_HOST に workers.dev ホストを設定すること
```

---

## 検証方法

1. `npm run dev` で両方起動
2. ブラウザで2タブ開き、同じ `/room/[roomId]` URLにアクセス
3. 2人分のニックネーム・能力を設定してゲーム開始
4. サイコロの偏りで能力の効果を確認
