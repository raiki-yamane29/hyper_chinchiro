# syuusei.md 実装計画（実装担当AI向けの詳細仕様）

syuusei.md の11項目を実装するための具体的な計画。**Step順に実装し、各Stepごとにテスト・ビルドを通してからコミットすること。**

## 前提知識

- モノレポ構成: `apps/web/`（Next.js 16 + Tailwind v4）と `party/`（partyserver + Cloudflare Workers）
- ゲームロジックの本体は `party/src/gameLogic/stateMachine.ts` の `applyMessage`（純粋関数）。サーバー `party/src/server.ts` はメッセージを `applyMessage` に渡してブロードキャストするだけ
- 型定義は `party/src/types/game.ts` と `apps/web/src/types/game.ts` に**同一内容が二重管理**されている（Step 0 で解消する。それまで両方を同時に更新すること）
- 検証コマンド:
  - `npm run test -w party` （vitest。既存39件を壊さないこと）
  - `cd party && npx tsc --noEmit`
  - `npm run build`（ルートで実行。Next.jsビルド＋型チェック）
- 手動検証: `npm run dev` で両方起動 → `http://localhost:3000/debug-7f3xk2p9qz`（検証コンソール。ダミープレイヤー追加・出目固定・能力変更ができる）
- サーバー側（party/）を変更したら最後に `cd party && npx wrangler deploy`、フロントは git push で Vercel が自動デプロイ
- UIテキストは日本語。コミットメッセージは既存スタイルに合わせる（`feat:` / `fix:` / `test:` 等、本文日本語可）
- **精算のゼロサム不変条件を絶対に壊さない**: どの倍率（役・賭け金・ギャンブラー）も親と子の増減を同率で掛けること

---

## Step 0: 共有型パッケージ化（syuusei #18: 型定義の二重管理）

**最初にやる**（以降のStepの型変更が一箇所で済むため）。

1. `packages/shared/` を新規作成:
   - `packages/shared/package.json`:
     ```json
     {
       "name": "@hyper-chinchiro/shared",
       "version": "0.0.1",
       "private": true,
       "type": "module",
       "exports": { ".": "./src/game.ts" }
     }
     ```
     TSソースを直接exportする（ビルド不要。wrangler / vitest はTSを直接扱え、Next.jsは transpilePackages で対応）
   - `packages/shared/src/game.ts`: 現在の `party/src/types/game.ts` の内容を丸ごと移動（`DEBUG_KEY` 定数含む）
2. ルート `package.json` の workspaces に `"packages/*"` を追加
3. `apps/web/package.json` と `party/package.json` の dependencies に `"@hyper-chinchiro/shared": "*"` を追加して `npm install`
4. `apps/web/next.config.ts` に `transpilePackages: ["@hyper-chinchiro/shared"]` を追加
5. 既存の2つの型ファイルは**1行の再エクスポートに置き換える**（import文の書き換えを最小化するため）:
   - `party/src/types/game.ts` → `export * from "@hyper-chinchiro/shared";`
   - `apps/web/src/types/game.ts` → `export * from "@hyper-chinchiro/shared";`
6. さらに能力メタデータの重複も解消する: `packages/shared/src/game.ts` に追加:
   ```ts
   export interface AbilityInfo { id: string; name: string; description: string }
   export const ABILITY_INFO: AbilityInfo[] = [ /* 13能力のid/名前/説明 */ ];
   ```
   内容は `apps/web/src/components/lobby/AbilitySelector.tsx` の `abilities` 配列を正とする（ラッキーワン〜ダブルチャンスの13種）。
   - `AbilitySelector.tsx` の `abilities` を `ABILITY_INFO` のimportに置き換え（既存のexportは互換のため `export const abilities = ABILITY_INFO` として残す）
   - `GameBoard.tsx` / `PlayerList.tsx` / `debug-7f3xk2p9qz/page.tsx` の `abilityNames` マップを `ABILITY_INFO` から生成するよう置き換え
   - `party/src/gameLogic/abilities.ts` の name/description は `ABILITY_INFO` を参照する形にしてもよいが、`applyWeights`/`rarityWeight`/`isActive` はサーバー専用なので party 側に残すこと

**検証**: 3コマンド全部通ること。ブラウザでロビー・ルーム・検証コンソールが表示されること。

---

