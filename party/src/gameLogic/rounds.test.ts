import { describe, expect, it } from "vitest";
import { applyMessage, createInitialState } from "./stateMachine";
import type { GameState } from "../types/game";

function join(
  state: GameState,
  id: string,
  roundsPerPlayer?: number,
): GameState {
  return applyMessage(
    state,
    { type: "join", nickname: id, abilityId: "trickster", roundsPerPlayer },
    id,
  );
}

describe("roundsPerPlayer によるラウンド数の連動", () => {
  it("3人 × roundsPerPlayer=1 で maxRounds=3", () => {
    let state = createInitialState("r1");
    state = join(state, "A", 1);
    state = join(state, "B");
    state = join(state, "C");
    state = applyMessage(state, { type: "ready" }, "A");
    state = applyMessage(state, { type: "ready" }, "B");
    state = applyMessage(state, { type: "ready" }, "C");
    expect(state.maxRounds).toBe(3);
  });

  it("2人 × roundsPerPlayer=2 で maxRounds=4", () => {
    let state = createInitialState("r2");
    state = join(state, "A", 2);
    state = join(state, "B");
    state = applyMessage(state, { type: "ready" }, "A");
    state = applyMessage(state, { type: "ready" }, "B");
    expect(state.maxRounds).toBe(4);
  });

  it("ability_selectフェーズ中でもroundsPerPlayer指定は反映される（再戦後の設定変更を許可するため）", () => {
    let state = createInitialState("r3");
    state = join(state, "A", 1);
    state = join(state, "B");
    expect(state.phase).toBe("ability_select");
    state = join(state, "A", 3);
    expect(state.roundsPerPlayer).toBe(3);
  });

  it("ゲーム開始後（banker_turn等）のroundsPerPlayer指定は無視される", () => {
    let state = createInitialState("r4");
    state = join(state, "A", 1);
    state = join(state, "B");
    state = applyMessage(state, { type: "ready" }, "A");
    state = applyMessage(state, { type: "ready" }, "B");
    expect(state.phase).not.toBe("lobby");
    expect(state.phase).not.toBe("ability_select");
    state = join(state, "A", 3);
    expect(state.roundsPerPlayer).toBe(1);
  });
});
