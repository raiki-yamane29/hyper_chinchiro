import { describe, expect, it } from "vitest";
import { evaluateHand } from "./handEvaluator";
import {
  applyGamblerMultiplier,
  compareRolls,
  createSettlement,
  getSettlementPoints,
} from "./stateMachine";
import type { Player } from "../types/game";

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

describe("勝敗判定 (compareRolls)", () => {
  it("役が強い方が勝つ", () => {
    expect(compareRolls(evaluateHand([4, 5, 6]), evaluateHand([6, 2, 2]))).toBe(
      "banker",
    );
    expect(compareRolls(evaluateHand([6, 2, 2]), evaluateHand([4, 5, 6]))).toBe(
      "player",
    );
  });

  it("同値は親の勝ち", () => {
    expect(compareRolls(evaluateHand([4, 2, 2]), evaluateHand([4, 5, 5]))).toBe(
      "banker",
    );
  });

  it("123は相手が何でも負ける（相手も123なら親勝ち）", () => {
    expect(compareRolls(evaluateHand([1, 2, 3]), evaluateHand([1, 5, 5]))).toBe(
      "player",
    );
    expect(compareRolls(evaluateHand([1, 5, 5]), evaluateHand([1, 2, 3]))).toBe(
      "banker",
    );
    expect(compareRolls(evaluateHand([1, 2, 3]), evaluateHand([1, 2, 3]))).toBe(
      "banker",
    );
  });

  it("役なし確定は有役に負ける", () => {
    expect(compareRolls(evaluateHand([1, 3, 5]), evaluateHand([1, 5, 5]))).toBe(
      "player",
    );
    expect(compareRolls(evaluateHand([1, 5, 5]), evaluateHand([1, 3, 5]))).toBe(
      "banker",
    );
  });

  it("子が振っていなければ親の勝ち", () => {
    expect(compareRolls(evaluateHand([1, 3, 5]), undefined)).toBe("banker");
  });
});

describe("精算倍率 (getSettlementPoints)", () => {
  const pts = (
    winner: [number, number, number],
    loser: [number, number, number],
  ) => getSettlementPoints(evaluateHand(winner), evaluateHand(loser));

  it("通常勝ちは1pt", () => {
    expect(pts([6, 2, 2], [3, 5, 5]).points).toBe(1);
  });

  it("456勝ちは2倍", () => {
    expect(pts([4, 5, 6], [3, 5, 5]).points).toBe(2);
  });

  it("ゾロ目勝ちは3倍", () => {
    expect(pts([4, 4, 4], [3, 5, 5]).points).toBe(3);
  });

  it("ピンゾロ勝ちは5倍", () => {
    expect(pts([1, 1, 1], [3, 5, 5]).points).toBe(5);
  });

  it("相手がヒフミなら2倍", () => {
    expect(pts([3, 5, 5], [1, 2, 3]).points).toBe(2);
  });

  it("倍率は乗算: 456勝ち×相手ヒフミ = 4倍", () => {
    expect(pts([4, 5, 6], [1, 2, 3]).points).toBe(4);
  });

  it("倍率は乗算: ゾロ目勝ち×相手ヒフミ = 6倍", () => {
    expect(pts([4, 4, 4], [1, 2, 3]).points).toBe(6);
  });

  it("倍率は乗算: ピンゾロ勝ち×相手ヒフミ = 10倍", () => {
    expect(pts([1, 1, 1], [1, 2, 3]).points).toBe(10);
  });
});

describe("精算の向き (createSettlement)", () => {
  it("親勝ち: 親が+points、子が-points", () => {
    const s = createSettlement(
      banker,
      child,
      evaluateHand([4, 5, 6]),
      evaluateHand([6, 2, 2]),
    );
    expect(s.winnerId).toBe("banker");
    expect(s.bankerDelta).toBe(s.points);
    expect(s.playerDelta).toBe(-s.points);
  });

  it("子勝ち: 子が+points、親が-points", () => {
    const s = createSettlement(
      banker,
      child,
      evaluateHand([6, 2, 2]),
      evaluateHand([4, 5, 6]),
    );
    expect(s.winnerId).toBe("child");
    expect(s.playerDelta).toBe(s.points);
    expect(s.bankerDelta).toBe(-s.points);
  });

  it("精算はゼロサム（親の増減と子の増減が打ち消し合う）", () => {
    const cases: [
      [number, number, number],
      [number, number, number],
    ][] = [
      [[4, 5, 6], [6, 2, 2]],
      [[4, 4, 4], [1, 2, 3]],
      [[1, 2, 3], [1, 1, 1]],
      [[3, 2, 2], [3, 2, 2]],
    ];
    for (const [b, p] of cases) {
      const s = createSettlement(banker, child, evaluateHand(b), evaluateHand(p));
      expect(s.bankerDelta + s.playerDelta).toBe(0);
    }
  });
});

describe("ギャンブラーの倍加 (applyGamblerMultiplier)", () => {
  const base = createSettlement(
    banker,
    child,
    evaluateHand([4, 5, 6]), // 親456勝ち → 2pt
    evaluateHand([6, 2, 2]),
  );

  it("ギャンブラー不在なら変化なし", () => {
    expect(applyGamblerMultiplier(base, false, false)).toEqual(base);
  });

  it("親がギャンブラー: 受け渡し全体が2倍（子の支払いも2倍）", () => {
    const s = applyGamblerMultiplier(base, true, false);
    expect(s.bankerDelta).toBe(base.bankerDelta * 2);
    expect(s.playerDelta).toBe(base.playerDelta * 2);
    expect(s.points).toBe(base.points * 2);
  });

  it("子がギャンブラー: 受け渡し全体が2倍", () => {
    const s = applyGamblerMultiplier(base, false, true);
    expect(s.bankerDelta).toBe(base.bankerDelta * 2);
    expect(s.playerDelta).toBe(base.playerDelta * 2);
  });

  it("両者ギャンブラー: 4倍", () => {
    const s = applyGamblerMultiplier(base, true, true);
    expect(s.bankerDelta).toBe(base.bankerDelta * 4);
    expect(s.playerDelta).toBe(base.playerDelta * 4);
  });

  it("倍加後もゼロサムが保たれる", () => {
    for (const [bg, pg] of [
      [true, false],
      [false, true],
      [true, true],
    ] as const) {
      const s = applyGamblerMultiplier(base, bg, pg);
      expect(s.bankerDelta + s.playerDelta).toBe(0);
    }
  });

  it("精算理由にギャンブラー倍率が付記される", () => {
    expect(applyGamblerMultiplier(base, true, false).reason).toContain(
      "ギャンブラー2倍",
    );
    expect(applyGamblerMultiplier(base, true, true).reason).toContain(
      "ギャンブラー4倍",
    );
  });
});
