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
}

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
  | { type: "return_to_lobby" };

export type ServerMessage =
  | { type: "state_update"; state: GameState }
  | { type: "roll_result"; playerId: string; result: RollResult }
  | { type: "error"; message: string };
