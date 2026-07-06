import { describe, expect, it } from "vitest";
import { applyMessage, createInitialState } from "./stateMachine";
import { DEBUG_KEY, type GameState } from "../types/game";

function forceRoll(
  state: GameState,
  playerId: string,
  dice: [number, number, number],
): GameState {
  let next = applyMessage(
    state,
    { type: "debug_set_next_roll", key: DEBUG_KEY, playerId, dice },
    "observer",
  );
  next = applyMessage(next, { type: "roll" }, playerId);
  return next;
}

function setupRandomGame(): GameState {
  let state = createInitialState("random-bet-room");
  state = applyMessage(
    state,
    {
      type: "join",
      nickname: "Banker",
      abilityId: "trickster",
      abilityMode: "random_turn",
    },
    "Banker",
  );
  state = applyMessage(
    state,
    { type: "join", nickname: "ChildA", abilityId: "trickster" },
    "ChildA",
  );
  state = applyMessage(
    state,
    { type: "join", nickname: "ChildB", abilityId: "trickster" },
    "ChildB",
  );
  state = applyMessage(state, { type: "ready" }, "Banker");
  state = applyMessage(state, { type: "ready" }, "ChildA");
  state = applyMessage(state, { type: "ready" }, "ChildB");
  return state;
}

describe("ランダムモード: 賭け→能力発表→低い順に振る", () => {
  it("ラウンド開始直後は親が上限を宣言するbanker_max_betフェーズになる", () => {
    const state = setupRandomGame();
    expect(state.phase).toBe("banker_max_bet");
    expect(state.players[state.currentPlayerIndex].id).toBe("Banker");
    expect(state.currentTurnAbilityMap).toEqual({});
  });

  it("親以外がset_max_betを送っても無視される", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 5 }, "ChildA");
    expect(state.phase).toBe("banker_max_bet");
    expect(state.maxBet).toBeNull();
  });

  it("不正な上限（0や非整数）は無視される", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 0 }, "Banker");
    expect(state.maxBet).toBeNull();
    state = applyMessage(state, { type: "set_max_bet", amount: 1.5 }, "Banker");
    expect(state.maxBet).toBeNull();
  });

  it("親が上限を宣言するとbettingフェーズに移る", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 5 }, "Banker");
    expect(state.phase).toBe("betting");
    expect(state.maxBet).toBe(5);
  });

  it("子は上限を超える賭けができない", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 3 }, "Banker");
    state = applyMessage(state, { type: "set_bet", amount: 4 }, "ChildA");
    expect(state.bets.ChildA).toBeUndefined();
  });

  it("親は賭けられない", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 3 }, "Banker");
    state = applyMessage(state, { type: "set_bet", amount: 2 }, "Banker");
    expect(state.bets.Banker).toBeUndefined();
  });

  it("全員分そろうまでは能力が発表されず、そろった時点で子の能力だけが決まり賭けの低い順で確定する（親は自分の手番まで非公開）", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 5 }, "Banker");

    state = applyMessage(state, { type: "set_bet", amount: 4 }, "ChildA");
    // まだChildBが未確定 → betting継続、能力は誰にも発表されない
    expect(state.phase).toBe("betting");
    expect(state.currentTurnAbilityMap).toEqual({});

    state = applyMessage(state, { type: "set_bet", amount: 1 }, "ChildB");

    // 全員分そろった → 子の能力が決まり、賭けの低い順（ChildB→ChildA）で確定
    // 親の能力はまだ非公開（親の手番が来るまで発表されない）
    expect(state.phase).toBe("player_turn");
    expect(state.turnOrder).toEqual(["ChildB", "ChildA"]);
    expect(state.players[state.currentPlayerIndex].id).toBe("ChildB");
    expect(Object.keys(state.currentTurnAbilityMap).sort()).toEqual(
      ["ChildA", "ChildB"].sort(),
    );
    expect(state.currentTurnAbilityMap.Banker).toBeUndefined();
  });

  it("親の能力は親の手番（banker_turn）が始まるまで公開されない", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 5 }, "Banker");
    state = applyMessage(state, { type: "set_bet", amount: 2 }, "ChildA");
    state = applyMessage(state, { type: "set_bet", amount: 1 }, "ChildB");

    state = forceRoll(state, "ChildB", [3, 3, 4]);
    expect(state.currentTurnAbilityMap.Banker).toBeUndefined();

    state = forceRoll(state, "ChildA", [3, 3, 5]);
    expect(state.phase).toBe("banker_turn");
    // 親の手番になった瞬間に能力が公開される（振る前）
    expect(state.currentTurnAbilityMap.Banker).toBeDefined();
  });

  it("賭けの低い順→親の順でロールが進行する", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 5 }, "Banker");
    state = applyMessage(state, { type: "set_bet", amount: 4 }, "ChildA");
    state = applyMessage(state, { type: "set_bet", amount: 1 }, "ChildB");

    expect(state.players[state.currentPlayerIndex].id).toBe("ChildB");
    state = forceRoll(state, "ChildB", [3, 3, 4]);
    expect(state.phase).toBe("player_turn");
    expect(state.players[state.currentPlayerIndex].id).toBe("ChildA");

    state = forceRoll(state, "ChildA", [3, 3, 5]);
    expect(state.phase).toBe("banker_turn");
    expect(state.players[state.currentPlayerIndex].id).toBe("Banker");

    state = forceRoll(state, "Banker", [1, 1, 6]);
    expect(state.phase === "round_result" || state.phase === "game_over").toBe(
      true,
    );

    const total = Object.values(state.scores).reduce((t, v) => t + v, 0);
    expect(total).toBe(0);
  });

  it("次ラウンドでも再びbanker_max_betから始まる（親交代後）", () => {
    let state = setupRandomGame();
    state = applyMessage(state, { type: "set_max_bet", amount: 5 }, "Banker");
    state = applyMessage(state, { type: "set_bet", amount: 2 }, "ChildA");
    state = applyMessage(state, { type: "set_bet", amount: 1 }, "ChildB");
    state = forceRoll(state, "ChildB", [3, 3, 4]);
    state = forceRoll(state, "ChildA", [3, 3, 5]);
    state = forceRoll(state, "Banker", [1, 1, 6]);

    if (state.phase === "round_result") {
      state = applyMessage(state, { type: "next_round" }, "Banker");
      expect(state.phase).toBe("banker_max_bet");
      expect(state.bets).toEqual({});
      expect(state.maxBet).toBeNull();
      expect(state.turnOrder).toEqual([]);
      expect(state.currentTurnAbilityMap).toEqual({});
    }
  });
});
