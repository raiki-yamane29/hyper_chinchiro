import {
  ABILITIES,
  applyAbilityWeights,
  BASE_WEIGHTS,
  getAbility,
  type DiceWeights,
} from "./abilities";
import { rollWithWeights } from "./diceRoller";
import { evaluateHand } from "./handEvaluator";
import type {
  AbilityMode,
  ClientMessage,
  GameState,
  Player,
  RoundSettlement,
  RollResult,
} from "../types/game";

const DEFAULT_MAX_ROUNDS = 5;
const DEFAULT_MAX_ROLLS = 3;

export function createInitialState(roomId: string): GameState {
  return {
    phase: "lobby",
    roomId,
    abilityMode: "selected",
    players: [],
    bankerIndex: 0,
    currentPlayerIndex: 0,
    bankerRoll: null,
    playerRolls: {},
    roundSettlements: {},
    scores: {},
    round: 1,
    maxRounds: DEFAULT_MAX_ROUNDS,
    rollCountMap: {},
    currentTurnAbilityMap: {},
  };
}

export function applyMessage(
  state: GameState,
  msg: ClientMessage,
  senderId: string,
): GameState {
  switch (msg.type) {
    case "join":
      return joinGame(
        state,
        msg.nickname,
        msg.abilityId,
        senderId,
        msg.abilityMode,
      );
    case "ready":
      return markReady(state, senderId);
    case "roll":
      return rollForCurrentTurn(state, senderId);
    case "use_active_ability":
      return rollForCurrentTurn(state, senderId, msg.payload.pinnedValue);
    case "next_round":
      return startNextRound(state);
    case "return_to_lobby":
      return returnToLobby(state);
    default:
      return state;
  }
}

export function removePlayer(state: GameState, playerId: string): GameState {
  if (!state.players.some((player) => player.id === playerId)) {
    return state;
  }

  const players = state.players.filter((player) => player.id !== playerId);
  const scores = { ...state.scores };
  const rollCountMap = { ...state.rollCountMap };
  const playerRolls = { ...state.playerRolls };
  const roundSettlements = { ...state.roundSettlements };
  delete scores[playerId];
  delete rollCountMap[playerId];
  delete playerRolls[playerId];
  delete roundSettlements[playerId];

  if (players.length < 2) {
    return {
      ...state,
      phase: "lobby",
      players,
      scores,
      rollCountMap,
      playerRolls,
      bankerIndex: 0,
      currentPlayerIndex: 0,
      bankerRoll: null,
      roundSettlements,
      currentTurnAbilityMap: {},
    };
  }

  return {
    ...state,
    players,
    scores,
    rollCountMap,
    playerRolls,
    roundSettlements,
    bankerIndex: clampIndex(state.bankerIndex, players.length),
    currentPlayerIndex: clampIndex(state.currentPlayerIndex, players.length),
  };
}

function joinGame(
  state: GameState,
  nickname: string,
  abilityId: string,
  senderId: string,
  abilityMode?: AbilityMode,
): GameState {
  const cleanNickname = nickname.trim().slice(0, 24) || "名無し";
  const ability = getAbility(abilityId);
  const existing = state.players.find((player) => player.id === senderId);
  const nextAbilityMode =
    state.phase === "lobby" && isAbilityMode(abilityMode)
      ? abilityMode
      : state.abilityMode;

  if (existing) {
    return {
      ...state,
      abilityMode: nextAbilityMode,
      phase: state.phase === "lobby" ? "ability_select" : state.phase,
      players: state.players.map((player) =>
        player.id === senderId
          ? {
              ...player,
              nickname: cleanNickname,
              abilityId: ability.id,
              isReady: false,
            }
          : player,
      ),
    };
  }

  if (state.phase !== "lobby" && state.phase !== "ability_select") {
    return state;
  }

  const player: Player = {
    id: senderId,
    nickname: cleanNickname,
    abilityId: ability.id,
    abilityUsedThisRound: false,
    isReady: false,
  };

  return {
    ...state,
    abilityMode: nextAbilityMode,
    phase: "ability_select",
    players: [...state.players, player],
    scores: {
      ...state.scores,
      [senderId]: state.scores[senderId] ?? 0,
    },
    rollCountMap: {
      ...state.rollCountMap,
      [senderId]: 0,
    },
  };
}

