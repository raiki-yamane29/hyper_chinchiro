export type GamePhase =
  | "lobby"
  | "ability_select"
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
  abilityMode: AbilityMode;
  players: Player[];
  bankerIndex: number;
  currentPlayerIndex: number;
  bankerRoll: RollResult | null;
  playerRolls: Record<string, RollResult>;
  roundSettlements: Record<string, RoundSettlement>;
  scores: Record<string, number>;
  round: number;
  maxRounds: number;
  rollCountMap: Record<string, number>;
  currentTurnAbilityMap: Record<string, string>;
  /** デバッグ用: 次のロールで強制する出目（playerId → dice） */
  debugNextRolls: Record<string, [number, number, number]>;
}

// デバッグページ/メッセージの共有シークレット（リンクを知らない人の操作を防ぐ）
export const DEBUG_KEY = "hyper-debug-7f3xk2p9qz";

export type ClientMessage =
  | {
      type: "join";
      nickname: string;
      abilityId: string;
      abilityMode?: AbilityMode;
    }
  | { type: "ready" }
  | { type: "roll" }
  | { type: "use_active_ability"; payload: { pinnedValue: number } }
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
