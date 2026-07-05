import type { HandType, RollResult } from "../types/game";

export function evaluateHand(dice: [number, number, number]): RollResult {
  const sorted = [...dice].sort((a, b) => a - b);
  let hand: HandType = "nothing";
  let handValue = 0;

  if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3) {
    hand = "123";
    handValue = -1;
  } else if (sorted[0] === 4 && sorted[1] === 5 && sorted[2] === 6) {
    hand = "456";
    handValue = 1000;
  } else if (sorted[0] === sorted[1] && sorted[1] === sorted[2]) {
    hand = "trips";
    handValue = 100 + sorted[0];
  } else {
    const counts = new Map<number, number>();
    for (const value of sorted) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const pair = [...counts.entries()].find(([, count]) => count === 2);
    const single = [...counts.entries()].find(([, count]) => count === 1);

    if (pair && single) {
      hand = "pair";
      // 目アリの強さは「目」（ペアでない余りの1個）で決まる。ペアの数字は無関係
      handValue = single[0];
    }
  }

  return {
    dice,
    hand,
    handValue,
    isValid: hand !== "nothing",
  };
}