function returnToLobby(state: GameState): GameState {
  if (state.phase !== "game_over") {
    return state;
  }

  return {
    ...state,
    phase: "lobby",
    bankerIndex: 0,
    currentPlayerIndex: 0,
    bankerRoll: null,
    playerRolls: {},
    roundSettlements: {},
    scores: Object.fromEntries(state.players.map((player) => [player.id, 0])),
    round: 1,
    rollCountMap: Object.fromEntries(
      state.players.map((player) => [player.id, 0]),
    ),
    currentTurnAbilityMap: {},
    players: state.players.map((player) => ({
      ...player,
      abilityUsedThisRound: false,
      isReady: false,
    })),
  };
}

function markReady(state: GameState, senderId: string): GameState {
  if (state.phase === "game_over") {
    return markRematchReady(state, senderId);
  }

  if (state.phase !== "ability_select") {
    return state;
  }

  const players = state.players.map((player) =>
    player.id === senderId ? { ...player, isReady: true } : player,
  );

  if (players.length >= 2 && players.every((player) => player.isReady)) {
    return resetRound({
      ...state,
      players,
      phase: "player_turn",
    });
  }

  return { ...state, players };
}

function rollForCurrentTurn(
  state: GameState,
  senderId: string,
  pinnedValue?: number,
): GameState {
  if (state.phase !== "banker_turn" && state.phase !== "player_turn") {
    return state;
  }

  let nextState = state;
  const activePlayer = getActivePlayer(nextState);
  if (!activePlayer || activePlayer.id !== senderId) {
    return nextState;
  }

  nextState = ensureTurnAbility(nextState, activePlayer.id);
  const abilityId = getEffectiveAbilityId(nextState, activePlayer);
  const isGodhandRoll = pinnedValue !== undefined;
  if (isGodhandRoll && !canUseGodhand(activePlayer, abilityId, pinnedValue)) {
    return nextState;
  }

  const rollCount = (nextState.rollCountMap[senderId] ?? 0) + 1;
  const maxRolls = getMaxRolls(abilityId);
  if (rollCount > maxRolls) {
    return nextState;
  }

  const roll = rollDiceForPlayer(activePlayer, abilityId, rollCount, pinnedValue);
  const rollCountMap = { ...nextState.rollCountMap, [senderId]: rollCount };
  const players = nextState.players.map((player) =>
    player.id === senderId && isGodhandRoll
      ? { ...player, abilityUsedThisRound: true }
      : player,
  );

  if (nextState.phase === "banker_turn") {
    const rolledState = {
      ...nextState,
      players,
      bankerRoll: roll,
      rollCountMap,
    };

    if (!roll.isValid && rollCount < maxRolls) {
      return rolledState;
    }

    return finishRound(rolledState);
  }

  const playerRolls = { ...nextState.playerRolls, [senderId]: roll };
  const rolledState = {
    ...nextState,
    players,
    playerRolls,
    rollCountMap,
  };

  if (!roll.isValid && rollCount < maxRolls) {
    return rolledState;
  }

  return advanceToNextChildOrBanker(rolledState);
}

function startNextRound(state: GameState): GameState {
  if (state.phase !== "round_result" && state.phase !== "game_over") {
    return state;
  }

  if (state.phase === "game_over" || state.round >= state.maxRounds) {
    return { ...state, phase: "game_over" };
  }

  return resetRound({
    ...state,
    round: state.round + 1,
    bankerIndex: (state.bankerIndex + 1) % state.players.length,
    phase: "player_turn",
  });
}

function resetRound(state: GameState): GameState {
  const rollCountMap = Object.fromEntries(
    state.players.map((player) => [player.id, 0]),
  );
  const currentPlayerIndex = nextPlayerIndex(state, state.bankerIndex);

  return ensureTurnAbility({
    ...state,
    currentPlayerIndex,
    bankerRoll: null,
    playerRolls: {},
    roundSettlements: {},
    rollCountMap,
    currentTurnAbilityMap: {},
    players: state.players.map((player) => ({
      ...player,
      abilityUsedThisRound: false,
      isReady: true,
    })),
  }, state.players[currentPlayerIndex]?.id);
}

