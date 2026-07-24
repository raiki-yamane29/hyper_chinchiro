import {
  ABILITIES,
  applyAbilityWeights,
  BASE_WEIGHTS,
  getAbility,
  type DiceWeights,
} from "./abilities";
import { rollWithWeights } from "./diceRoller";
import { evaluateHand } from "./handEvaluator";
import {
  DEBUG_KEY,
  type AbilityMode,
  type ClientMessage,
  type GameState,
  type Player,
  type RoundSettlement,
  type RollResult,
} from "../types/game";

const DEFAULT_MAX_ROUNDS = 5;
const DEFAULT_MAX_ROLLS = 3;
const DEFAULT_BET = 1;

export function createInitialState(roomId: string): GameState {
  return {
    phase: "lobby",
    roomId,
    abilityMode: "selected",
    roundsPerPlayer: 1,
    players: [],
    bankerIndex: 0,
    currentPlayerIndex: 0,
    bankerRoll: null,
    playerRolls: {},
    roundSettlements: {},
    scores: {},
    bets: {},
    maxBet: null,
    turnOrder: [],
    round: 1,
    maxRounds: DEFAULT_MAX_ROUNDS,
    rollCountMap: {},
    currentTurnAbilityMap: {},
    history: [],
    debugNextRolls: {},
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
        msg.roundsPerPlayer,
      );
    case "ready":
      return markReady(state, senderId);
    case "roll":
      return rollForCurrentTurn(state, senderId);
    case "use_active_ability":
      return rollForCurrentTurn(state, senderId, msg.payload.pinnedValue);
    case "set_max_bet":
      return setMaxBet(state, senderId, msg.amount);
    case "set_bet":
      return setBet(state, senderId, msg.amount);
    case "next_round":
      return startNextRound(state);
    case "return_to_lobby":
      return returnToLobby(state);
    case "debug_set_next_roll":
      return debugSetNextRoll(state, msg.key, msg.playerId, msg.dice);
    case "debug_set_ability":
      return debugSetAbility(state, msg.key, msg.playerId, msg.abilityId);
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
  const debugNextRolls = { ...state.debugNextRolls };
  const bets = { ...state.bets };
  const turnOrder = state.turnOrder.filter((id) => id !== playerId);
  delete scores[playerId];
  delete rollCountMap[playerId];
  delete playerRolls[playerId];
  delete roundSettlements[playerId];
  delete debugNextRolls[playerId];
  delete bets[playerId];

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
      debugNextRolls,
      bets,
      maxBet: null,
      turnOrder: [],
    };
  }

  return {
    ...state,
    players,
    scores,
    rollCountMap,
    playerRolls,
    roundSettlements,
    debugNextRolls,
    bets,
    turnOrder,
    bankerIndex: clampIndex(state.bankerIndex, players.length),
    currentPlayerIndex: clampIndex(state.currentPlayerIndex, players.length),
  };
}

export function setPlayerConnected(
  state: GameState,
  playerId: string,
  connected: boolean,
): GameState {
  if (!state.players.some((player) => player.id === playerId)) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, connected } : player,
    ),
  };
}