## Step 1: 賭け金制（syuusei #16）

**確定済み設計**: 賭け金1〜3ptを子が選択。**脱落なし・持ち点制なし**（マイナス無制限のまま）。

### サーバー（型は packages/shared を変更）

1. `GameState` に `bets: Record<string, number>` を追加（playerId → 1|2|3）。`createInitialState` で `{}`、`resetRound` で `{}` にリセット、`removePlayer` で該当エントリ削除、`markRematchReady`/`returnToLobby` でも `{}`
2. `ClientMessage` に `| { type: "set_bet"; amount: number }` を追加
3. `stateMachine.ts` の `applyMessage` に `set_bet` ハンドラを追加。受理条件（すべて満たす場合のみ）:
   - `phase === "player_turn"` かつ送信者が現在の手番プレイヤー（`state.players[state.currentPlayerIndex].id === senderId`）
   - まだ振っていない（`(state.rollCountMap[senderId] ?? 0) === 0`）
   - `amount` が整数で 1〜3
   - 親は賭けない（player_turn の手番＝子なので上記条件で自然に除外される）
4. 精算への反映: `applyGamblerMultiplier` と同様の**exportされた純粋関数**を追加:
   ```ts
   export function applyBetMultiplier(settlement: RoundSettlement, bet: number): RoundSettlement
   ```
   - `bet <= 1` ならそのまま返す
   - それ以外は `points` / `bankerDelta` / `playerDelta` を bet 倍し、`reason` に `` `賭け${bet}pt × ` `` を**先頭に**付ける
   - `finishRound` 内で `const bet = state.bets[player.id] ?? 1;` を取り、`createSettlement` の結果に `applyBetMultiplier` → `applyGamblerMultiplier` の順で適用（順序はどちらでも数値は同じだが、reason の読みやすさのためこの順とする）

### フロント

5. `GameBoard.tsx` の `ActionBar`: 自分が子で手番、かつ初回ロール前（`rollCountMap[self.id] === 0`）のとき、「振る」ボタンの左に賭け金トグル `[1pt] [2pt] [3pt]` を表示。選択中の値をハイライト。クリックで `send({ type: "set_bet", amount })`。現在値は `state.bets[self.id] ?? 1` を表示に使う（ローカルstateではなくサーバーstateを正とする）
   - ActionBar に `onSetBet: (amount: number) => void` と必要なstateをpropsで渡す。`RoomClient.tsx` で `send` に配線
6. `RollPanel`（GameBoard内）: 子のパネルに賭け金表示「賭け: 2pt」（`state.bets[player.id]` があるときのみ）
7. 精算表示は `reason` に倍率内訳が入るので既存のまま動く

### テスト（`party/src/gameLogic/settlement.test.ts` に追加 or 新ファイル `bet.test.ts`）

- `applyBetMultiplier`: bet=1で不変 / bet=3で3倍・ゼロサム維持 / reason に「賭け3pt」が含まれる
- `applyMessage` 経由: set_bet 受理 → `state.bets` に反映。拒否ケース: 手番でない / ロール後 / amount=0や4 / phase違い
- 賭け2pt + ゾロ目勝ち(3倍) + ギャンブラー(2倍) = 12pt の複合ケース（`debug_set_next_roll` で出目を固定すれば決定的にテストできる）

---

## Step 2: ラウンド数を人数連動に（syuusei #15）

**確定済み設計**: ルーム作成時の設定（能力モードと同じ場所）で「人数×1 / ×2 / ×3」を選択。デフォルト×1（全員が親を等しい回数やる）。

### サーバー

1. `GameState` に `roundsPerPlayer: number` を追加（`createInitialState` で `1`）
2. `join` メッセージに `roundsPerPlayer?: number` を追加。`joinGame` で **lobbyフェーズのときのみ**採用（`abilityMode` と同じ扱い。1〜3の整数のみ受理、それ以外は無視）
3. ゲーム開始時に `maxRounds` を確定: `markReady` の全員Ready分岐（`resetRound({...state, players, phase: "player_turn"})` している箇所）で `maxRounds: players.length * state.roundsPerPlayer` を追加。再戦時も `markRematchReady` → ability_select → 同じ分岐を通るので、この一箇所で人数変動にも追従する

### フロント

