"use client";

import type { GameState, RoundHistoryEntry } from "@/types/game";

interface RoundHistoryProps {
  state: GameState;
}

export function RoundHistory({ state }: RoundHistoryProps) {
  // 旧バージョンのサーバーが返すstateにはhistoryが無いことがある
  const history = state.history ?? [];
  if (history.length === 0) {
    return null;
  }

  return (
    <details className="border border-stone-300 bg-white p-4 text-sm">
      <summary className="cursor-pointer font-bold">
        ラウンド履歴 ({history.length})
      </summary>
      <div className="mt-3 grid gap-4">
        {[...history].reverse().map((entry) => (
          <RoundEntry entry={entry} key={entry.round} />
        ))}
      </div>
    </details>
  );
}

function RoundEntry({ entry }: { entry: RoundHistoryEntry }) {
  const bankerName = entry.nicknames[entry.bankerId] ?? entry.bankerId;

  return (
    <div className="border-t border-stone-200 pt-3">
      <p className="mb-2 font-semibold">
        R{entry.round} 親: {bankerName}
      </p>
      <div className="grid gap-1">
        {Object.entries(entry.rolls).map(([playerId, roll]) => {
          const settlement = entry.settlements[playerId];
          const delta =
            playerId === entry.bankerId
              ? Object.values(entry.settlements).reduce(
                  (total, s) => total + s.bankerDelta,
                  0,
                )
              : settlement?.playerDelta;

          return (
            <div
              className="flex flex-wrap items-center justify-between gap-2 text-xs"
              key={playerId}
            >
              <span>
                {entry.nicknames[playerId] ?? playerId}
                {playerId === entry.bankerId ? "（親）" : ""}
              </span>
              <span className="text-stone-500">
                [{roll.dice.join(",")}] {roll.hand}
              </span>
              {delta !== undefined && <DeltaBadge value={delta} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const color =
    value > 0
      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
      : value < 0
        ? "bg-red-50 text-red-800 border-red-300"
        : "bg-stone-50 text-stone-600 border-stone-300";

  return (
    <span className={`border px-1.5 py-0.5 font-mono font-bold ${color}`}>
      {value > 0 ? "+" : ""}
      {value}pt
    </span>
  );
}
