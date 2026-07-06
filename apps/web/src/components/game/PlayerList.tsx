"use client";

import { ABILITY_INFO, type GameState } from "@/types/game";

const abilityNames: Record<string, string> = Object.fromEntries(
  ABILITY_INFO.map((ability) => [ability.id, ability.name]),
);

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
          const abilityId = getEffectiveAbilityId(
            state,
            player.id,
            player.abilityId,
          );
          return (
            <div
              className={[
                "grid gap-1 border-b py-2 text-sm",
                isActive
                  ? "border-red-300 bg-red-50 px-2"
                  : "border-stone-200",
              ].join(" ")}
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
                {abilityId && (
                  <span>
                    {state?.abilityMode === "random_turn" ? "今: " : ""}
                    {abilityNames[abilityId] ?? abilityId}
                  </span>
                )}
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

function getEffectiveAbilityId(
  state: GameState | null,
  playerId: string,
  fallbackAbilityId: string,
): string | null {
  if (state?.abilityMode === "random_turn") {
    return state.currentTurnAbilityMap[playerId] ?? null;
  }

  return fallbackAbilityId;
}
