"use client";

import type { GameState } from "@/types/game";

interface PlayerListProps {
  state: GameState | null;
  selfId?: string;
}

export function PlayerList({ state, selfId }: PlayerListProps) {
  return (
    <aside className="border border-stone-300 bg-white p-5">
      <h2 className="mb-3 text-lg font-bold">Players</h2>
      <div className="grid gap-2">
        {(state?.players ?? []).map((player, index) => {
          const isBanker = index === state?.bankerIndex;
          const isActive = index === state?.currentPlayerIndex;
          return (
            <div
              className="grid gap-1 border-b border-stone-200 py-2 text-sm"
              key={player.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {player.nickname}
                  {player.id === selfId ? " / you" : ""}
                </span>
                <span className="font-semibold">
                  {state?.scores[player.id] ?? 0} pt
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-stone-600">
                {isBanker && <span>親</span>}
                {isActive && <span>手番</span>}
                <span>{player.isReady ? "ready" : "waiting"}</span>
                <span>{player.abilityId}</span>
              </div>
            </div>
          );
        })}
        {!state?.players.length && (
          <p className="text-sm text-stone-500">参加者を待っています。</p>
        )}
      </div>
    </aside>
  );
}
