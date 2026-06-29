import type { DiceWeights } from "./abilities";

export function rollWithWeights(weights: DiceWeights): number {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) {
    return Math.floor(Math.random() * 6) + 1;
  }

  let rand = Math.random() * total;
  for (let i = 0; i < 6; i++) {
    rand -= Math.max(0, weights[i]);
    if (rand <= 0) {
      return i + 1;
    }
  }

  return 6;
}

export function rollThreeDice(weights: DiceWeights): [number, number, number] {
  return [
    rollWithWeights(weights),
    rollWithWeights(weights),
    rollWithWeights(weights),
  ];
}
