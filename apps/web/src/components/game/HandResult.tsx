"use client";

import type { RollResult } from "@/types/game";

const handLabels: Record<RollResult["hand"], string> = {
  "456": "シゴロ",
  trips: "ゾロ目",
  pair: "目あり",
  "123": "ヒフミ",
  nothing: "役なし",
};

interface HandResultProps {
  roll: RollResult | null;
}

export function HandResult({ roll }: HandResultProps) {
  if (!roll) {
    return <p className="mt-2 text-sm text-stone-500">未ロール</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">{handLabels[roll.hand]}</span>
      <span className="text-stone-600">value {roll.handValue}</span>
      {!roll.isValid && (
        <span className="border border-amber-500 px-2 py-0.5 text-amber-700">
          振り直し可
        </span>
      )}
    </div>
  );
}