4. `RoomClient.tsx` の参加フォーム: 能力モードのfieldsetの隣に「ラウンド数」select（`人数×1（全員が親を1回）` / `人数×2` / `人数×3`）。`isLobbyPhase` でないときは disabled（能力モードと同じ制御）。join送信時に `roundsPerPlayer` を含める。ルームに既に人がいる場合はサーバーstateの値を表示

### テスト

- 3人 × roundsPerPlayer=1 で開始 → `maxRounds === 3`、3ラウンドで game_over
- 2人 × roundsPerPlayer=2 → `maxRounds === 4`
- lobby以外での roundsPerPlayer 指定は無視される

---

## Step 3: 切断復帰の猶予60秒（syuusei #2）

**確定済み設計**: 猶予60秒。

### 前提の仕組み

partysocket は同一インスタンスの自動再接続では同じ接続ID（`_pk`）を使うが、**ページリロードでは新しいIDになる**。リロード復帰を成立させるため、クライアント側でIDを sessionStorage に永続化して `PartySocket` の `id` オプションに渡す。

### フロント

1. `apps/web/src/hooks/usePartySocket.ts`: 接続前に per-room のIDを用意:
   ```ts
   const storageKey = `hyper-chinchiro-pk:${roomId}`;
   let pk = sessionStorage.getItem(storageKey);
   if (!pk) { pk = nanoid(); sessionStorage.setItem(storageKey, pk); }
   // new PartySocket({ host, party, room: roomId, id: pk })
   ```
   SSRガード（`typeof window !== "undefined"`）に注意。useEffect内なら不要

### サーバー

2. `Player` に `connected: boolean` を追加（join時 true）。`stateMachine.ts` に純粋関数を追加:
   - `export function setPlayerConnected(state, playerId, connected): GameState`（該当playerのフラグ更新。playerが居なければそのまま返す）
3. `party/src/server.ts` を変更:
   - クラスに `private removalTimers = new Map<string, ReturnType<typeof setTimeout>>();` を追加
   - `onClose(conn)`: 即 `removePlayer` するのを**やめて**、`setPlayerConnected(state, conn.id, false)` + broadcast。その後 `setTimeout` で60秒後に `removePlayer` + broadcast（タイマーをMapに保存。発火時にMapから削除）
   - `onConnect(conn)`: 既存プレイヤー（`state.players` に conn.id がいる）なら保留タイマーを `clearTimeout` してMapから削除し、`setPlayerConnected(..., true)` + 全員にbroadcast。従来どおり本人に state_update を送る
   - 注意: DOがメモリから退避されるとタイマーも消えるが、その場合state自体が消える（既知の仕様、KAIZEN #3）ので許容
4. `GRACE_PERIOD_MS = 60_000` は server.ts の定数にする

### フロント（表示）

5. `PlayerList.tsx`: `player.connected === false` のとき「切断中」バッジ（黄色系）
6. `GameBoard.tsx` の `ActionBar`: 手番プレイヤーが切断中なら statusText を「〇〇（切断中）の復帰を待っています…」に

### テスト

- `setPlayerConnected` の単体テスト（フラグ変更・存在しないIDで不変）
- 手動E2E: 検証コンソールでルーム作成 → 別タブでプレイヤー参加 → タブをリロード → 同じプレイヤーとして復帰しゲーム継続できること（60秒以内）。60秒放置で除外されること

---

## Step 4: 残り振り直し回数の表示（syuusei #5）

サーバー変更なし（`rollCountMap` は既にstateにある）。

1. `GameBoard.tsx`: 残回数を計算するヘルパーを追加:
   ```ts
   const maxRolls = effectiveAbilityId === "double_chance" ? 4 : 3;
   const remaining = maxRolls - (state.rollCountMap[self.id] ?? 0);
   ```
   （`DEFAULT_MAX_ROLLS = 3`、ダブルチャンスは+1。party/src/gameLogic/stateMachine.ts の `getMaxRolls` と同じ値にすること）
2. ActionBar の「振る」ラベルを `振る（あと${remaining}回）` に。remaining が 1 のときは「振る（ラスト）」
3. `RollPanel` の役表示横に、役なしで振り直し可のとき「振り直し可（あと n 回）」と回数を出す（HandResult に残回数をpropsで渡すか、RollPanel側で併記）

---

## Step 5: ラウンド履歴（syuusei #6）

### サーバー

