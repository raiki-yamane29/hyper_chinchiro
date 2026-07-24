export type DiceWeights = [number, number, number, number, number, number];

export interface Ability {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  /** ランダム能力モードでの抽選重み。大きいほど出やすい（強力な能力ほど小さくする） */
  rarityWeight: number;
  applyWeights: (base: DiceWeights, ctx: AbilityContext) => DiceWeights;
}

export interface AbilityContext {
  rollCount: number;
  abilityUsedThisRound: boolean;
  pinnedDiceValue?: number;
}

export const BASE_WEIGHTS: DiceWeights = [1, 1, 1, 1, 1, 1];

function cloneWeights(weights: DiceWeights): DiceWeights {
  return [...weights] as DiceWeights;
}

function favorSingle(index: number, multiplier: number) {
  return (base: DiceWeights): DiceWeights => {
    const weights = cloneWeights(base);
    weights[index] *= multiplier;
    return weights;
  };
}

export const ABILITIES: Ability[] = [
  {
    id: "lucky_one",
    name: "ラッキーワン",
    description: "1のウェイトを3倍にする",
    isActive: false,
    rarityWeight: 10,
    applyWeights: favorSingle(0, 3),
  },
  {
    id: "trickster",
    name: "ラッキーツー",
    description: "2のウェイトを3倍にする",
    isActive: false,
    rarityWeight: 10,
    applyWeights: favorSingle(1, 3),
  },
  {
    id: "lucky_three",
    name: "ラッキースリー",
    description: "3のウェイトを3倍にする",
    isActive: false,
    rarityWeight: 10,
    applyWeights: favorSingle(2, 3),
  },
  {
    id: "lucky_four",
    name: "ラッキーフォー",
    description: "4のウェイトを3倍にする",
    isActive: false,
    rarityWeight: 10,
    applyWeights: favorSingle(3, 3),
  },
  {
    id: "lucky_five",
    name: "ラッキーファイブ",
    description: "5のウェイトを3倍にする",
    isActive: false,
    rarityWeight: 10,
    applyWeights: favorSingle(4, 3),
  },
  {
    id: "lucky_six",
    name: "ラッキーシックス",
    description: "6のウェイトを3倍にする",
    isActive: false,
    rarityWeight: 6,
    applyWeights: favorSingle(5, 3),
  },
  {
    id: "no_one",
    name: "ピンゾロ封じ",
    description: "1のウェイトを0.2倍にする",
    isActive: false,
    rarityWeight: 10,
    applyWeights: (base) => {
      const weights = cloneWeights(base);
      weights[0] *= 0.2;
      return weights;
    },
  },
  {
    id: "shigoro",
    name: "シゴロ賽",
    description: "4・5・6の目しか出なくする",
    isActive: false,
    rarityWeight: 1,
    applyWeights: () => [0, 0, 0, 1, 1, 1],
  },
  {
    id: "hifumi123",
    name: "ヒフミ賽",
    description: "1・2・3の目しか出なくする",
    isActive: false,
    rarityWeight: 10,
    applyWeights: () => [1, 1, 1, 0, 0, 0],
  },
  {
    id: "gambler",
    name: "ギャンブラー",
    description: "自分が絡む精算のポイントの受け渡しが倍になる",
    isActive: false,
    rarityWeight: 3,
    applyWeights: (base) => cloneWeights(base),
  },
  {
    id: "godhand",
    name: "神の一手",
    description: "1ラウンド1回、サイコロ1個を任意の目に固定する",
    isActive: true,
    rarityWeight: 1,
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
    rarityWeight: 3,
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
