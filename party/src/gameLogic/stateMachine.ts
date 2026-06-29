import {
  applyAbilityWeights,
  BASE_WEIGHTS,
  getAbility,
  type DiceWeights,
} from "./abilities";
import { rollWithWeights } from "./diceRoller";
import { evaluateHand } from "./handEvaluator";
import type { ClientMessage, GameState, Player, RollResult } from "../types/game";

const DEFAULT_MAX_ROUNDS = 5;
const DEFAULT_MAX_ROLLS = 3;

export function createInitialState(roomId: string): GameState {
  return {
    phase: "lobby",
    roomId,
    players: [],
    bankerIndex: 0,
    currentPlayerIndex: 0,
    bankerRoll: null,
    playerRolls: {},
    scores: {},
    round: 1,
    maxRounds: DEFAULT_MAX_ROUNDS,
    rollCountMap: {},
  };
}

export function applyMessage(
  state: GameState,
  msg: ClientMessage,
  senderId: string,
): GameState {
  switch (msg.type) {
    case "join":
      return joinGame(state, msg.nickname, msg.abilityId, senderId);
    case "ready":
      return markReady(state, senderId);
    case "roll":
      return rollForCurrentTurn(state, senderId);
    case "use_active_ability":
      return rollForCurrentTurn(state, senderId, msg.payload.pinnedValue);
    case "next_round":
      return startNextRound(state);
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
  delete scores[playerId];
  delete rollCountMap[playerId];
  delete playerRolls[playerId];

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
    };
  }

  return {
    ...state,
    players,
    scores,
    rollCountMap,
    playerRolls,
    bankerIndex: clampIndex(state.bankerIndex, players.length),
    currentPlayerIndex: clampIndex(state.currentPlayerIndex, players.length),
  };
}

