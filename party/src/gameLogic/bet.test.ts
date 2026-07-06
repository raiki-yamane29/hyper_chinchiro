import { describe, expect, it } from "vitest";
import { evaluateHand } from "./handEvaluator";
import {
  applyBetMultiplier,
  applyGamblerMultiplier,
  applyMessage,
  createInitialState,
  createSettlement,
} from "./stateMachine";
import { DEBUG_KEY, type GameState, type Player } from "../types/game";

const banker: Player = {
  id: "banker",
  nickname: "親",
  abilityId: "trickster",
  abilityUsedThisRound: false,
  isReady: true,
  connected: true,
};

const child: Player = {
  id: "child",
  nickname: "子",
  abilityId: "trickster",
  abilityUsedThisRound: false,
  isReady: true,
  connected: true,
};

describe("applyBetMultiplier", () => {
  it("bet=1のときは不変", () => {
    const settlement = createSettlement(
      banker,
      child,
      evaluateHand([4, 5, 6]),
      evaluateHand([6, 2, 2]),
    );
    expect(applyBetMultiplier(settlement, 1)).toEqual(settlement);
  });

  it("bet=3で3倍・ゼロサムを維持する", () => {
    const settlement = createSettlement(
      banker,
      child,
      evaluateHand([4, 5, 6]),
      evaluateHand([6, 2, 2]),
    );
    const result = applyBetMultiplier(settlement, 3);
    expect(result.points).toBe(settlement.points * 3);
    expect(result.bankerDelta).toBe(settlement.bankerDelta * 3);
    expect(result.playerDelta).toBe(settlement.playerDelta * 3);
    expect(result.bankerDelta + result.playerDelta).toBe(0);
    expect(result.reason).toContain("賭け3pt");
  });
});

function setupGame(): GameState {
  let state = createInitialState("bet-room");
  state = applyMessage(
    state,
    { type: "join", nickname: "A", abilityId: "lucky_six" },
    "A",
  );
  state = applyMessage(
    state,
    { type: "join", nickname: "B", abilityId: "trickster" },
    "B",
  );
  state = applyMessage(state, { type: "ready" }, "A");
  state = applyMessage(state, { type: "ready" }, "B");
  return state;
}

describe("set_bet メッセージ", () => {
  it("手番の子が振る前に賭け金を選択できる", () => {
    let state = setupGame();
    const child = state.players[state.currentPlayerIndex];
    state = applyMessage(state, { type: "set_bet", amount: 3 }, child.id);
    expect(state.bets[child.id]).toBe(3);
  });

  it("手番でないプレイヤーの賭けは無視される", () => {
    let state = setupGame();
    const nonActive = state.players.find(
      (p, i) => i !== state.currentPlayerIndex,
    )!;
    state = applyMessage(state, { type: "set_bet", amount: 3 }, nonActive.id);
    expect(state.bets[nonActive.id]).toBeUndefined();
  });

  it("既に振った後の賭けは無視される", () => {
    let state = setupGame();
    const child = state.players[state.currentPlayerIndex];
    state = applyMessage(
      state,
      {
        type: "debug_set_next_roll",
        key: DEBUG_KEY,
        playerId: child.id,
        dice: [1, 2, 4],
      },
      "observer",
    );
    state = applyMessage(state, { type: "roll" }, child.id);
    state = applyMessage(state, { type: "set_bet", amount: 2 }, child.id);
    expect(state.bets[child.id]).toBeUndefined();
  });

  it("範囲外・非整数のamountは無視される", () => {
    let state = setupGame();
    const child = state.players[state.currentPlayerIndex];
    state = applyMessage(state, { type: "set_bet", amount: 0 }, child.id);
    expect(state.bets[child.id]).toBeUndefined();
    state = applyMessage(state, { type: "set_bet", amount: 4 }, child.id);
    expect(state.bets[child.id]).toBeUndefined();
  });

  it("複合ケース: 賭け2pt × ゾロ目3倍 × ギャンブラー2倍 = 12pt", () => {
    let state = setupGame();
    // A: 親, B: 子 いずれかを判定して固定する
    const bankerP = state.players[state.bankerIndex];
    const childP = state.players.find((p) => p.id !== bankerP.id)!;

    state = applyMessage(
      state,
      {
        type: "debug_set_ability",
        key: DEBUG_KEY,
        playerId: childP.id,
        abilityId: "gambler",
      },
      "observer",
    );
    state = applyMessage(state, { type: "set_bet", amount: 2 }, childP.id);
    state = applyMessage(
      state,
      {
        type: "debug_set_next_roll",
        key: DEBUG_KEY,
        playerId: childP.id,
        dice: [6, 6, 6],
      },
      "observer",
    );
    state = applyMessage(state, { type: "roll" }, childP.id);
    state = applyMessage(
      state,
      {
        type: "debug_set_next_roll",
        key: DEBUG_KEY,
        playerId: bankerP.id,
        dice: [2, 2, 5],
      },
      "observer",
    );
    state = applyMessage(state, { type: "roll" }, bankerP.id);

    const settlement = state.roundSettlements[childP.id];
    expect(settlement.points).toBe(12);
    expect(settlement.playerDelta).toBe(12);
    expect(settlement.bankerDelta).toBe(-12);
  });
});

describe("applyGamblerMultiplier（回帰）", () => {
  it("両者ギャンブラーなしなら不変", () => {
    const settlement = createSettlement(
      banker,
      child,
      evaluateHand([4, 5, 6]),
      evaluateHand([6, 2, 2]),
    );
    expect(applyGamblerMultiplier(settlement, false, false)).toEqual(
      settlement,
    );
  });
});
