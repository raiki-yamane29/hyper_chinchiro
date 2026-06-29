export type DiceWeights = [number, number, number, number, number, number];

export interface Ability {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  applyWeights: (base: DiceWeights, ctx: AbilityContext) => DiceWeights;
}

export interface AbilityContext {
  previousDice?: [number, number, number];
  rollCount: number;
  abilityUsedThisRound: boolean;
  pinnedDiceValue?: number;
}

export const BASE_WEIGHTS: DiceWeights = [1, 1, 1, 1, 1, 1];

function cloneWeights(weights: DiceWeights): DiceWeights {
  return [...weights] as DiceWeights;
}

export const ABILITIES: Ability[] = [
  {
    id: "trickster",
    name: "イカサマ師",
    description: "2のウェイトを3倍にする",
    isActive: false,
    applyWeights: (base) => {
      const weights = cloneWeights(base);
      weights[1] *= 3;
      return weights;
    },
  },
  {
    id: "lucky_six",
    name: "ラッキーシックス",
    description: "6のウェイトを3倍にする",
    isActive: false,
    applyWeights: (base) => {
      const weights = cloneWeights(base);
      weights[5] *= 3;
      return weights;
    },
  },
  {
    id: "all_high",
    name: "オールフォア",
    description: "4・5・6のウェイトを各2倍にする",
    isActive: false,
    applyWeights: (base) => {
      const weights = cloneWeights(base);
      weights[3] *= 2;
      weights[4] *= 2;
      weights[5] *= 2;
      return weights;
    },
  },
  {
    id: "no_one",
    name: "ピンゾロ封じ",
    description: "1のウェイトを0.2倍にする",
    isActive: false,
    applyWeights: (base) => {
      const weights = cloneWeights(base);
      weights[0] *= 0.2;
      return weights;
    },
  },
  {
    id: "chaos",
    name: "カオスダイス",
    description: "毎回ランダムなウェイトを生成する",
    isActive: false,
    applyWeights: () =>
      Array.from({ length: 6 }, () => 0.5 + Math.random() * 3) as DiceWeights,
  },
  {
    id: "mirror",
    name: "ミラーロール",
    description: "直前の相手の出目のウェイトを上げる",
    isActive: false,
    applyWeights: (base, ctx) => {
      const weights = cloneWeights(base);
      for (const value of ctx.previousDice ?? []) {
        weights[value - 1] += 2;
      }
      return weights;
    },
  },
  {
    id: "godhand",
    name: "神の一手",
    description: "1ラウンド1回、サイコロ1個を任意の目に固定する",
    isActive: true,
    applyWeights: (base, ctx) => {
      if (!ctx.pinnedDiceValue || ctx.abilityUsedThisRound) {
        return cloneWeights(base);
      }

      const weights: DiceWeights = [0, 0, 0, 0, 0, 0];
      weights[ctx.pinnedDiceValue - 1] = 1;
      return weights;
    },
  },
  {
    id: "double_chance",
    name: "ダブルチャンス",
    description: "役なし時の振り直し上限を1回増やす",
    isActive: false,
    applyWeights: (base) => cloneWeights(base),
  },
];

export function getAbility(abilityId: string): Ability {
  return ABILITIES.find((ability) => ability.id === abilityId) ?? ABILITIES[0];
}

export function applyAbilityWeights(
  abilityId: string,
  base: DiceWeights,
  ctx: AbilityContext,
): DiceWeights {
  return getAbility(abilityId).applyWeights(base, ctx);
}
