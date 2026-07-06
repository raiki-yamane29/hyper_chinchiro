import { describe, expect, it } from "vitest";
import {
  applyMessage,
  createInitialState,
  setPlayerConnected,
} from "./stateMachine";

describe("setPlayerConnected", () => {
  it("該当プレイヤーのconnectedフラグを更新する", () => {
    let state = createInitialState("c1");
    state = applyMessage(
      state,
      { type: "join", nickname: "A", abilityId: "trickster" },
      "A",
    );
    expect(state.players[0].connected).toBe(true);

    state = setPlayerConnected(state, "A", false);
    expect(state.players[0].connected).toBe(false);

    state = setPlayerConnected(state, "A", true);
    expect(state.players[0].connected).toBe(true);
  });

  it("存在しないIDでは何も変わらない", () => {
    const state = createInitialState("c2");
    expect(setPlayerConnected(state, "ghost", false)).toBe(state);
  });
});
