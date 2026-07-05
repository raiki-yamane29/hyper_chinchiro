import { describe, expect, it } from "vitest";
import { evaluateHand } from "./handEvaluator";

describe("役判定", () => {
  it("123（ヒフミ）", () => {
    const roll = evaluateHand([1, 2, 3]);
    expect(roll.hand).toBe("123");
    expect(roll.isValid).toBe(true);
  });

  it("456（シゴロ）", () => {
    const roll = evaluateHand([4, 5, 6]);
    expect(roll.hand).toBe("456");
    expect(roll.isValid).toBe(true);
  });

  it("ゾロ目", () => {
    for (const n of [1, 2, 3, 4, 5, 6] as const) {
      const roll = evaluateHand([n, n, n]);
      expect(roll.hand).toBe("trips");
      expect(roll.isValid).toBe(true);
    }
  });

  it("目アリ（ペア+1個）", () => {
    const roll = evaluateHand([2, 4, 4]);
    expect(roll.hand).toBe("pair");
    expect(roll.isValid).toBe(true);
  });

  it("役なしは振り直し", () => {
    const roll = evaluateHand([1, 3, 5]);
    expect(roll.hand).toBe("nothing");
    expect(roll.isValid).toBe(false);
  });

  it("出目の順序に依存しない", () => {
    expect(evaluateHand([6, 4, 5]).hand).toBe("456");
    expect(evaluateHand([3, 1, 2]).hand).toBe("123");
    expect(evaluateHand([4, 2, 4]).hand).toBe("pair");
  });
});

describe("目アリの強さは「目」（余りの1個）で決まる", () => {
  it("[2,4,4] は目2（ペアの4は無関係）", () => {
    expect(evaluateHand([2, 4, 4]).handValue).toBe(2);
  });

  it("[3,2,2] は目3", () => {
    expect(evaluateHand([3, 2, 2]).handValue).toBe(3);
  });

  it("目2の親は目3・目4の子に負ける（回帰: ペアの数字で勝敗が決まっていたバグ）", () => {
    const banker = evaluateHand([2, 4, 4]); // 目2
    const childA = evaluateHand([3, 2, 2]); // 目3
    const childB = evaluateHand([3, 3, 4]); // 目4
    expect(banker.handValue).toBeLessThan(childA.handValue);
    expect(banker.handValue).toBeLessThan(childB.handValue);
  });
});

describe("役の序列", () => {
  it("ピンゾロ > ゾロ目(大きい順) > 456 > 目(大きい順) > 役なし > 123", () => {
    const ordered = [
      evaluateHand([1, 1, 1]), // ピンゾロ（最強）
      evaluateHand([6, 6, 6]),
      evaluateHand([2, 2, 2]),
      evaluateHand([4, 5, 6]),
      evaluateHand([6, 2, 2]), // 目6
      evaluateHand([1, 5, 5]), // 目1
      evaluateHand([1, 3, 5]), // 役なし
      evaluateHand([1, 2, 3]), // 123（最弱）
    ];

    for (let i = 0; i < ordered.length - 1; i++) {
      expect(
        ordered[i].handValue,
        `${JSON.stringify(ordered[i].dice)} は ${JSON.stringify(ordered[i + 1].dice)} より強いはず`,
      ).toBeGreaterThan(ordered[i + 1].handValue);
    }
  });

  it("ゾロ目は456より強い", () => {
    expect(evaluateHand([2, 2, 2]).handValue).toBeGreaterThan(
      evaluateHand([4, 5, 6]).handValue,
    );
  });

  it("ピンゾロは他のどのゾロ目より強い", () => {
    expect(evaluateHand([1, 1, 1]).handValue).toBeGreaterThan(
      evaluateHand([6, 6, 6]).handValue,
    );
  });
});