function rollDiceForPlayer(
  player: Player,
  abilityId: string,
  rollCount: number,
  pinnedValue?: number,
): RollResult {
  if (abilityId === "godhand" && pinnedValue !== undefined) {
    const remainingWeights = applyAbilityWeights(abilityId, BASE_WEIGHTS, {
      rollCount,
      abilityUsedThisRound: player.abilityUsedThisRound,
      pinnedDiceValue: pinnedValue,
    });
    const dice: [number, number, number] = [
      pinnedValue,
      rollWithPlayerWeights(player, abilityId, rollCount, remainingWeights),
      rollWithPlayerWeights(player, abilityId, rollCount, remainingWeights),
    ];
    return evaluateHand(shuffleDice(dice));
  }

  const weights = applyAbilityWeights(abilityId, BASE_WEIGHTS, {
    rollCount,
    abilityUsedThisRound: player.abilityUsedThisRound,
  });

  return evaluateHand([
    rollWithWeights(weights),
    rollWithWeights(weights),
    rollWithWeights(weights),
  ]);
}

function rollWithPlayerWeights(
  player: Player,
  abilityId: string,
  rollCount: number,
  base: DiceWeights,
): number {
  const weights =
    abilityId === "godhand"
      ? BASE_WEIGHTS
      : applyAbilityWeights(abilityId, base, {
          rollCount,
          abilityUsedThisRound: player.abilityUsedThisRound,
        });
  return rollWithWeights(weights);
}

function canUseGodhand(
  player: Player,
  abilityId: string,
  pinnedValue: number | undefined,
): boolean {
  return (
    abilityId === "godhand" &&
    !player.abilityUsedThisRound &&
    pinnedValue !== undefined &&
    Number.isInteger(pinnedValue) &&
    pinnedValue >= 1 &&
    pinnedValue <= 6
  );
}

function getMaxRolls(abilityId: string): number {
  return abilityId === "double_chance" ? DEFAULT_MAX_ROLLS + 1 : DEFAULT_MAX_ROLLS;
}

function getActivePlayer(state: GameState): Player | undefined {
  if (state.phase === "banker_turn") {
    return state.players[state.bankerIndex];
  }

  return state.players[state.currentPlayerIndex];
}

function advanceToNextChildOrBanker(state: GameState): GameState {
  const nextIndex = nextPlayerIndex(state, state.currentPlayerIndex);
  if (nextIndex === state.bankerIndex) {
    return ensureTurnAbility(
      {
        ...state,
        phase: "banker_turn",
        currentPlayerIndex: state.bankerIndex,
      },
      state.players[state.bankerIndex]?.id,
    );
  }

  return ensureTurnAbility({
    ...state,
    currentPlayerIndex: nextIndex,
  }, state.players[nextIndex]?.id);
}

function finishRound(state: GameState): GameState {
  const banker = state.players[state.bankerIndex];
  if (!banker || !state.bankerRoll) {
    return state;
  }

  const scores = { ...state.scores };
  const roundSettlements: Record<string, RoundSettlement> = {};

  for (const player of state.players) {
    if (player.id === banker.id) {
      continue;
    }

    const playerRoll = state.playerRolls[player.id];
    const rawSettlement = createSettlement(
      banker,
      player,
      state.bankerRoll,
      playerRoll,
    );
    const bankerMultiplier =
      getEffectiveAbilityId(state, banker) === "gambler" ? 2 : 1;
    const playerMultiplier =
      getEffectiveAbilityId(state, player) === "gambler" ? 2 : 1;
    const settlement: RoundSettlement = {
      ...rawSettlement,
      bankerDelta: rawSettlement.bankerDelta * bankerMultiplier,
      playerDelta: rawSettlement.playerDelta * playerMultiplier,
    };
    scores[banker.id] = (scores[banker.id] ?? 0) + settlement.bankerDelta;
    scores[player.id] = (scores[player.id] ?? 0) + settlement.playerDelta;
    roundSettlements[player.id] = settlement;
  }

  const isGameOver = state.round >= state.maxRounds;
  return {
    ...state,
    scores,
    roundSettlements,
    phase: isGameOver ? "game_over" : "round_result",
    players: isGameOver
      ? state.players.map((player) => ({ ...player, isReady: false }))
      : state.players,
    currentTurnAbilityMap: {},
  };
}

function compareRolls(
  bankerRoll: RollResult,
  playerRoll: RollResult | undefined,
): "banker" | "player" {
  if (!playerRoll) {
    return "banker";
  }

  if (bankerRoll.hand === "123" && playerRoll.hand !== "123") {
    return "player";
  }
  if (playerRoll.hand === "123" && bankerRoll.hand !== "123") {
    return "banker";
  }
  if (!bankerRoll.isValid && playerRoll.isValid) {
    return "player";
  }
  if (bankerRoll.isValid && !playerRoll.isValid) {
    return "banker";
  }
  if (bankerRoll.handValue > playerRoll.handValue) {
    return "banker";
  }
  if (playerRoll.handValue > bankerRoll.handValue) {
    return "player";
  }
  return "banker";
}