1. 共有型に追加:
   ```ts
   export interface RoundHistoryEntry {
     round: number;
     bankerId: string;
     nicknames: Record<string, string>;   // そのラウンド時点の playerId → ニックネーム
     rolls: Record<string, RollResult>;   // 親含む全員の確定ロール（親は bankerRoll）
     settlements: Record<string, RoundSettlement>;
   }
   ```
   `GameState` に `history: RoundHistoryEntry[]` を追加
2. `finishRound` の末尾で history に1件append（bankerRoll を rolls[bankerId] に含める）。`createInitialState` で `[]`、`markRematchReady` と `returnToLobby` で `[]` にリセット。**resetRound ではリセットしない**（ゲーム中は蓄積）

### フロント

3. 新コンポーネント `apps/web/src/components/game/RoundHistory.tsx`:
   - `state.history` が空なら非表示
   - `<details>` で折りたたみ（summary: 「ラウンド履歴 (n)」）
   - 各ラウンド: 「R1 親:〇〇」+ 各プレイヤーの出目と役 + ポイント移動（+n/-n を色付きで。検証コンソールの `DeltaBadge` 相当の表示。共通化してもよい）
4. `RoomClient.tsx` の PlayerList の下（右カラム）に配置

### テスト

- 2人でNラウンド完走 → `history.length === N`、各entryに全員のロールと精算が入っている
- 再戦（rematch）で history が空になる

---

## Step 6: ゲーム終了演出（syuusei #7）

サーバー変更なし。

1. 新コンポーネント `apps/web/src/components/game/GameResult.tsx`:
   - `phase === "game_over"` のとき GameBoard の RollPanel 群の**上**に表示
   - スコア降順で順位表（同点は同順位）。1位は `👑` + 大きめ文字 + 金色系ボーダー、2位以下は通常行
   - CSSアニメーション: 順位表全体を `@keyframes` で下からフェードイン、1位に `scale` のポップ演出（Tailwindの `animate-[...]` 記法。globals.css にkeyframes追加）
2. ActionBar の「再戦 Ready」「能力モードに戻る」は既存のまま（この画面と共存）

---

## Step 7: ルール説明モーダル（syuusei #8）

サーバー変更なし。

1. 新コンポーネント `apps/web/src/components/ui/RulesModal.tsx`（`useState` で開閉、`<dialog>` か固定オーバーレイ）
2. `RoomClient.tsx` のヘッダー（Room IDカードの隣）に「ルール」ボタンを追加して開く
3. 内容（タブか縦並びセクション）:
   - **遊び方**: 親と子が3個のサイコロを振り役の強さで勝負。役なしは最大3回まで振り直し。子は振る前に賭け金1〜3ptを選ぶ。ラウンドごとに親が交代
   - **役の強さと倍率**（強い順の表）:
     | 役 | 出目 | 倍率 |
     |---|---|---|
     | ピンゾロ | 1,1,1 | 5倍 |
     | ゾロ目 | 同じ目3つ（6>5>4>3>2） | 3倍 |
     | シゴロ | 4,5,6 | 2倍 |
     | 目 | ペア+1個（余りの目で勝負、6>…>1） | 1倍 |
     | 役なし | 上記以外 | 振り直し |
     | ヒフミ | 1,2,3 | 負け・相手が2倍獲得 |
   - 倍率は乗算（例: ゾロ目勝ち×相手ヒフミ=6倍、さらに賭け金・ギャンブラーも乗算）
   - 同値の役は親の勝ち
   - **能力一覧**: `ABILITY_INFO`（Step 0の共有データ）から自動生成

---

## Step 8: サイコロのピップ表示（syuusei #9）

サーバー変更なし。`apps/web/src/components/game/DiceDisplay.tsx` を書き換え。

1. 数字テキストをやめ、CSSでサイコロの目（ドット）を描画:
   ```tsx
   const PIP_LAYOUT: Record<number, number[]> = {
     1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
   }; // 3x3グリッド（0〜8）のどこにドットを置くか
   ```
   各ダイスは `grid grid-cols-3 grid-rows-3` の `size-14` の白い角丸ボックス。該当セルに `rounded-full bg-stone-900` のドット（1の目だけ `bg-red-600` にすると和サイコロらしい）