function joinGame(
  state: GameState,
  nickname: string,
  abilityId: string,
  senderId: string,
  abilityMode?: AbilityMode,
  roundsPerPlayer?: number,
): GameState {
  const cleanNickname = nickname.trim().slice(0, 24) || "名無し";
  const ability = getAbility(abilityId);
  const existing = state.players.find((player) => player.id === senderId);
  // ロビー中はもちろん、能力選択中（ゲーム開始前・再戦直後）も設定変更を許可する
  const canChangeSettings =
    state.phase === "lobby" || state.phase === "ability_select";
  const nextAbilityMode =
    canChangeSettings && isAbilityMode(abilityMode)
      ? abilityMode
      : state.abilityMode;
  const nextRoundsPerPlayer =
    canChangeSettings && isValidRoundsPerPlayer(roundsPerPlayer)
      ? roundsPerPlayer
      : state.roundsPerPlayer;

  if (existing) {
    return {
      ...state,
      abilityMode: nextAbilityMode,
      roundsPerPlayer: nextRoundsPerPlayer,
      phase: state.phase === "lobby" ? "ability_select" : state.phase,
      players: state.players.map((player) =>
        player.id === senderId
          ? {
              ...player,
              nickname: cleanNickname,
              abilityId: ability.id,
              isReady: false,
              connected: true,
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
    connected: true,
  };

  return {
    ...state,
    abilityMode: nextAbilityMode,
    roundsPerPlayer: nextRoundsPerPlayer,
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

const MAX_BET_UPPER_BOUND = 99;

// 親がそのラウンドの賭けの上限を宣言する（ランダムモードのみ）。
// 能力が決まる前に賭けを確定させるため、親の上限宣言→子の賭け確定→能力発表の順にする
function setMaxBet(state: GameState, senderId: string, amount: number): GameState {
  if (state.phase !== "banker_max_bet") {
    return state;
  }
  const banker = state.players[state.bankerIndex];
  if (!banker || banker.id !== senderId) {
    return state;
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_BET_UPPER_BOUND) {
    return state;
  }

  return { ...state, phase: "betting", maxBet: amount };
}

function setBet(state: GameState, senderId: string, amount: number): GameState {
  if (state.abilityMode === "random_turn") {
    return setBetDuringBettingPhase(state, senderId, amount);
  }

  // 選択固定モード: 従来どおり、自分の手番かつ初回ロール前のみ受け付ける
  if (state.phase !== "player_turn") {
    return state;
  }
  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || activePlayer.id !== senderId) {
    return state;
  }
  if ((state.rollCountMap[senderId] ?? 0) !== 0) {
    return state;
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 3) {
    return state;
  }

  return {
    ...state,
    bets: { ...state.bets, [senderId]: amount },
  };
}

// ランダムモード: 子は全員同時に（他の子の賭けを見ずに）賭けを決める。
// 全員分そろったら、能力を全員分決定してから、賭けの低い順に振る順番を確定する
function setBetDuringBettingPhase(
  state: GameState,
  senderId: string,
  amount: number,
): GameState {
  if (state.phase !== "betting" || state.maxBet === null) {
    return state;
  }

  const banker = state.players[state.bankerIndex];
  const sender = state.players.find((player) => player.id === senderId);
  if (!sender || sender.id === banker?.id) {
    return state;
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > state.maxBet) {
    return state;
  }

  const bets = { ...state.bets, [senderId]: amount };
  const children = state.players.filter((player) => player.id !== banker?.id);
  const allBetsSubmitted = children.every(
    (player) => bets[player.id] !== undefined,
  );

  if (!allBetsSubmitted) {
    return { ...state, bets };
  }

  const turnOrder = [...children]
    .sort((a, b) => bets[a.id] - bets[b.id])
    .map((player) => player.id);
  const currentPlayerIndex = state.players.findIndex(
    (player) => player.id === turnOrder[0],
  );

  let revealed: GameState = {
    ...state,
    bets,
    turnOrder,
    phase: "player_turn",
    currentPlayerIndex,
  };
  // 子の能力はここで一括発表。親の能力は親の手番（banker_turn）開始時に
  // 別途 advanceToNextChildOrBanker 内の ensureTurnAbility で公開される
  for (const child of children) {
    revealed = ensureTurnAbility(revealed, child.id);
  }
  return revealed;
}

function debugSetNextRoll(
  state: GameState,
  key: string,
  playerId: string,
  dice: [number, number, number],
): GameState {
  const isValidDice =
    Array.isArray(dice) &&
    dice.length === 3 &&
    dice.every((v) => Number.isInteger(v) && v >= 1 && v <= 6);
  if (key !== DEBUG_KEY || !isValidDice) {
    return state;
  }

  if (!state.players.some((player) => player.id === playerId)) {
    return state;
  }

  return {
    ...state,
    debugNextRolls: {
      ...state.debugNextRolls,
      [playerId]: [dice[0], dice[1], dice[2]],
    },
  };
}

function debugSetAbility(
  state: GameState,
  key: string,
  playerId: string,
  abilityId: string,
): GameState {
  if (key !== DEBUG_KEY) {
    return state;
  }

  if (!state.players.some((player) => player.id === playerId)) {
    return state;
  }

  const ability = getAbility(abilityId);
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, abilityId: ability.id } : player,
    ),
    // ランダムモードでは手番割り当て済みの能力も上書きして即時反映する
    currentTurnAbilityMap: {
      ...state.currentTurnAbilityMap,
      [playerId]: ability.id,
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
    bets: {},
    maxBet: null,
    turnOrder: [],
    round: 1,
    rollCountMap: Object.fromEntries(
      state.players.map((player) => [player.id, 0]),
    ),
    currentTurnAbilityMap: {},
    history: [],
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
      maxRounds: players.length * state.roundsPerPlayer,
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

  const forcedDice = nextState.debugNextRolls[senderId];
  let roll: RollResult;
  if (forcedDice) {
    roll = evaluateHand(forcedDice);
    const debugNextRolls = { ...nextState.debugNextRolls };
    delete debugNextRolls[senderId];
    nextState = { ...nextState, debugNextRolls };
  } else {
    roll = rollDiceForPlayer(activePlayer, abilityId, rollCount, pinnedValue);
  }
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
  const players = state.players.map((player) => ({
    ...player,
    abilityUsedThisRound: false,
    isReady: true,
  }));
  const base: GameState = {
    ...state,
    players,
    bankerRoll: null,
    playerRolls: {},
    roundSettlements: {},
    rollCountMap,
    bets: {},
    maxBet: null,
    turnOrder: [],
    currentTurnAbilityMap: {},
  };

  if (base.abilityMode === "random_turn") {
    // 能力が決まる前に賭けを確定させるため、まず親が賭けの上限を宣言する
    return { ...base, phase: "banker_max_bet", currentPlayerIndex: base.bankerIndex };
  }

  const currentPlayerIndex = nextPlayerIndex(base, base.bankerIndex);
  return ensureTurnAbility(
    { ...base, currentPlayerIndex },
    players[currentPlayerIndex]?.id,
  );
}

function rollDiceForPlayer(
  player: Player,
  abilityId: string,
  rollCount: number,
  pinnedValue?: number,
): RollResult {
  if (abilityId === "godhand" && pinnedValue !== undefined) {
    // サイコロ2個を選択した同じ目に固定し、残り1個だけ通常通り振る
    const dice: [number, number, number] = [
      pinnedValue,
      pinnedValue,
      rollWithWeights(BASE_WEIGHTS),
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
  // ランダムモードでは賭けの低い順に確定させた turnOrder に従って進行する
  if (state.turnOrder.length > 0) {
    const activeId = state.players[state.currentPlayerIndex]?.id;
    const nextId = state.turnOrder[state.turnOrder.indexOf(activeId) + 1];
    if (!nextId) {
      return ensureTurnAbility(
        { ...state, phase: "banker_turn", currentPlayerIndex: state.bankerIndex },
        state.players[state.bankerIndex]?.id,
      );
    }
    const nextIndex = state.players.findIndex((player) => player.id === nextId);
    return ensureTurnAbility(
      { ...state, currentPlayerIndex: nextIndex },
      nextId,
    );
  }

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
    const bet = state.bets[player.id] ?? DEFAULT_BET;
    const settlement = applyGamblerMultiplier(
      applyBetMultiplier(
        createSettlement(banker, player, state.bankerRoll, playerRoll),
        bet,
      ),
      getEffectiveAbilityId(state, banker) === "gambler",
      getEffectiveAbilityId(state, player) === "gambler",
    );
    scores[banker.id] = (scores[banker.id] ?? 0) + settlement.bankerDelta;
    scores[player.id] = (scores[player.id] ?? 0) + settlement.playerDelta;
    roundSettlements[player.id] = settlement;
  }

  const isGameOver = state.round >= state.maxRounds;
  const historyEntry = {
    round: state.round,
    bankerId: banker.id,
    nicknames: Object.fromEntries(
      state.players.map((player) => [player.id, player.nickname]),
    ),
    rolls: {
      ...state.playerRolls,
      [banker.id]: state.bankerRoll,
    },
    settlements: roundSettlements,
  };

  return {
    ...state,
    scores,
    roundSettlements,
    phase: isGameOver ? "game_over" : "round_result",
    players: isGameOver
      ? state.players.map((player) => ({ ...player, isReady: false }))
      : state.players,
    currentTurnAbilityMap: {},
    history: [...state.history, historyEntry],
  };
}

// 賭け金1〜3ptは精算全体（親・子の増減）に同率で乗算する。1ptなら不変
export function applyBetMultiplier(
  settlement: RoundSettlement,
  bet: number,
): RoundSettlement {
  if (bet <= 1) {
    return settlement;
  }

  return {
    ...settlement,
    points: settlement.points * bet,
    bankerDelta: settlement.bankerDelta * bet,
    playerDelta: settlement.playerDelta * bet,
    reason: `賭け${bet}pt × ${settlement.reason}`,
  };
}

export function compareRolls(
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

export function createSettlement(
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

// ギャンブラーは「自分が絡む精算の受け渡し全体」を倍にする（両者が持つなら4倍）。
// 双方の増減を同率で倍にするためゼロサム性が保たれる
export function applyGamblerMultiplier(
  settlement: RoundSettlement,
  bankerIsGambler: boolean,
  playerIsGambler: boolean,
): RoundSettlement {
  const multiplier = (bankerIsGambler ? 2 : 1) * (playerIsGambler ? 2 : 1);
  if (multiplier === 1) {
    return settlement;
  }

  return {
    ...settlement,
    points: settlement.points * multiplier,
    bankerDelta: settlement.bankerDelta * multiplier,
    playerDelta: settlement.playerDelta * multiplier,
    reason: `${settlement.reason} × ギャンブラー${multiplier}倍`,
  };
}

export function getSettlementPoints(
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
    // 通常のability_select→player_turn遷移(markReady)と同じ着地点へ直接進める。
    // 再戦は「もう一度全員Ready」を要求せず、Ready1回でそのまま次のゲームを開始する
    return resetRound({
      ...state,
      phase: "player_turn",
      players,
      bankerIndex: 0,
      currentPlayerIndex: 0,
      bankerRoll: null,
      playerRolls: {},
      roundSettlements: {},
      scores: Object.fromEntries(players.map((player) => [player.id, 0])),
      bets: {},
      maxBet: null,
      turnOrder: [],
      round: 1,
      rollCountMap: Object.fromEntries(players.map((player) => [player.id, 0])),
      currentTurnAbilityMap: {},
      history: [],
      maxRounds: players.length * state.roundsPerPlayer,
    });
  }

  return { ...state, players };
}

function isValidRoundsPerPlayer(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 3
  );
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