function createSettlement(
  banker: Player,
  player: Player,
  bankerRoll: RollResult,
  playerRoll: RollResult | undefined,
): RoundSettlement {
  const winner = compareRolls(bankerRoll, playerRoll);
  const winnerId = winner === "player" ? player.id : banker.id;
  const winnerRoll = winner === "player" ? playerRoll : bankerRoll;
  const loserRoll = winner === "player" ? bankerRoll : playerRoll;
  const { points, reason } = getSettlementPoints(winnerRoll, loserRoll);
  const bankerDelta = winner === "banker" ? points : -points;
  const playerDelta = winner === "player" ? points : -points;

  return {
    bankerId: banker.id,
    playerId: player.id,
    winnerId,
    bankerDelta,
    playerDelta,
    points,
    reason,
  };
}

function getSettlementPoints(
  winnerRoll: RollResult | undefined,
  loserRoll: RollResult | undefined,
): { points: number; reason: string } {
  // 勝者の役倍率と敗者ヒフミの2倍は乗算する（ゾロ目勝ち×ヒフミ負け = 3×2 = 6倍）
  const parts: string[] = [];
  let points = 1;

  if (winnerRoll?.hand === "trips") {
    if (winnerRoll.dice.every((value) => value === 1)) {
      points *= 5;
      parts.push("ピンゾロ 5倍");
    } else {
      points *= 3;
      parts.push("ゾロ目 3倍");
    }
  } else if (winnerRoll?.hand === "456") {
    points *= 2;
    parts.push("あらし 2倍");
  }

  if (loserRoll?.hand === "123") {
    points *= 2;
    parts.push("ヒフミ 2倍");
  }

  return {
    points,
    reason: parts.length > 0 ? parts.join(" × ") : "通常 1pt",
  };
}

function nextPlayerIndex(state: GameState, fromIndex: number): number {
  if (state.players.length <= 1) {
    return state.bankerIndex;
  }

  return (fromIndex + 1) % state.players.length;
}

function shuffleDice(dice: [number, number, number]): [number, number, number] {
  const copy = [...dice];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy as [number, number, number];
}

function clampIndex(index: number, length: number): number {
  return length === 0 ? 0 : Math.min(index, length - 1);
}

function markRematchReady(state: GameState, senderId: string): GameState {
  const players = state.players.map((player) =>
    player.id === senderId ? { ...player, isReady: true } : player,
  );

  if (players.length >= 2 && players.every((player) => player.isReady)) {
    return {
      ...state,
      phase: "ability_select",
      players: players.map((player) => ({
        ...player,
        abilityUsedThisRound: false,
        isReady: false,
      })),
      bankerIndex: 0,
      currentPlayerIndex: 0,
      bankerRoll: null,
      playerRolls: {},
      roundSettlements: {},
      scores: Object.fromEntries(players.map((player) => [player.id, 0])),
      round: 1,
      rollCountMap: Object.fromEntries(players.map((player) => [player.id, 0])),
      currentTurnAbilityMap: {},
    };
  }

  return { ...state, players };
}

function ensureTurnAbility(state: GameState, playerId?: string): GameState {
  if (!playerId || state.abilityMode !== "random_turn") {
    return state;
  }

  if (state.currentTurnAbilityMap[playerId]) {
    return state;
  }

  return {
    ...state,
    currentTurnAbilityMap: {
      ...state.currentTurnAbilityMap,
      [playerId]: randomAbilityId(),
    },
  };
}

function getEffectiveAbilityId(state: GameState, player: Player): string {
  if (state.abilityMode === "random_turn") {
    return state.currentTurnAbilityMap[player.id] ?? player.abilityId;
  }

  return player.abilityId;
}

function randomAbilityId(): string {
  const totalWeight = ABILITIES.reduce(
    (sum, ability) => sum + ability.rarityWeight,
    0,
  );
  let rand = Math.random() * totalWeight;
  for (const ability of ABILITIES) {
    rand -= ability.rarityWeight;
    if (rand <= 0) {
      return ability.id;
    }
  }
  return ABILITIES[0].id;
}

function isAbilityMode(value: unknown): value is AbilityMode {
  return value === "selected" || value === "random_turn";
}