2. `dice === null`（未ロール）は「?」表示のグレーボックス
3. アニメーション強化: `rolling` 中は `@keyframes dice-tumble`（rotate ±20deg + translateY を数回、0.6s）に差し替え、終了時に軽い `scale(1.1)→1` のバウンス。globals.css の既存 `dice-wobble` keyframes を確認して置き換え/追加
4. 検証コンソールでは DiceDisplay を使っていないので影響なし

---

## Step 9: ランダムモードの能力発表演出（syuusei #10）

サーバー変更なし（`currentTurnAbilityMap` は手番開始時に既にセットされる）。

1. `GameBoard.tsx` に発表バナーを追加:
   - `useEffect` で「手番プレイヤーのID + そのターン能力」の組を監視（`state.abilityMode === "random_turn"` のときのみ）
   - 組が変わったら `announcement = { nickname, abilityName, abilityDescription }` をローカルstateにセットし、2.5秒後にクリア（setTimeout。クリーンアップ必須）
   - 表示: 画面中央上部に固定のカード（`fixed top-16 inset-x-0 mx-auto w-fit z-50`）。「〇〇の能力: シゴロ賽」+ 説明1行。フェードイン→アウトのCSSアニメーション
   - 全員に見せる（能力は既にRollPanelで公開情報のため）
2. 自分の手番のときは文言を「あなたの能力: 〜」にする

---

## Step 10: 結合テスト（syuusei #19）

新ファイル `party/src/gameLogic/scenario.test.ts`。`applyMessage` を直接呼ぶ（サーバー不要・決定的にするため **`debug_set_next_roll` で出目を固定**する。`DEBUG_KEY` は `@hyper-chinchiro/shared` からimport）。

必須シナリオ:

1. **フルゲーム**: 3人join（selected固定・roundsPerPlayer=1）→ 全員ready → maxRounds=3を確認 → 各ラウンド: 出目を固定して子2人→親の順に振る → round_result → next_round → 親が順番に交代することを確認 → 3ラウンド後 game_over → スコアの合計が常に0（ゼロサム）
2. **賭け金シナリオ**: 子が set_bet(3) → 子[6,6,6]・親[2,5,5]を固定 → 子の獲得が 3(ゾロ目)×3(賭け) = 9pt、親が -9pt
3. **再戦シナリオ**: game_over → 全員 ready → ability_select に戻り、scores/history/bets が初期化される
4. **切断シナリオ**: ゲーム中に `setPlayerConnected(state, id, false)` → connected false。`removePlayer` → プレイヤー削除・2人未満なら lobby へ
5. **復帰リグレッション**: ゲーム中の `join`（既存ID・同ニックネーム）で phase が変わらないこと

---

## 実装順序とコミットの目安

| Step | コミットメッセージ例 |
|---|---|
| 0 | `refactor: extract shared types package` |
| 1 | `feat: add bet selection (1-3pt) for children` |
| 2 | `feat: scale round count with player count` |
| 3 | `feat: 60s reconnect grace period` |
| 4 | `feat: show remaining reroll count` |
| 5 | `feat: add round history log` |
| 6 | `feat: add game over ranking screen` |
| 7 | `feat: add in-game rules modal` |
| 8 | `feat: render dice with pips and better animation` |
| 9 | `feat: announce random ability at turn start` |
| 10 | `test: add full-game scenario tests` |

## 最終チェックリスト

- [ ] `npm run test -w party` 全件パス（既存39件＋新規）
- [ ] `cd party && npx tsc --noEmit` / `npm run build` 成功
- [ ] 検証コンソール（/debug-7f3xk2p9qz）でダミー3人のフルゲームが完走できる
- [ ] リロードして60秒以内に同じプレイヤーとして復帰できる
- [ ] ゼロサム: どのラウンドでも全員のスコア合計が0
- [ ] サーバーデプロイ: `cd party && npx wrangler deploy`
- [ ] `git push`（Vercelが自動デプロイ）

## やってはいけないこと

- 型を `party/src/types/game.ts` と `apps/web/src/types/game.ts` に個別追加すること（Step 0以降は必ず `packages/shared/src/game.ts` に追加）
- 精算で片側だけに倍率をかけること（ゼロサム崩壊。過去に実際に起きたバグ）
- `DEBUG_KEY` の値やデバッグページのパスを変更すること
- 既存のメッセージ型・フィールドの削除やリネーム（後方互換を保つ）
