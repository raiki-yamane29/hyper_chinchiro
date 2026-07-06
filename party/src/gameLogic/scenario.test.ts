import { describe, expect, it } from "vitest";
import {
  applyMessage,
  createInitialState,
  removePlayer,
  setPlayerConnected,
} from "./stateMachine";
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

function totalScore(state: GameState): number {
  return Object.values(state.scores).reduce((total, score) => total + score, 0);
}

describe("結合テスト: フルゲームシナリオ", () => {
  it("3人 roundsPerPlayer=1 で3ラウンド完走し、親が順番に交代しゼロサムを維持する", () => {
    let state = createInitialState("scenario-full");
    state = applyMessage(
      state,
      {
        type: "join",
        nickname: "P1",
        abilityId: "trickster",
        abilityMode: "selected",
        roundsPerPlayer: 1,
      },
      "P1",
    );
    state = applyMessage(
      state,
      { type: "join", nickname: "P2", abilityId: "trickster" },
      "P2",
    );
    state = applyMessage(
      state,
      { type: "join", nickname: "P3", abilityId: "trickster" },
      "P3",
    );
    state = applyMessage(state, { type: "ready" }, "P1");
    state = applyMessage(state, { type: "ready" }, "P2");
    state = applyMessage(state, { type: "ready" }, "P3");

    expect(state.maxRounds).toBe(3);

    const bankerOrder: string[] = [];

    for (let round = 1; round <= 3; round++) {
      const banker = state.players[state.bankerIndex];
      bankerOrder.push(banker.id);

      // 子2人はそれぞれ目5・目4（親より弱いペア役）を固定して振る
      let childValue = 5;
      while (state.phase === "player_turn") {
        const activeId = state.players[state.currentPlayerIndex].id;
        state = forceRoll(state, activeId, [3, 3, childValue]);
        childValue -= 1;
      }

      expect(state.phase).toBe("banker_turn");
      state = forceRoll(state, banker.id, [1, 1, 6]);

      expect(totalScore(state)).toBe(0);

      if (round < 3) {
        expect(state.phase).toBe("round_result");
        state = applyMessage(state, { type: "next_round" }, banker.id);
      } else {
        expect(state.phase).toBe("game_over");
      }
    }

    // 親が3人分すべて重複なく回った
    expect(new Set(bankerOrder).size).toBe(3);
    expect(totalScore(state)).toBe(0);
  });
});

describe("結合テスト: 賭け金シナリオ", () => {
  it("3pt賭け×ゾロ目3倍 = 9pt を子が獲得する", () => {
    let state = createInitialState("scenario-bet");
    state = applyMessage(
      state,
      { type: "join", nickname: "Banker", abilityId: "trickster" },
      "Banker",
    );
    state = applyMessage(
      state,
      { type: "join", nickname: "Child", abilityId: "trickster" },
      "Child",
    );
    state = applyMessage(state, { type: "ready" }, "Banker");
    state = applyMessage(state, { type: "ready" }, "Child");

    const child = state.players[state.currentPlayerIndex];
    const banker = state.players[state.bankerIndex];

    state = applyMessage(state, { type: "set_bet", amount: 3 }, child.id);
    state = forceRoll(state, child.id, [6, 6, 6]);
    expect(state.phase).toBe("banker_turn");
    state = forceRoll(state, banker.id, [2, 2, 5]);

    const settlement = state.roundSettlements[child.id];
    expect(settlement.points).toBe(9);
    expect(settlement.playerDelta).toBe(9);
    expect(settlement.bankerDelta).toBe(-9);
  });
});

describe("結合テスト: 再戦シナリオ", () => {
  it("game_over から全員readyで再戦し、scores/history/betsが初期化される", () => {
    let state = createInitialState("scenario-rematch");
    state = applyMessage(
      state,
      { type: "join", nickname: "A", abilityId: "trickster", roundsPerPlayer: 1 },
      "A",
    );
    state = applyMessage(
      state,
      { type: "join", nickname: "B", abilityId: "trickster" },
      "B",
    );
    state = applyMessage(state, { type: "ready" }, "A");
    state = applyMessage(state, { type: "ready" }, "B");

    // maxRounds=2（2人×1）。1ラウンド目
    const child1 = state.players[state.currentPlayerIndex];
    state = applyMessage(state, { type: "set_bet", amount: 2 }, child1.id);
    state = forceRoll(state, child1.id, [3, 3, 4]);
    const banker1 = state.players[state.bankerIndex];
    state = forceRoll(state, banker1.id, [1, 1, 5]);
    state = applyMessage(state, { type: "next_round" }, banker1.id);

    // 2ラウンド目（最終）
    const child2 = state.players[state.currentPlayerIndex];
    state = forceRoll(state, child2.id, [3, 3, 4]);
    const banker2 = state.players[state.bankerIndex];
    state = forceRoll(state, banker2.id, [1, 1, 5]);

    expect(state.phase).toBe("game_over");
    expect(state.history.length).toBe(2);
    expect(Object.values(state.scores).some((score) => score !== 0)).toBe(true);

    state = applyMessage(state, { type: "ready" }, "A");
    state = applyMessage(state, { type: "ready" }, "B");

    expect(state.phase).toBe("ability_select");
    expect(Object.values(state.scores).every((score) => score === 0)).toBe(true);
    expect(state.history).toEqual([]);
    expect(state.bets).toEqual({});
  });
});

describe("結合テスト: 切断シナリオ", () => {
  it("切断でconnected=falseになり、猶予後の削除で2人未満ならlobbyに戻る", () => {
    let state = createInitialState("scenario-disconnect");
    state = applyMessage(
      state,
      { type: "join", nickname: "A", abilityId: "trickster" },
      "A",
    );
    state = applyMessage(
      state,
      { type: "join", nickname: "B", abilityId: "trickster" },
      "B",
    );
    state = applyMessage(state, { type: "ready" }, "A");
    state = applyMessage(state, { type: "ready" }, "B");
    expect(state.phase).not.toBe("lobby");

    state = setPlayerConnected(state, "A", false);
    expect(state.players.find((p) => p.id === "A")?.connected).toBe(false);
    expect(state.players.length).toBe(2);

    state = removePlayer(state, "A");
    expect(state.players.length).toBe(1);
    expect(state.phase).toBe("lobby");
  });
});

describe("結合テスト: 復帰リグレッション", () => {
  it("既存IDでの再joinはphaseを変えない", () => {
    let state = createInitialState("scenario-reconnect");
    state = applyMessage(
      state,
      { type: "join", nickname: "A", abilityId: "trickster" },
      "A",
    );
    state = applyMessage(
      state,
      { type: "join", nickname: "B", abilityId: "trickster" },
      "B",
    );
    state = applyMessage(state, { type: "ready" }, "A");
    state = applyMessage(state, { type: "ready" }, "B");
    const phaseBeforeRejoin = state.phase;

    state = applyMessage(
      state,
      { type: "join", nickname: "A", abilityId: "trickster" },
      "A",
    );

    expect(state.phase).toBe(phaseBeforeRejoin);
  });
});
