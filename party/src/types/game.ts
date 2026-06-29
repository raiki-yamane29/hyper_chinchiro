export type GamePhase =
  | "lobby"
  | "ability_select"
  | "banker_turn"
  | "player_turn"
  | "round_result"
  | "game_over";

export type HandType = "456" | "trips" | "pair" | "123" | "nothing";

export interface RollResult {
  dice: [number, number, number];
  hand: HandType;
  handValue: number;
  isValid: boolean;
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
  maxRounds: number;
  rollCountMap: Record<string, number>;
}

export type ClientMessage =
  | { type: "join"; nickname: string; abilityId: string }
  | { type: "ready" }
  | { type: "roll" }
  | { type: "use_active_ability"; payload: { pinnedValue: number } }
  | { type: "next_round" };

export type ServerMessage =
  | { type: "state_update"; state: GameState }
  | { type: "roll_result"; playerId: string; result: RollResult }
  | { type: "error"; message: string };