function joinGame(
  state: GameState,
  nickname: string,
  abilityId: string,
  senderId: string,
): GameState {
  const cleanNickname = nickname.trim().slice(0, 24) || "名無し";
  const ability = getAbility(abilityId);
  const existing = state.players.find((player) => player.id === senderId);

  if (existing) {
    return {
      ...state,
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

function markReady(state: GameState, senderId: string): GameState {
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
      phase: "banker_turn",
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

  const activePlayer = getActivePlayer(state);
  if (!activePlayer || activePlayer.id !== senderId) {
    return state;
  }

  const isGodhandRoll = pinnedValue !== undefined;
  if (isGodhandRoll && !canUseGodhand(activePlayer, pinnedValue)) {
    return state;
  }

  const rollCount = (state.rollCountMap[senderId] ?? 0) + 1;
  const maxRolls = getMaxRolls(activePlayer);
  if (rollCount > maxRolls) {
    return state;
  }

  const previousDice = getPreviousDice(state, activePlayer.id);
  const roll = rollDiceForPlayer(activePlayer, rollCount, previousDice, pinnedValue);
  const rollCountMap = { ...state.rollCountMap, [senderId]: rollCount };
  const players = state.players.map((player) =>
    player.id === senderId && isGodhandRoll
      ? { ...player, abilityUsedThisRound: true }
      : player,
  );

  if (state.phase === "banker_turn") {
    const nextState = {
      ...state,
      players,
      bankerRoll: roll,
      rollCountMap,
    };

    if (!roll.isValid && rollCount < maxRolls) {
      return nextState;
    }

    return advanceToFirstChild(nextState);
  }

  const playerRolls = { ...state.playerRolls, [senderId]: roll };
  const nextState = {
    ...state,
    players,
    playerRolls,
    rollCountMap,
  };

  if (!roll.isValid && rollCount < maxRolls) {
    return nextState;
  }

  return advanceToNextChildOrResult(nextState);
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
    phase: "banker_turn",
  });
}

function resetRound(state: GameState): GameState {
  const rollCountMap = Object.fromEntries(
    state.players.map((player) => [player.id, 0]),
  );

  return {
    ...state,
    currentPlayerIndex: state.bankerIndex,
    bankerRoll: null,
    playerRolls: {},
    rollCountMap,
    players: state.players.map((player) => ({
      ...player,
      abilityUsedThisRound: false,
      isReady: true,
    })),
  };
}

function rollDiceForPlayer(
  player: Player,
  rollCount: number,
  previousDice?: [number, number, number],
  pinnedValue?: number,
): RollResult {
  if (player.abilityId === "godhand" && pinnedValue !== undefined) {
    const remainingWeights = applyAbilityWeights(
      player.abilityId,
      BASE_WEIGHTS,
      {
        previousDice,
        rollCount,
        abilityUsedThisRound: player.abilityUsedThisRound,
        pinnedDiceValue: pinnedValue,
      },
    );
    const dice: [number, number, number] = [
      pinnedValue,
      rollWithPlayerWeights(player, rollCount, previousDice, remainingWeights),
      rollWithPlayerWeights(player, rollCount, previousDice, remainingWeights),
    ];
    return evaluateHand(shuffleDice(dice));
  }

  const weights = applyAbilityWeights(player.abilityId, BASE_WEIGHTS, {
    previousDice,
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
  rollCount: number,
  previousDice: [number, number, number] | undefined,
  base: DiceWeights,
): number {
  const weights =
    player.abilityId === "godhand"
      ? BASE_WEIGHTS
      : applyAbilityWeights(player.abilityId, base, {
          previousDice,
          rollCount,
          abilityUsedThisRound: player.abilityUsedThisRound,
        });
  return rollWithWeights(weights);
}

function canUseGodhand(player: Player, pinnedValue: number | undefined): boolean {
  return (
    player.abilityId === "godhand" &&
    !player.abilityUsedThisRound &&
    pinnedValue !== undefined &&
    Number.isInteger(pinnedValue) &&
    pinnedValue >= 1 &&
    pinnedValue <= 6
  );
}

function getMaxRolls(player: Player): number {
  return player.abilityId === "double_chance"
    ? DEFAULT_MAX_ROLLS + 1
    : DEFAULT_MAX_ROLLS;
}

function getActivePlayer(state: GameState): Player | undefined {
  if (state.phase === "banker_turn") {
    return state.players[state.bankerIndex];
  }

  return state.players[state.currentPlayerIndex];
}

function advanceToFirstChild(state: GameState): GameState {
  const nextIndex = nextChildIndex(state, state.bankerIndex);
  return {
    ...state,
    phase: "player_turn",
    currentPlayerIndex: nextIndex,
  };
}

function advanceToNextChildOrResult(state: GameState): GameState {
  const nextIndex = nextChildIndex(state, state.currentPlayerIndex);
  if (nextIndex === state.bankerIndex) {
    return finishRound(state);
  }

  return {
    ...state,
    currentPlayerIndex: nextIndex,
  };
}

function finishRound(state: GameState): GameState {
  const banker = state.players[state.bankerIndex];
  if (!banker || !state.bankerRoll) {
    return state;
  }

  const scores = { ...state.scores };

  for (const player of state.players) {
    if (player.id === banker.id) {
      continue;
    }

    const playerRoll = state.playerRolls[player.id];
    const winner = compareRolls(state.bankerRoll, playerRoll);
    if (winner === "banker") {
      scores[banker.id] = (scores[banker.id] ?? 0) + 1;
      scores[player.id] = (scores[player.id] ?? 0) - 1;
    } else if (winner === "player") {
      scores[player.id] = (scores[player.id] ?? 0) + 2;
      scores[banker.id] = (scores[banker.id] ?? 0) - 1;
    }
  }

  return {
    ...state,
    scores,
    phase: state.round >= state.maxRounds ? "game_over" : "round_result",
  };
}

function compareRolls(
  bankerRoll: RollResult,
  playerRoll: RollResult | undefined,
): "banker" | "player" | "draw" {
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
  return "draw";
}

function nextChildIndex(state: GameState, fromIndex: number): number {
  if (state.players.length <= 1) {
    return state.bankerIndex;
  }

  let index = fromIndex;
  do {
    index = (index + 1) % state.players.length;
  } while (index === state.bankerIndex);
  return index;
}

function getPreviousDice(
  state: GameState,
  currentPlayerId: string,
): [number, number, number] | undefined {
  const playerIds = state.players.map((player) => player.id);
  const currentIndex = playerIds.indexOf(currentPlayerId);
  const previousPlayerId =
    currentIndex <= 0
      ? playerIds[playerIds.length - 1]
      : playerIds[currentIndex - 1];

  if (previousPlayerId === state.players[state.bankerIndex]?.id) {
    return state.bankerRoll?.dice;
  }

  return state.playerRolls[previousPlayerId]?.dice ?? state.bankerRoll?.dice;
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
