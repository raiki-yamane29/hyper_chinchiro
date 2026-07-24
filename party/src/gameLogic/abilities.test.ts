import { describe, expect, it } from "vitest";
import { applyMessage, createInitialState } from "./stateMachine";
import { DEBUG_KEY, type GameState } from "../types/game";

function setupGame(): GameState {
  let state = createInitialState("godhand-room");
  state = applyMessage(
    state,
    {
      type: "join",
      nickname: "A",
      abilityId: "godhand",
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

function forceGodhand(state: GameState, playerId: string): GameState {
  return applyMessage(
    state,
    {
      type: "debug_set_ability",
      key: DEBUG_KEY,
      playerId,
      abilityId: "godhand",
    },
    "observer",
  );
}

function getRoll(state: GameState, playerId: string) {
  return state.players[state.bankerIndex].id === playerId
    ? state.bankerRoll
    : state.playerRolls[playerId];
}

describe("神の一手（godhand）", () => {
  it("サイコロ2個が選択した目に固定され、残り1個だけ通常通り振られる", () => {
    let state = setupGame();
    const active = state.players[state.currentPlayerIndex];
    state = forceGodhand(state, active.id);

    state = applyMessage(
      state,
      { type: "use_active_ability", payload: { pinnedValue: 5 } },
      active.id,
    );

    const roll = getRoll(state, active.id);
    expect(roll).toBeTruthy();
    const countOfPinned = roll!.dice.filter((value) => value === 5).length;
    expect(countOfPinned).toBeGreaterThanOrEqual(2);
    expect(
      state.players.find((player) => player.id === active.id)
        ?.abilityUsedThisRound,
    ).toBe(true);
  });

  it("2個固定なので最低でも目アリ（ペア）以上の役が確定する", () => {
    let state = setupGame();
    const active = state.players[state.currentPlayerIndex];
    state = forceGodhand(state, active.id);

    state = applyMessage(
      state,
      { type: "use_active_ability", payload: { pinnedValue: 3 } },
      active.id,
    );

    const roll = getRoll(state, active.id);
    expect(roll?.isValid).toBe(true);
    expect(roll?.hand).not.toBe("nothing");
  });

  it("範囲外のpinnedValueは無視され、能力は消費されない", () => {
    let state = setupGame();
    const active = state.players[state.currentPlayerIndex];
    state = forceGodhand(state, active.id);

    state = applyMessage(
      state,
      { type: "use_active_ability", payload: { pinnedValue: 7 } },
      active.id,
    );

    expect(getRoll(state, active.id)).toBeFalsy();
    expect(
      state.players.find((player) => player.id === active.id)
        ?.abilityUsedThisRound,
    ).toBe(false);
    expect(state.rollCountMap[active.id]).toBe(0);
  });
});
