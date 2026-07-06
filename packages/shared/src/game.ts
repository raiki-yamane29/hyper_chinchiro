export type GamePhase =
  | "lobby"
  | "ability_select"
  | "banker_max_bet"
  | "betting"
  | "banker_turn"
  | "player_turn"
  | "round_result"
  | "game_over";

export type HandType = "456" | "trips" | "pair" | "123" | "nothing";
export type AbilityMode = "selected" | "random_turn";

export interface RollResult {
  dice: [number, number, number];
  hand: HandType;
  handValue: number;
  isValid: boolean;
}

export interface RoundSettlement {
  bankerId: string;
  playerId: string;
  winnerId: string;
  bankerDelta: number;
  playerDelta: number;
  points: number;
  reason: string;
}

export interface RoundHistoryEntry {
  round: number;
  bankerId: string;
  nicknames: Record<string, string>;
  rolls: Record<string, RollResult>;
  settlements: Record<string, RoundSettlement>;
}

export interface Player {
  id: string;
  nickname: string;
  abilityId: string;
  abilityUsedThisRound: boolean;
  isReady: boolean;
  connected: boolean;
}

export interface GameState {
  phase: GamePhase;
  roomId: string;
  abilityMode: AbilityMode;
  roundsPerPlayer: number;
  players: Player[];
  bankerIndex: number;
  currentPlayerIndex: number;
  bankerRoll: RollResult | null;
  playerRolls: Record<string, RollResult>;
  roundSettlements: Record<string, RoundSettlement>;
  scores: Record<string, number>;
  bets: Record<string, number>;
  /** ランダムモードで親がそのラウンドに宣言した賭けの上限（子はこの範囲内で賭ける） */
  maxBet: number | null;
  /** ランダムモードで賭け確定後に決まる、賭けの低い順の子の振る順（親を除く） */
  turnOrder: string[];
  round: number;
  maxRounds: number;
  rollCountMap: Record<string, number>;
  currentTurnAbilityMap: Record<string, string>;
  history: RoundHistoryEntry[];
  /** デバッグ用: 次のロールで強制する出目（playerId → dice） */
  debugNextRolls: Record<string, [number, number, number]>;
}

// デバッグページ/メッセージの共有シークレット（リンクを知らない人の操作を防ぐ）
export const DEBUG_KEY = "hyper-debug-7f3xk2p9qz";

export interface AbilityInfo {
  id: string;
  name: string;
  description: string;
}

export const ABILITY_INFO: AbilityInfo[] = [
  { id: "lucky_one", name: "ラッキーワン", description: "1の出目が出やすくなります。" },
  { id: "trickster", name: "ラッキーツー", description: "2の出目が出やすくなります。" },
  { id: "lucky_three", name: "ラッキースリー", description: "3の出目が出やすくなります。" },
  { id: "lucky_four", name: "ラッキーフォー", description: "4の出目が出やすくなります。" },
  { id: "lucky_five", name: "ラッキーファイブ", description: "5の出目が出やすくなります。" },
  { id: "lucky_six", name: "ラッキーシックス", description: "6の出目が出やすくなります。" },
  { id: "no_one", name: "ピンゾロ封じ", description: "1の出目を抑えて、ピンゾロやヒフミに寄りにくくします。" },
  { id: "chaos", name: "カオスダイス", description: "手番ごとにサイコロの重みがランダムに変わります。" },
  { id: "shigoro", name: "シゴロ賽", description: "4・5・6の目しか出なくなります。" },
  { id: "hifumi123", name: "ヒフミ賽", description: "1・2・3の目しか出なくなります。" },
  { id: "gambler", name: "ギャンブラー", description: "自分が絡む精算のポイントの受け渡しが倍になります。" },
  { id: "godhand", name: "神の一手", description: "1ラウンド1回だけ、サイコロ1個を任意の目に固定できます。" },
  { id: "double_chance", name: "ダブルチャンス", description: "役なし時の振り直し上限が1回増えます。" },
];

export type ClientMessage =
  | {
      type: "join";
      nickname: string;
      abilityId: string;
      abilityMode?: AbilityMode;
      roundsPerPlayer?: number;
    }
  | { type: "ready" }
  | { type: "roll" }
  | { type: "use_active_ability"; payload: { pinnedValue: number } }
  | { type: "set_max_bet"; amount: number }
  | { type: "set_bet"; amount: number }
  | { type: "next_round" }
  | { type: "return_to_lobby" }
  | {
      type: "debug_set_next_roll";
      key: string;
      playerId: string;
      dice: [number, number, number];
    }
  | {
      type: "debug_set_ability";
      key: string;
      playerId: string;
      abilityId: string;
    };

export type ServerMessage =
  | { type: "state_update"; state: GameState }
  | { type: "roll_result"; playerId: string; result: RollResult }
  | { type: "error"; message: string };
