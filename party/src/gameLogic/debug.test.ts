import { describe, expect, it } from "vitest";
import { applyMessage, createInitialState } from "./stateMachine";
import { DEBUG_KEY, type GameState } from "../types/game";

function setupGame(): GameState {
  let state = createInitialState("debug-room");
  state = applyMessage(
    state,
    {
      type: "join",
      nickname: "A",
      abilityId: "lucky_six",
      abilityMode: "selected",
    },
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

describe("デバッグ: 次の出目の固定", () => {
  it("固定した出目がそのまま採用され、消費後は解除される", () => {
    let state = setupGame();
    const active = state.players[state.currentPlayerIndex];

    state = applyMessage(
      state,
      {
        type: "debug_set_next_roll",
        key: DEBUG_KEY,
        playerId: active.id,
        dice: [4, 5, 6],
      },
      "observer",
    );
    expect(state.debugNextRolls[active.id]).toEqual([4, 5, 6]);

    state = applyMessage(state, { type: "roll" }, active.id);
    const roll =
      state.players[state.bankerIndex].id === active.id
        ? state.bankerRoll
        : state.playerRolls[active.id];
    expect(roll?.dice).toEqual([4, 5, 6]);
    expect(roll?.hand).toBe("456");
    expect(state.debugNextRolls[active.id]).toBeUndefined();
  });

  it("キーが違えば無視される", () => {
    let state = setupGame();
    const active = state.players[state.currentPlayerIndex];
    state = applyMessage(
      state,
      {
        type: "debug_set_next_roll",
        key: "wrong-key",
        playerId: active.id,
        dice: [4, 5, 6],
      },
      "observer",
    );
    expect(state.debugNextRolls[active.id]).toBeUndefined();
  });

  it("不正な出目は無視される", () => {
    let state = setupGame();
    const active = state.players[state.currentPlayerIndex];
    state = applyMessage(
      state,
      {
        type: "debug_set_next_roll",
        key: DEBUG_KEY,
        playerId: active.id,
        dice: [0, 7, 3] as [number, number, number],
      },
      "observer",
    );
    expect(state.debugNextRolls[active.id]).toBeUndefined();
  });
});

describe("デバッグ: 能力の変更", () => {
  it("能力が即時変更される（ランダムモードの手番割り当ても上書き）", () => {
    let state = setupGame();
    state = applyMessage(
      state,
      {
        type: "debug_set_ability",
        key: DEBUG_KEY,
        playerId: "A",
        abilityId: "gambler",
      },
      "observer",
    );
    expect(state.players.find((p) => p.id === "A")?.abilityId).toBe("gambler");
    expect(state.currentTurnAbilityMap["A"]).toBe("gambler");
  });

  it("キーが違えば無視される", () => {
    let state = setupGame();
    state = applyMessage(
      state,
      {
        type: "debug_set_ability",
        key: "wrong-key",
        playerId: "A",
        abilityId: "gambler",
      },
      "observer",
    );
    expect(state.players.find((p) => p.id === "A")?.abilityId).toBe(
      "lucky_six",
    );
  });
});
