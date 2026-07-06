"use client";

import type { GameState } from "@/types/game";

interface GameResultProps {
  state: GameState;
}

export function GameResult({ state }: GameResultProps) {
  const sorted = [...state.players]
    .map((player) => ({ player, score: state.scores[player.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  // 同点は同順位（1,2,2,4形式）
  const ranking = sorted.map((entry) => ({
    ...entry,
    rank: sorted.filter((other) => other.score > entry.score).length + 1,
  }));

  return (
    <div className="mb-5 animate-[result-in_0.5s_ease-out] border-2 border-amber-500 bg-amber-50 p-5">
      <h2 className="mb-4 text-center text-xl font-bold text-stone-900">
        ゲーム終了！
      </h2>
      <div className="grid gap-2">
        {ranking.map(({ player, score, rank }) => {
          const isFirst = rank === 1;
          return (
            <div
              className={[
                "flex items-center justify-between gap-3 border p-3",
                isFirst
                  ? "animate-[crown-pop_0.6s_ease-out] border-2 border-amber-500 bg-white shadow-md"
                  : "border-stone-200 bg-white/70",
              ].join(" ")}
              key={player.id}
            >
              <span
                className={[
                  "flex items-center gap-2",
                  isFirst ? "text-lg font-bold" : "text-sm font-semibold",
                ].join(" ")}
              >
                <span className="text-stone-500">{rank}位</span>
                {isFirst && <span aria-hidden>👑</span>}
                {player.nickname}
              </span>
              <span
                className={isFirst ? "text-xl font-bold" : "text-base font-semibold"}
              >
                {score}pt
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
