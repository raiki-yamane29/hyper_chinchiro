"use client";

import type { RollResult } from "@/types/game";

const handLabels: Record<RollResult["hand"], string> = {
  "456": "シゴロ",
  trips: "ゾロ目",
  pair: "目アリ",
  "123": "ヒフミ",
  nothing: "役なし",
};

interface HandResultProps {
  roll: RollResult | null;
  remaining?: number;
}

export function HandResult({ roll, remaining }: HandResultProps) {
  if (!roll) {
    return <p className="mt-2 text-sm text-stone-500">未ロール</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">{formatHand(roll)}</span>
      {!roll.isValid && (
        <span className="border border-amber-500 px-2 py-0.5 text-amber-700">
          振り直し可{remaining !== undefined ? `（あと${remaining}回）` : ""}
        </span>
      )}
    </div>
  );
}

function formatHand(roll: RollResult): string {
  if (roll.hand === "trips") {
    if (roll.dice[0] === 1) {
      return "ピンゾロ";
    }
    return `${handLabels[roll.hand]}${roll.dice[0]}`;
  }

  if (roll.hand === "pair") {
    const counts = new Map<number, number>();
    for (const value of roll.dice) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const single = [...counts.entries()].find(([, count]) => count === 1);
    return `${handLabels[roll.hand]} ${single?.[0] ?? roll.handValue}`;
  }

  return handLabels[roll.hand];
}
